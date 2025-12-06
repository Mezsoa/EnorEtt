/**
 * EnorEtt API Routes
 * Handles word lookup requests
 */

import express from 'express';
import { connectDB } from '../db/connection.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * GET /api/enorett
 * Lookup a Swedish word to determine if it takes "en" or "ett"
 */
router.get('/', async (req, res) => {
  try {
    const { word, pro, userId } = req.query;
    
    if (!word) {
      return res.status(400).json({
        success: false,
        error: 'Missing word parameter',
        errorSv: 'Saknar ord-parameter'
      });
    }
    
    // Normalize word
    const normalizedWord = word.trim().toLowerCase();
    
    // Check if user is Pro (if userId provided)
    let isProUser = false;
    if (userId && pro === 'true') {
      try {
        await connectDB();
        const user = await User.findOne({ userId });
        if (user) {
          // Check if user has active purchase
          const Purchase = (await import('../models/Purchase.js')).default;
          const purchase = await Purchase.findActivePurchase(user.userId);
          isProUser = purchase && purchase.isActive();
        }
      } catch (e) {
        console.warn('Error checking Pro status:', e);
      }
    }
    
    // Simple dictionary lookup (you can expand this)
    const dictionary = {
      'bil': { article: 'en', translation: 'car' },
      'hus': { article: 'ett', translation: 'house' },
      'bok': { article: 'en', translation: 'book' },
      'barn': { article: 'ett', translation: 'child' },
      // Add more words as needed
    };
    
    const result = dictionary[normalizedWord];
    
    if (result) {
      return res.json({
        success: true,
        word: normalizedWord,
        article: result.article,
        translation: result.translation,
        confidence: 'high',
        source: 'dictionary'
      });
    }
    
    // If Pro user, could use AI/API here
    if (isProUser) {
      // TODO: Implement Pro API lookup
      return res.json({
        success: false,
        error: 'Word not found in dictionary',
        errorSv: 'Ordet finns inte i ordboken',
        requiresPro: false
      });
    }
    
    // Word not found
    return res.json({
      success: false,
      error: 'Word not found in dictionary',
      errorSv: 'Ordet finns inte i ordboken',
      requiresPro: !isProUser,
      suggestion: isProUser ? null : 'Upgrade to Pro för 10,000+ ord'
    });
    
  } catch (error) {
    console.error('Error in enorett lookup:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      errorSv: 'Ett serverfel uppstod',
      details: error.message
    });
  }
});

export default router;
