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
 * Requires logged in user (x-user-id header)
 */
router.post('/create', async (req, res) => {
  try {
    await connectDB();
    
    const { extensionId, returnUrl, cancelUrl } = req.body;
    const userId = req.headers['x-user-id']; // Get logged in user
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please log in first.'
      });
    }
    
    // Get user to verify they exist and get email
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
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
          price: STRIPE_PRICE_ID,
          quantity: 1
        }
      ],
      mode: 'payment', // One-time payment
      customer_email: user.email, // Pre-fill email from logged in user
      success_url: returnUrl || `${req.protocol}://${req.get('host')}/upgrade?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.protocol}://${req.get('host')}/upgrade?canceled=true`,
      metadata: {
        extensionId: extensionId,
        userId: user.userId, // Always use logged in user's userId
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
 * Get subscription status for logged in user
 */
router.get('/status', async (req, res) => {
  try {
    await connectDB();
    
    const userId = req.headers['x-user-id']; // Get logged in user
    const { sessionId } = req.query; // Optional: for payment callback
    
    if (!userId && !sessionId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required or provide sessionId'
      });
    }
    
    const dbAvailable = mongoose.connection.readyState === 1;
    
    // If sessionId provided (payment callback), handle that first
    if (sessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        
        if (session.payment_status === 'paid' && session.mode === 'payment') {
          const sessionUserId = session.metadata?.userId;
          
          if (dbAvailable) {
            // Find or create user
            const user = await User.findOrCreate(sessionUserId, {
              email: session.customer_email
            });
            
            // Update email if available
            if (session.customer_email && !user.email) {
              user.email = session.customer_email;
              await user.save();
            }
            
            // Check if purchase exists
            let purchase = await Purchase.findOne({ stripeSessionId: session.id });
            
            if (!purchase) {
              purchase = new Purchase({
                userId: user.userId,
                stripeCustomerId: session.customer,
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
              await purchase.save();
            }
            
            if (purchase && purchase.isActive()) {
              return res.json({
                success: true,
                subscription: {
                  status: purchase.status,
                  plan: purchase.plan,
                  expiresAt: purchase.expiresAt ? purchase.expiresAt.toISOString() : null,
                  userId: purchase.userId,
                  stripeCustomerId: purchase.stripeCustomerId,
                  purchaseType: purchase.purchaseType
                },
                user: {
                  userId: user.userId,
                  email: user.email
                }
              });
            }
          }
        }
      } catch (e) {
        console.warn('Error processing sessionId:', e);
      }
    }
    
    // Get subscription for logged in user
    if (userId && dbAvailable) {
      const user = await User.findOne({ userId });
      if (user) {
        const purchase = await Purchase.findActivePurchase(user.userId);
        
        if (purchase && purchase.isActive()) {
          return res.json({
            success: true,
            subscription: {
              status: purchase.status,
              plan: purchase.plan,
              expiresAt: purchase.expiresAt ? purchase.expiresAt.toISOString() : null,
              userId: purchase.userId,
              purchaseType: purchase.purchaseType
            },
            user: {
              userId: user.userId,
              email: user.email
            }
          });
        }
      }
    }
    
    // No active subscription
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
      
      if (session.payment_status === 'paid' && session.mode === 'payment') {
        try {
          await connectDB();
          
          const userId = session.metadata?.userId;
          const email = session.customer_email;
          
          if (!userId) {
            console.error('No userId in session metadata');
            return res.status(400).json({ error: 'Missing userId' });
          }
          
          // Find or create user
          const user = await User.findOrCreate(userId, {
            email: email
          });
          
          if (email && !user.email) {
            user.email = email;
            await user.save();
          }
          
          // Check if purchase already exists
          const existingPurchase = await Purchase.findOne({ stripeSessionId: session.id });
          
          if (!existingPurchase) {
            const purchase = new Purchase({
              userId: user.userId,
              stripeCustomerId: session.customer,
              stripeSessionId: session.id,
              stripePaymentIntentId: session.payment_intent,
              purchaseType: 'one-time',
              plan: 'Premium',
              status: 'active',
              expiresAt: null,
              amount: session.amount_total / 100,
              currency: session.currency || 'sek',
              extensionId: session.metadata?.extensionId || 'enorett',
              purchasedAt: new Date()
            });
            
            await purchase.save();
            console.log('✅ Purchase saved to database:', purchase._id);
          }
        } catch (error) {
          console.error('Error saving purchase:', error);
          return res.status(500).json({ error: 'Failed to save purchase' });
        }
      }
      break;
  }
  
  res.json({ received: true });
});

export default router;
