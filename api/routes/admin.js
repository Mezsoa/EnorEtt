/**
 * Admin Routes (for debugging and fixing data)
 * WARNING: Remove or protect these routes in production!
 */

import express from 'express';
import Purchase from '../models/Purchase.js';
import User from '../models/User.js';
import { connectDB } from '../db/connection.js';

const router = express.Router();

/**
 * POST /api/admin/fix-purchase-userid
 * Fix purchase userId by matching email or stripeCustomerId
 */
router.post('/fix-purchase-userid', async (req, res) => {
  try {
    await connectDB();
    
    const { purchaseId, userId } = req.body;
    
    if (!purchaseId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing purchaseId or userId'
      });
    }
    
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found'
      });
    }
    
    // Verify user exists
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Update purchase userId
    purchase.userId = userId;
    await purchase.save();
    
    res.json({
      success: true,
      message: 'Purchase userId updated',
      purchase: {
        id: purchase._id,
        userId: purchase.userId,
        status: purchase.status
      }
    });
    
  } catch (error) {
    console.error('Error fixing purchase:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fix purchase',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/find-purchase-by-session
 * Find purchase by Stripe session ID
 */
router.get('/find-purchase-by-session/:sessionId', async (req, res) => {
  try {
    await connectDB();
    
    const { sessionId } = req.params;
    
    const purchase = await Purchase.findOne({ stripeSessionId: sessionId });
    
    if (!purchase) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found'
      });
    }
    
    // Find user
    const user = await User.findOne({ userId: purchase.userId });
    
    res.json({
      success: true,
      purchase: {
        id: purchase._id,
        userId: purchase.userId,
        status: purchase.status,
        plan: purchase.plan,
        purchasedAt: purchase.purchasedAt
      },
      user: user ? {
        userId: user.userId,
        email: user.email
      } : null
    });
    
  } catch (error) {
    console.error('Error finding purchase:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find purchase',
      details: error.message
    });
  }
});

/**
 * POST /api/admin/fix-purchase-by-email
 * Fix purchase by matching email to user
 */
router.post('/fix-purchase-by-email', async (req, res) => {
  try {
    await connectDB();
    
    const { purchaseId, email } = req.body;
    
    if (!purchaseId || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing purchaseId or email'
      });
    }
    
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found'
      });
    }
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found with that email'
      });
    }
    
    // Update purchase userId
    purchase.userId = user.userId;
    await purchase.save();
    
    res.json({
      success: true,
      message: 'Purchase userId updated',
      purchase: {
        id: purchase._id,
        userId: purchase.userId,
        status: purchase.status
      },
      user: {
        userId: user.userId,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('Error fixing purchase:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fix purchase',
      details: error.message
    });
  }
});

export default router;
