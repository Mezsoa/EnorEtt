/**
 * EnorEtt API Routes
 * Handles word lookup requests using authoritative sources (Karp, NST, Korp)
 */

import express from 'express';
import { connectDB } from '../db/connection.js';
import User from '../models/User.js';
import { lookupWord } from '../utils/enorettLookup.js';

const router = express.Router();

/**
 * Check if a user has an active Pro subscription.
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function isProUser(userId) {
  if (!userId) return false;
  try {
    await connectDB();
    const user = await User.findOne({ userId });
    if (user) {
      const Purchase = (await import('../models/Purchase.js')).default;
      const purchase = await Purchase.findActivePurchase(user.userId);
      return Boolean(purchase && purchase.isActive());
    }
  } catch (error) {
    console.warn('Error checking Pro status:', error);
  }
  return false;
}

/**
 * GET /api/enorett
 * Returns article, genus, IPA and example sentences for a Swedish word.
 */
router.get('/', async (req, res) => {
  try {
    const { word, pro, userId } = req.query;

    if (!word) {
      return res.status(400).json({
        success: false,
        error: 'Missing word parameter',
        errorSv: 'Saknar ord-parameter',
      });
    }

    const normalizedWord = word.trim().toLowerCase();
    const wantsPro = pro === 'true';
    const proStatus = wantsPro ? await isProUser(userId) : false;

    const result = await lookupWord(normalizedWord, proStatus);

    // Bug 2 Fix: Check if lookup failed (has error field) or found no data
    if (result.error || (!result.article && !result.ipa && result.examples.length === 0)) {
      return res.json({
        success: false,
        word: result.word,
        error: result.error || 'Word not found',
        errorSv: result.errorSv || 'Ordet hittades inte',
        requiresPro: result.requiresPro || false,
      });
    }

    // Bug 1 Fix: If requiresPro flag is set, return error
    if (result.requiresPro) {
      return res.json({
        success: false,
        word: result.word,
        error: result.error || 'Premium subscription required',
        errorSv: result.errorSv || 'Premium-prenumeration krävs',
        requiresPro: true,
      });
    }

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error in enorett lookup:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      errorSv: 'Ett serverfel uppstod',
      details: error.message,
    });
  }
});

export default router;
