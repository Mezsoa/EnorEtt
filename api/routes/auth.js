/**
 * Authentication Routes
 * Handles user registration, login, and authentication
 */

import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import Purchase from '../models/Purchase.js';
import { connectDB } from '../db/connection.js';

const router = express.Router();

// Simple password hashing (using crypto instead of bcrypt for simplicity)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, hashedPassword) {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Generate simple token (in production, use JWT)
function generateToken(userId) {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }
    
    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }
    
    // Try to connect to database
    try {
      await connectDB();
    } catch (dbError) {
      console.error('Database connection failed:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Database connection failed. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }
    
    // Check if database is available
    const mongoose = (await import('mongoose')).default;
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        error: 'Database not available. Please try again later.'
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }
    
    // Create userId based on email
    const userId = `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // Hash password
    const hashedPassword = hashPassword(password);
    
    // Create user
    const user = new User({
      userId,
      email,
      password: hashedPassword
    });
    
    await user.save();
    
    // Generate token
    const token = generateToken(userId);
    
    res.json({
      success: true,
      user: {
        userId: user.userId,
        email: user.email
      },
      token
    });
    
  } catch (error) {
    console.error('Error registering user:', error);
    
    // Handle specific MongoDB errors
    if (error.name === 'MongoServerError' && error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to register user',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    // Try to connect to database
    try {
      await connectDB();
    } catch (dbError) {
      console.error('Database connection failed:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Database connection failed. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }
    
    // Check if database is available
    const mongoose = (await import('mongoose')).default;
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        error: 'Database not available. Please try again later.'
      });
    }
    
    // Find user by email (include password field)
    const user = await User.findOne({ email }).select('+password');
    
    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    // Verify password
    if (!verifyPassword(password, user.password)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    // Generate token
    const token = generateToken(user.userId);
    
    // Get active subscription
    let purchase = null;
    try {
      purchase = await Purchase.findActivePurchase(user.userId);
    } catch (purchaseError) {
      console.warn('Error fetching purchase:', purchaseError);
      // Continue without purchase info
    }
    
    res.json({
      success: true,
      user: {
        userId: user.userId,
        email: user.email,
        stats: user.stats,
        preferences: user.preferences
      },
      token,
      subscription: purchase ? {
        status: purchase.status,
        plan: purchase.plan,
        expiresAt: purchase.expiresAt ? purchase.expiresAt.toISOString() : null,
        purchaseType: purchase.purchaseType
      } : null
    });
    
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user (requires token in header)
 */
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = req.headers['x-user-id']; // Simple auth for now
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    // Try to connect to database
    try {
      await connectDB();
    } catch (dbError) {
      console.error('Database connection failed:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Database connection failed. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }
    
    // Check if database is available
    const mongoose = (await import('mongoose')).default;
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        error: 'Database not available. Please try again later.'
      });
    }
    
    const user = await User.findOne({ userId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Get active subscription
    let purchase = null;
    try {
      purchase = await Purchase.findActivePurchase(user.userId);
    } catch (purchaseError) {
      console.warn('Error fetching purchase:', purchaseError);
      // Continue without purchase info
    }
    
    res.json({
      success: true,
      user: {
        userId: user.userId,
        email: user.email,
        stats: user.stats,
        preferences: user.preferences
      },
      subscription: purchase ? {
        status: purchase.status,
        plan: purchase.plan,
        expiresAt: purchase.expiresAt ? purchase.expiresAt.toISOString() : null,
        purchaseType: purchase.purchaseType
      } : null
    });
    
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
    });
  }
});

export default router;
