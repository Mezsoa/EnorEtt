/**
 * EnorEtt Subscription API Routes
 * Handles Stripe subscription creation, status checks, and webhooks
 */

import express from 'express';
import Stripe from 'stripe';
import mongoose from 'mongoose';
import Purchase from '../models/Purchase.js';
import User from '../models/User.js';
import { connectDB } from '../db/connection.js';

const router = express.Router();

// Initialize Stripe (use environment variable in production)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-11-20.acacia'
});

/**
 * POST /api/subscription/create
 * Create a Stripe checkout session for Pro subscription
 */
router.post('/create', async (req, res) => {
  try {
    const { extensionId, userId, returnUrl, cancelUrl } = req.body;
    
    if (!extensionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing extensionId'
      });
    }
    
    // Use existing Stripe product and price (one-time payment)
    const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_1SZgWARxSnyDCJdnufTgAWvZ';
    
    // Create Stripe checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: STRIPE_PRICE_ID, // Use existing price ID
          quantity: 1
        }
      ],
      mode: 'payment', // One-time payment
      success_url: returnUrl || `${req.protocol}://${req.get('host')}/upgrade?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.protocol}://${req.get('host')}/upgrade?canceled=true`,
      metadata: {
        extensionId: extensionId,
        userId: userId || '',
        purchaseType: 'one-time'
      }
    });
    
    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });
    
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session',
      details: error.message
    });
  }
});

/**
 * GET /api/subscription/status
 * Get subscription status for a user
 * Can find by userId, sessionId, email, or stripeCustomerId
 */
