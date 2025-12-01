/**
 * EnorEtt Subscription API Routes
 * Handles Stripe subscription creation, status checks, and webhooks
 */

import express from 'express';
import Stripe from 'stripe';

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
    const { extensionId, returnUrl, cancelUrl } = req.body;
    
    if (!extensionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing extensionId'
      });
    }
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'EnorEtt Pro',
              description: 'Premium Swedish grammar helper with 10,000+ words and AI features'
            },
            recurring: {
              interval: 'month'
            },
            unit_amount: 299 // $2.99 in cents
          },
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: returnUrl || `${req.protocol}://${req.get('host')}/upgrade?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.protocol}://${req.get('host')}/upgrade?canceled=true`,
      metadata: {
        extensionId: extensionId
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
    
    // In production, you'd look up the user's subscription from your database
    // For now, if sessionId is provided, verify it with Stripe
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status === 'paid') {
        // Get subscription details
        const subscriptionId = session.subscription;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          
          return res.json({
            success: true,
            subscription: {
              status: subscription.status,
              plan: 'pro',
              expiresAt: new Date(subscription.current_period_end * 1000).toISOString(),
              userId: userId || session.metadata?.extensionId,
              stripeCustomerId: subscription.customer,
              stripeSubscriptionId: subscription.id
            }
          });
        }
      }
    }
    
    // If userId is provided, look up from database
    // TODO: Implement database lookup
    if (userId) {
      // Placeholder: return no subscription
      return res.json({
        success: true,
        subscription: null
      });
    }
    
    res.json({
      success: false,
      error: 'Could not find subscription'
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
      console.log('Customer:', session.customer);
      console.log('Subscription:', session.subscription);
      // TODO: Update user subscription in database
      // Här skulle du spara subscription till databas och koppla till user ID
      break;
      
    case 'customer.subscription.created':
      const newSubscription = event.data.object;
      console.log('✅ Subscription created:', newSubscription.id);
      console.log('Status:', newSubscription.status);
      console.log('Customer:', newSubscription.customer);
      // TODO: Create subscription record in database
      break;
      
    case 'customer.subscription.updated':
      const updatedSubscription = event.data.object;
      console.log('✅ Subscription updated:', updatedSubscription.id);
      console.log('Status:', updatedSubscription.status);
      console.log('Current period end:', new Date(updatedSubscription.current_period_end * 1000));
      // TODO: Update subscription status in database
      break;
      
    case 'customer.subscription.deleted':
      const deletedSubscription = event.data.object;
      console.log('✅ Subscription canceled:', deletedSubscription.id);
      console.log('Canceled at:', new Date(deletedSubscription.canceled_at * 1000));
      // TODO: Mark subscription as canceled in database
      break;
      
    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      console.log('✅ Invoice paid:', invoice.id);
      console.log('Subscription:', invoice.subscription);
      console.log('Amount:', invoice.amount_paid / 100, invoice.currency);
      // TODO: Log successful payment, send confirmation email
      break;
      
    case 'invoice.payment_failed':
      const failedInvoice = event.data.object;
      console.log('⚠️ Payment failed:', failedInvoice.id);
      console.log('Subscription:', failedInvoice.subscription);
      console.log('Attempt count:', failedInvoice.attempt_count);
      // TODO: Notify user, send retry email
      break;
      
    case 'customer.subscription.trial_will_end':
      const trialSubscription = event.data.object;
      console.log('⏰ Trial ending soon:', trialSubscription.id);
      console.log('Trial ends:', new Date(trialSubscription.trial_end * 1000));
      // TODO: Send reminder email 3 days before trial ends
      break;
      
    case 'customer.subscription.past_due':
      const pastDueSubscription = event.data.object;
      console.log('⚠️ Subscription past due:', pastDueSubscription.id);
      // TODO: Send urgent payment reminder
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
