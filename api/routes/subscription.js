/**
 * EnorEtt Subscription API Routes
 * Handles Stripe subscription creation, status checks, and webhooks
 */

import express from 'express';
import Stripe from 'stripe';
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
 */
router.get('/status', async (req, res) => {
  try {
    const { userId, sessionId } = req.query;
    
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId or sessionId'
      });
    }
    
    // Ensure database connection
    await connectDB();
    
    // If userId is provided, look up from database first
    if (userId) {
      // Find or create user
      const user = await User.findOrCreate(userId);
      
      const purchase = await Purchase.findActivePurchase(userId);
      
      if (purchase && purchase.isActive()) {
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
    
    // If sessionId is provided, check database first, then fall back to Stripe
    if (sessionId) {
      // Check database for purchase with this session ID
      const purchase = await Purchase.findOne({ stripeSessionId: sessionId });
      
      if (purchase && purchase.isActive()) {
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
          }
        });
      }
      
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
 * POST /api/subscription/webhook
 * Handle Stripe webhook events
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
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
          
          // Find or create user
          const user = await User.findOrCreate(userId, {
            stripeCustomerId: session.customer,
          });
          
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
          // Don't fail the webhook - Stripe will retry if we return error
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