router.get('/status', async (req, res) => {
  try {
    const { userId, sessionId, email, stripeCustomerId } = req.query;
    
    if (!userId && !sessionId && !email && !stripeCustomerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId, sessionId, email, or stripeCustomerId'
      });
    }
    
    // Ensure database connection (but don't fail if it doesn't work)
    try {
      await connectDB();
    } catch (dbError) {
      console.warn('Database connection failed, continuing without DB:', dbError.message);
    }
    
    const dbAvailable = mongoose.connection.readyState === 1;
    
    // Strategy: Try to find user first, then find their purchase
    let user = null;
    let purchase = null;
    
    // Only try database queries if available
    if (dbAvailable) {
      try {
        // Find user by different methods
        if (userId) {
          user = await User.findOne({ userId });
        } else if (email) {
          user = await User.findOne({ email });
        } else if (stripeCustomerId) {
          user = await User.findOne({ stripeCustomerId });
        }
        
        // If we found a user, get their active purchase
        if (user) {
          // Try to find purchase by userId first
          purchase = await Purchase.findActivePurchase(user.userId);
          
          // If not found, try to find by stripeCustomerId (in case userId mismatch)
          if (!purchase && user.stripeCustomerId) {
            purchase = await Purchase.findOne({
              stripeCustomerId: user.stripeCustomerId,
              status: { $in: ['active', 'trialing'] },
              $or: [
                { expiresAt: null },
                { expiresAt: { $gt: new Date() } }
              ]
            }).sort({ purchasedAt: -1 });
          }
          
          // If still not found and we have email, try to find user by email and their purchase
          if (!purchase && (email || user.email)) {
            const searchEmail = email || user.email;
            const userByEmail = await User.findOne({ email: searchEmail });
            if (userByEmail && userByEmail.userId !== user.userId) {
              purchase = await Purchase.findActivePurchase(userByEmail.userId);
              if (purchase && purchase.isActive()) {
                // Found purchase with different userId - use the correct user
                user = userByEmail;
              }
            }
          }
          
          if (purchase && purchase.isActive()) {
            // Always use the userId from the purchase (which is the correct one)
            // This ensures we return the correct userId even if user lookup found wrong one
            const correctUserId = purchase.userId;
            
            // Update user record if userId doesn't match
            if (user.userId !== correctUserId) {
              // Find or create user with correct userId
              const correctUser = await User.findOrCreate(correctUserId, {
                email: user.email || email,
                stripeCustomerId: purchase.stripeCustomerId
              });
              user = correctUser;
            }
            
            // Update purchase userId if it doesn't match (shouldn't happen now, but just in case)
            if (purchase.userId !== user.userId) {
              purchase.userId = user.userId;
              await purchase.save();
            }
            
            return res.json({
              success: true,
              subscription: {
                status: purchase.status,
                plan: purchase.plan,
                expiresAt: purchase.expiresAt ? purchase.expiresAt.toISOString() : null,
                userId: purchase.userId,
                stripeCustomerId: purchase.stripeCustomerId,
                stripePaymentIntentId: purchase.stripePaymentIntentId,
                purchaseType: purchase.purchaseType
              },
              user: {
                userId: user.userId,
                email: user.email,
                stats: user.stats
              }
            });
          }
        }
        
        // If userId was provided but no user found, try direct purchase lookup
        if (userId && !user) {
          purchase = await Purchase.findActivePurchase(userId);
          
          // If not found by userId, also try to find by email (in case userId mismatch)
          if (!purchase && email) {
            // Find user by email first
            const userByEmail = await User.findOne({ email });
            if (userByEmail) {
              purchase = await Purchase.findActivePurchase(userByEmail.userId);
              if (purchase && purchase.isActive()) {
                user = userByEmail;
              }
            }
          }
          
          if (purchase && purchase.isActive()) {
            // Use the userId from the purchase (which is the correct one)
            const correctUserId = purchase.userId;
            
            // Create/update user record with correct userId
            user = await User.findOrCreate(correctUserId, {
              email: user?.email || email,
              stripeCustomerId: purchase.stripeCustomerId
            });
            
            // Update email if available
            if (email && !user.email) {
              user.email = email;
              await user.save();
            }
            
            return res.json({
              success: true,
              subscription: {
                status: purchase.status,
                plan: purchase.plan,
                expiresAt: purchase.expiresAt ? purchase.expiresAt.toISOString() : null,
                userId: purchase.userId,
                stripeCustomerId: purchase.stripeCustomerId,
                stripePaymentIntentId: purchase.stripePaymentIntentId,
                purchaseType: purchase.purchaseType
              },
              user: {
                userId: user.userId,
                email: user.email,
                stats: user.stats
              }
            });
          }
        }
        
        // If sessionId is provided, check database first
        if (sessionId) {
          const sessionPurchase = await Purchase.findOne({ stripeSessionId: sessionId });
          
          if (sessionPurchase && sessionPurchase.isActive()) {
            return res.json({
              success: true,
              subscription: {
                status: sessionPurchase.status,
                plan: sessionPurchase.plan,
                expiresAt: sessionPurchase.expiresAt ? sessionPurchase.expiresAt.toISOString() : null,
                userId: sessionPurchase.userId,
                stripeCustomerId: sessionPurchase.stripeCustomerId,
                stripePaymentIntentId: sessionPurchase.stripePaymentIntentId,
                purchaseType: sessionPurchase.purchaseType
              }
            });
          }
        }
      } catch (dbError) {
        console.warn('Database query failed:', dbError.message);
        // Continue to Stripe recovery
      }
    }
    
    // If sessionId is provided and not found in DB, fall back to Stripe
    if (sessionId) {
      
      // Fallback: verify with Stripe if not in database yet
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status === 'paid') {
        if (session.mode === 'payment') {
          return res.json({
            success: true,  
            subscription: {
              status: 'active',
              plan: 'Premium',
              expiresAt: null, // Lifetime access
              userId: userId || session.metadata?.extensionId,
              stripeCustomerId: session.customer,
              stripePaymentIntentId: session.payment_intent,
              purchaseType: 'one-time'
            }
          });
        } else if (session.subscription) {
          // Subscription mode (if you switch back)
          const subscriptionId = session.subscription;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          
          return res.json({
            success: true,
            subscription: {
              status: subscription.status,
              plan: 'Premium',
              expiresAt: new Date(subscription.current_period_end * 1000).toISOString(),
              userId: userId || session.metadata?.extensionId,
              stripeCustomerId: subscription.customer,
              stripeSubscriptionId: subscription.id,
              purchaseType: 'subscription'
            }
          });
        }
      }
    }
    
    // No active subscription found in database
    // Try to recover from Stripe if we have email or stripeCustomerId
    if (email || stripeCustomerId) {
      try {
        console.log('No subscription in database, attempting recovery from Stripe...');
        
        let customer = null;
        
        // Find customer
        if (email) {
          const customers = await stripe.customers.list({
            email: email,
            limit: 1
          });
          if (customers.data.length > 0) {
            customer = customers.data[0];
          }
        } else if (stripeCustomerId) {
          customer = await stripe.customers.retrieve(stripeCustomerId);
        }
        
        // Find paid checkout sessions
        let paidSessions = [];
        
        if (customer) {
          const sessions = await stripe.checkout.sessions.list({
            customer: customer.id,
            limit: 10
          });
          paidSessions = sessions.data.filter(s => 
            s.payment_status === 'paid' && s.mode === 'payment'
          );
        } else if (email) {
          // For guest customers, search by email
          const allSessions = await stripe.checkout.sessions.list({
            limit: 100
          });
          paidSessions = allSessions.data.filter(s => 
            s.payment_status === 'paid' && 
            s.mode === 'payment' &&
            s.customer_email === email
          );
        }
        
        if (paidSessions.length > 0) {
          // Get most recent paid session
          const session = paidSessions.sort((a, b) => b.created - a.created)[0];
          const sessionEmail = session.customer_email || customer?.email || email;
          // Prioritize email-based userId for better user identification
          const foundUserId = session.metadata?.userId || 
                             (sessionEmail ? `user_${sessionEmail.replace(/[^a-zA-Z0-9]/g, '_')}` : null) ||
                             session.metadata?.extensionId || 
                             customer?.id || 
                             `user_${session.id}`;
          
          // Create user and purchase records (only if DB is available)
          let recoveredUser = null;
          let recoveredPurchase = null;
          
          if (dbAvailable) {
            try {
              recoveredUser = await User.findOrCreate(foundUserId, {
                email: sessionEmail,
                stripeCustomerId: customer?.id || session.customer
              });
              
              if (sessionEmail && !recoveredUser.email) {
                recoveredUser.email = sessionEmail;
                await recoveredUser.save();
              }
              
              if ((customer?.id || session.customer) && !recoveredUser.stripeCustomerId) {
                recoveredUser.stripeCustomerId = customer?.id || session.customer;
                await recoveredUser.save();
              }
              
              // Check if purchase already exists
              recoveredPurchase = await Purchase.findOne({ stripeSessionId: session.id });
              
              if (!recoveredPurchase) {
                recoveredPurchase = new Purchase({
                  userId: recoveredUser.userId,
                  stripeCustomerId: customer?.id || session.customer,
                  stripeSessionId: session.id,
                  stripePaymentIntentId: session.payment_intent,
                  purchaseType: 'one-time',
                  plan: 'Premium',
                  status: 'active',
                  expiresAt: null,
                  amount: session.amount_total ? session.amount_total / 100 : 30,
                  currency: session.currency || 'sek',
                  extensionId: session.metadata?.extensionId || 'enorett',
                  purchasedAt: new Date(session.created * 1000)
                });
                await recoveredPurchase.save();
                console.log('✅ Auto-recovered purchase from Stripe:', recoveredPurchase.id);
              }
            } catch (dbSaveError) {
              console.warn('Failed to save recovered purchase to database:', dbSaveError.message);
              // Continue - return subscription data anyway
            }
          }
          
          // Return subscription data even if we couldn't save to DB
          if (recoveredPurchase && recoveredPurchase.isActive()) {
            return res.json({
              success: true,
              subscription: {
                status: recoveredPurchase.status,
                plan: recoveredPurchase.plan,
                expiresAt: recoveredPurchase.expiresAt ? recoveredPurchase.expiresAt.toISOString() : null,
                userId: recoveredPurchase.userId,
                stripeCustomerId: recoveredPurchase.stripeCustomerId,
                stripePaymentIntentId: recoveredPurchase.stripePaymentIntentId,
                purchaseType: recoveredPurchase.purchaseType
              },
              user: recoveredUser ? {
                userId: recoveredUser.userId,
                email: recoveredUser.email,
                stats: recoveredUser.stats
              } : null
            });
          } else if (session) {
            // Return subscription from Stripe session even if DB save failed
            return res.json({
              success: true,
              subscription: {
                status: 'active',
                plan: 'Premium',
                expiresAt: null,
                userId: foundUserId,
                stripeCustomerId: customer?.id || session.customer,
                stripePaymentIntentId: session.payment_intent,
                purchaseType: 'one-time'
              },
              user: recoveredUser ? {
                userId: recoveredUser.userId,
                email: recoveredUser.email,
                stats: recoveredUser.stats
              } : {
                userId: foundUserId,
                email: sessionEmail
              }
            });
          }
        }
      } catch (recoveryError) {
        console.warn('Failed to recover from Stripe:', recoveryError);
        // Continue to return null
      }
    }
    
    // No active subscription found
    return res.json({
      success: true,
      subscription: null
    });
    
  } catch (error) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check subscription status',
      details: error.message
    });
  }
});

