/**
 * User API Routes
 * Handles user management and information
 */

import express from 'express';
import User from '../models/User.js';
import Purchase from '../models/Purchase.js';
import { connectDB } from '../db/connection.js';

const router = express.Router();

/**
 * GET /api/users/:userId
 * Get user information
 */
router.get('/:userId', async (req, res) => {
  try {
    await connectDB();
    
    const { userId } = req.params;
    
    const user = await User.findOne({ userId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Get user's active purchases
    const purchases = await Purchase.find({
      userId: userId,
      status: { $in: ['active', 'trialing'] }
    }).sort({ purchasedAt: -1 });
    
    res.json({
      success: true,
      user: {
        userId: user.userId,
        email: user.email,
        stats: user.stats,
        preferences: user.preferences,
        createdAt: user.createdAt,
        purchases: purchases.map(p => ({
          plan: p.plan,
          status: p.status,
          purchasedAt: p.purchasedAt,
          expiresAt: p.expiresAt,
          purchaseType: p.purchaseType
        }))
      }
    });
    
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
      details: error.message
    });
  }
});

/**
 * POST /api/users
 * Create or update user
 */
router.post('/', async (req, res) => {
  try {
    await connectDB();
    
    const { userId, email, preferences } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId'
      });
    }
    
    // Find or create user
    const user = await User.findOrCreate(userId, {
      email,
      preferences: preferences || {}
    });
    
    // Update if email or preferences provided
    if (email && email !== user.email) {
      user.email = email;
    }
    
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }
    
    await user.save();
    
    res.json({
      success: true,
      user: {
        userId: user.userId,
        email: user.email,
        stats: user.stats,
        preferences: user.preferences,
        createdAt: user.createdAt
      }
    });
    
  } catch (error) {
    console.error('Error creating/updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create/update user',
      details: error.message
    });
  }
});

/**
 * PUT /api/users/:userId/stats
 * Update user statistics (e.g., increment lookup count)
 */
router.put('/:userId/stats', async (req, res) => {
  try {
    await connectDB();
    
    const { userId } = req.params;
    
    const user = await User.findOne({ userId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Update last seen and increment lookups
    await user.updateLastSeen();
    
    res.json({
      success: true,
      stats: user.stats
    });
    
  } catch (error) {
    console.error('Error updating user stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user stats',
      details: error.message
    });
  }
});

/**
 * GET /api/users/:userId/purchases
 * Get user's purchase history
 */
router.get('/:userId/purchases', async (req, res) => {
  try {
    await connectDB();
    
    const { userId } = req.params;
    
    const purchases = await Purchase.find({ userId })
      .sort({ purchasedAt: -1 });
    
    res.json({
      success: true,
      purchases: purchases.map(p => ({
        id: p._id,
        plan: p.plan,
        status: p.status,
        purchaseType: p.purchaseType,
        amount: p.amount,
        currency: p.currency,
        purchasedAt: p.purchasedAt,
        expiresAt: p.expiresAt
      }))
    });
    
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch purchases',
      details: error.message
    });
  }
});

export default router;