/**
 * POST /api/subscription/recover
 * Recover subscription from Stripe by email or customer ID
 * Useful if purchase was made before database existed
 */
router.post('/recover', async (req, res) => {
  try {
    const { email, stripeCustomerId, sessionId, paymentIntentId } = req.body;
    
    if (!email && !stripeCustomerId && !sessionId && !paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing email, stripeCustomerId, sessionId, or paymentIntentId'
      });
    }
    
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
      return res.status(500).json({
        success: false,
        error: 'Stripe not configured. Please set STRIPE_SECRET_KEY in environment variables.'
      });
    }
    
    await connectDB();
    
    console.log('Recover request:', { email, stripeCustomerId, sessionId, paymentIntentId });
    
    let customer = null;
    let sessions = [];
    
    // Find customer by email or customer ID
    if (email) {
      try {
        const customers = await stripe.customers.list({
          email: email,
          limit: 10
        });
        if (customers.data.length > 0) {
          customer = customers.data[0]; // Use first match
          console.log('Found customer by email:', customer.id);
        } else {
          console.log('No customer found with email:', email);
        }
      } catch (e) {
        console.error('Error searching for customer by email:', e);
      }
    }
    
    // Also try to get customer by ID if provided (but guest customers can't be retrieved)
    if (stripeCustomerId && !stripeCustomerId.startsWith('gcus_')) {
      try {
        customer = await stripe.customers.retrieve(stripeCustomerId);
        console.log('Retrieved customer by ID:', customer.id);
      } catch (e) {
        console.warn('Could not retrieve customer:', e.message);
      }
    }
    
    // If we have a customer, find their checkout sessions
    if (customer) {
      const allSessions = await stripe.checkout.sessions.list({
        customer: customer.id,
        limit: 100
      });
      sessions = allSessions.data.filter(s => 
        s.payment_status === 'paid' && s.mode === 'payment'
      );
    }
    
    // For guest customers or if no customer found, search all sessions
    if (sessions.length === 0 && (email || (stripeCustomerId && stripeCustomerId.startsWith('gcus_')))) {
      try {
        console.log('Searching all sessions for guest customer...');
        // List all recent sessions (Stripe doesn't support filtering guest customers directly)
        const allSessions = await stripe.checkout.sessions.list({
          limit: 100
        });
        console.log(`Total sessions found: ${allSessions.data.length}`);
        
        sessions = allSessions.data.filter(s => {
          const isPaid = s.payment_status === 'paid' && s.mode === 'payment';
          const matchesEmail = email && s.customer_email && s.customer_email.toLowerCase() === email.toLowerCase();
          const matchesCustomer = stripeCustomerId && s.customer === stripeCustomerId;
          return isPaid && (matchesEmail || matchesCustomer);
        });
        console.log(`Filtered to ${sessions.length} paid sessions matching criteria`);
      } catch (e) {
        console.error('Error listing sessions:', e);
        // Continue with empty sessions array
      }
    }
    
    // If paymentIntentId is provided, find session from payment intent
    if (paymentIntentId) {
      try {
        console.log('Looking up session from payment intent:', paymentIntentId);
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        console.log('Payment intent found:', paymentIntent.id, 'Status:', paymentIntent.status);
        
        // Payment intents don't have direct session reference, so we need to search
        // But we can use the metadata or search all sessions
        if (paymentIntent.status === 'succeeded') {
          // Search for session with this payment intent
          const allSessions = await stripe.checkout.sessions.list({
            limit: 100
          });
          const matchingSession = allSessions.data.find(s => 
            s.payment_intent === paymentIntentId && 
            s.payment_status === 'paid' && 
            s.mode === 'payment'
          );
          
          if (matchingSession) {
            sessions = [matchingSession];
            console.log('Found session from payment intent:', matchingSession.id);
            if (matchingSession.customer) {
              try {
                customer = await stripe.customers.retrieve(matchingSession.customer);
              } catch (e) {
                // Guest customer, can't retrieve
              }
            }
          }
        }
      } catch (e) {
        console.error('Error retrieving payment intent:', e);
      }
    }
    
    if (sessionId) {
      // Try to get session directly
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === 'paid' && session.mode === 'payment') {
          sessions = [session];
          if (session.customer) {
            try {
              customer = await stripe.customers.retrieve(session.customer);
            } catch (e) {
              // Guest customer, can't retrieve
            }
          }
        }
      } catch (e) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }
    }
    
    if (sessions.length === 0) {
      return res.json({
        success: true,
        message: 'No paid sessions found',
        subscription: null
      });
    }
    
    // Process the most recent paid session
    const session = sessions.sort((a, b) => b.created - a.created)[0];
    
    // Get email from session or customer
    const sessionEmail = session.customer_email || customer?.email || email;
    
    // Get userId from metadata or generate one based on email
    // Prioritize email-based userId for better user identification
    const userId = session.metadata?.userId || 
                   (sessionEmail ? `user_${sessionEmail.replace(/[^a-zA-Z0-9]/g, '_')}` : null) ||
                   session.metadata?.extensionId || 
                   customer?.id || 
                   `user_${session.id}`;
    
    // Find or create user
    const user = await User.findOrCreate(userId, {
      email: sessionEmail,
      stripeCustomerId: customer?.id || session.customer
    });
    
    // Update email if available
    if (sessionEmail && !user.email) {
      user.email = sessionEmail;
      await user.save();
    }
    
    // Update Stripe customer ID if available
    if ((customer?.id || session.customer) && !user.stripeCustomerId) {
      user.stripeCustomerId = customer?.id || session.customer;
      await user.save();
    }
    
    // Check if purchase already exists
    let purchase = await Purchase.findOne({ stripeSessionId: session.id });
    
    if (!purchase) {
      // Create purchase record
      purchase = new Purchase({
        userId: user.userId,
        stripeCustomerId: customer?.id || session.customer,
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent,
        purchaseType: 'one-time',
        plan: 'Premium',
        status: 'active',
        expiresAt: null, // Lifetime access
        amount: session.amount_total ? session.amount_total / 100 : 30, // Convert from cents, default 30 SEK
        currency: session.currency || 'sek',
        extensionId: session.metadata?.extensionId || 'enorett',
        purchasedAt: new Date(session.created * 1000)
      });
      await purchase.save();
      console.log('✅ Recovered purchase from Stripe:', purchase.id);
    }
    
    return res.json({
      success: true,
      message: 'Subscription recovered successfully',
      subscription: {
        status: purchase.status,
        plan: purchase.plan,
        expiresAt: purchase.expiresAt ? purchase.expiresAt.toISOString() : null,
        userId: purchase.userId,
        stripeCustomerId: purchase.stripeCustomerId,
        stripePaymentIntentId: purchase.stripePaymentIntentId,
        purchaseType: purchase.purchaseType
      },
      user: {
        userId: user.userId,
        email: user.email,
        stats: user.stats
      }
    });
    
  } catch (error) {
    console.error('Error recovering subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to recover subscription',
      details: error.message
    });
  }
});

/**
 * POST /api/subscription/webhook
 * Handle Stripe webhook events
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';
  
  // Log webhook received
  console.log('📥 Webhook received');
  console.log('Signature present:', !!sig);
  console.log('Webhook secret configured:', webhookSecret !== 'whsec_placeholder');
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log('✅ Webhook verified. Event type:', event.type);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('✅ Checkout session completed:', session.id);
      console.log('Payment mode:', session.mode);
      console.log('Customer:', session.customer);
      console.log('Payment status:', session.payment_status);
      
      if (session.mode === 'payment' && session.payment_status === 'paid') {
        // One-time payment completed
        console.log('💰 One-time payment successful');
        console.log('Payment Intent:', session.payment_intent);
        console.log('Amount total:', session.amount_total / 100, session.currency);
        
        try {
          // Ensure database connection
          await connectDB();
          
          // Get userId from metadata, or use extensionId, or generate one
          const userId = session.metadata?.userId || session.metadata?.extensionId || session.customer || `user_${session.id}`;
          
          // Get email from session (customer_email or from customer object)
          let email = session.customer_email;
          if (!email && session.customer) {
            try {
              const customer = await stripe.customers.retrieve(session.customer);
              email = customer.email;
            } catch (e) {
              console.warn('Could not retrieve customer email:', e);
            }
          }
          
          // Find or create user
          const user = await User.findOrCreate(userId, {
            stripeCustomerId: session.customer,
            ...(email && { email })
          });
          
          // Update email if not set
          if (email && !user.email) {
            user.email = email;
            await user.save();
          }
          
          // Link Stripe customer if not already linked
          if (session.customer && !user.stripeCustomerId) {
            await user.linkStripeCustomer(session.customer);
          }
          
          // Check if purchase already exists
          const existingPurchase = await Purchase.findOne({ stripeSessionId: session.id });
          
          if (!existingPurchase) {
            // Create new purchase record
            // expiresAt is null for lifetime access (as per current setup)
            const purchase = new Purchase({
              userId: userId,
              stripeCustomerId: session.customer,
              stripeSessionId: session.id,
              stripePaymentIntentId: session.payment_intent,
              purchaseType: 'one-time',
              plan: 'Premium',
              status: 'active',
              expiresAt: null, // Lifetime access
              amount: session.amount_total / 100, // Convert from cents
              currency: session.currency || 'sek',
              extensionId: session.metadata?.extensionId || 'enorett',
              metadata: session.metadata || {},
              purchasedAt: new Date(),
            });
            
            await purchase.save();
            console.log('✅ Purchase saved to database:', purchase._id);
            console.log('✅ User updated:', user.userId);
          } else {
            console.log('ℹ️ Purchase already exists for session:', session.id);
          }
        } catch (error) {
          console.error('❌ Error saving purchase to database:', error);
          console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            sessionId: session.id,
            userId: session.metadata?.userId
          });
          // Return 500 so Stripe retries the webhook
          return res.status(500).json({
            error: 'Failed to save purchase',
            message: error.message
          });
        }
      } else if (session.subscription) {
        // Subscription payment (if you switch back)
        console.log('📅 Subscription:', session.subscription);
        // TODO: Handle subscription
      }
      break;
      
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('✅ Payment intent succeeded:', paymentIntent.id);
      console.log('Amount:', paymentIntent.amount / 100, paymentIntent.currency);
      console.log('Customer:', paymentIntent.customer);
      
      try {
        // Ensure database connection
        await connectDB();
        
        // Find purchase by payment intent ID and ensure it's active
        const purchase = await Purchase.findOne({ 
          stripePaymentIntentId: paymentIntent.id 
        });
        
        if (purchase && purchase.status !== 'active') {
          purchase.status = 'active';
          await purchase.save();
          console.log('✅ Purchase status updated to active:', purchase._id);
        }
      } catch (error) {
        console.error('❌ Error updating purchase status:', error);
      }
      break;
      
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('⚠️ Payment failed:', failedPayment.id);
      console.log('Failure reason:', failedPayment.last_payment_error?.message);
      // TODO: Notify user of payment failure
      break;
      
    // Subscription events (if you add subscriptions later)
    case 'customer.subscription.created':
      const newSubscription = event.data.object;
      console.log('📅 Subscription created:', newSubscription.id);
      console.log('Status:', newSubscription.status);
      // TODO: Handle subscription creation
      break;
      
    case 'customer.subscription.updated':
      const updatedSubscription = event.data.object;
      console.log('📅 Subscription updated:', updatedSubscription.id);
      console.log('Status:', updatedSubscription.status);
      // TODO: Handle subscription update
      break;
      
    case 'customer.subscription.deleted':
      const deletedSubscription = event.data.object;
      console.log('📅 Subscription canceled:', deletedSubscription.id);
      // TODO: Handle subscription cancellation
      break;
      
    default:
      console.log(`ℹ️ Unhandled event type: ${event.type}`);
  }
  
  res.json({ received: true });
});

/**
 * GET /api/subscription/cancel
 * Cancel a subscription
 */
router.get('/cancel', async (req, res) => {
  try {
    const { subscriptionId } = req.query;
    
    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing subscriptionId'
      });
    }
    
    // Cancel subscription in Stripe
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    });
    
    res.json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      }
    });
    
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription',
      details: error.message
    });
  }
});

export default router;
