/**
 * EnorEtt API Routes
 * Handles word lookup requests
 */

import express from 'express';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const router = express.Router();

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load dictionary (could be expanded beyond the extension's dictionary)
let dictionary = [];
let dictionaryLoaded = false;

/**
 * Load dictionary on startup
 */
async function loadDictionary() {
  if (dictionaryLoaded) return;
  
  try {
    // In production, you might load from a database or larger file
    // For now, we'll use a simplified approach
    dictionary = getExtendedDictionary();
    dictionaryLoaded = true;
    console.log(`Dictionary loaded: ${dictionary.length} words`);
  } catch (error) {
    console.error('Error loading dictionary:', error);
  }
}

/**
 * Extended dictionary (can be much larger than the extension's)
 * In production, this would come from a database or comprehensive file
 */
function getExtendedDictionary() {
  // This is a placeholder - in reality, you'd load a comprehensive dictionary
  // For now, return a subset for demonstration
  return [
    { word: "bil", article: "en", translation: "car", frequency: "high" },
    { word: "hus", article: "ett", translation: "house", frequency: "high" },
    { word: "bok", article: "en", translation: "book", frequency: "high" },
    { word: "barn", article: "ett", translation: "child", frequency: "high" },
    { word: "hund", article: "en", translation: "dog", frequency: "high" },
    { word: "katt", article: "en", translation: "cat", frequency: "high" },
    { word: "bord", article: "ett", translation: "table", frequency: "high" },
    { word: "stol", article: "en", translation: "chair", frequency: "high" },
    // ... add more words here or load from external source
  ];
}

// Initialize dictionary
loadDictionary();

/**
 * Middleware to verify Pro subscription
 */
async function verifyProSubscription(req, res, next) {
  const { pro, userId } = req.query;
  
  // Only check if pro flag is set and userId is provided
  if (pro === 'true' && userId) {
    try {
      // Import here to avoid circular dependencies
      const Purchase = (await import('../models/Purchase.js')).default;
      const User = (await import('../models/User.js')).default;
      const { connectDB } = await import('../db/connection.js');
      
      // Ensure database connection
      await connectDB();
      
      // Find or create user (to track usage)
      const user = await User.findOrCreate(userId);
      
      // Update user's last seen (async, don't wait)
      user.updateLastSeen().catch(() => {});
      
      // Check for active purchase in database
      const purchase = await Purchase.findActivePurchase(userId);
      
      if (purchase && purchase.isActive()) {
        req.isPro = true;
      } else {
        req.isPro = false;
      }
    } catch (error) {
      console.error('Error verifying Pro subscription:', error);
      // On error, default to false for security
      req.isPro = false;
    }
  } else {
    req.isPro = false;
  }
  
  next();
}

/**
 * GET /api/enorett?word=X
 * Look up a Swedish word
 */
router.get('/', verifyProSubscription, async (req, res) => {
  try {
    const { word } = req.query;
    const isPro = req.isPro;
    
    // Validate input
    if (!word) {
      return res.status(400).json({
        success: false,
        error: 'Missing word parameter',
        errorSv: 'Saknar ordparameter',
        usage: '/api/enorett?word=bil'
      });
    }
    
    // Normalize word
    const normalizedWord = word.trim().toLowerCase();
    
    // Check for multiple words
    if (normalizedWord.includes(' ')) {
      return res.status(400).json({
        success: false,
        error: 'Please provide only one word',
        errorSv: 'Vänligen ange endast ett ord'
      });
    }
    
    // Look up in dictionary
    const entry = dictionary.find(e => e.word === normalizedWord);
    
    if (entry) {
      const response = {
        success: true,
        word: entry.word,
        article: entry.article,
        translation: entry.translation,
        confidence: 'high',
        source: 'dictionary',
        explanation: `Från ordbok: ${entry.word} = ${entry.translation}`,
        ...(entry.frequency && { frequency: entry.frequency })
      };
      
      // Add Pro features if user is Pro
      if (isPro) {
        response.examples = entry.examples || getExampleSentences(entry.word, entry.article);
        response.pronunciation = entry.pronunciation || getPronunciation(entry.word);
      }
      
      return res.json(response);
    }
    
    // Pattern-based fallback
    const patternResult = detectByPattern(normalizedWord);
    
    if (patternResult) {
      return res.json({
        success: true,
        word: normalizedWord,
        article: patternResult.article,
        confidence: 'medium',
        source: 'pattern',
        explanation: `Baserat på ändelsen "${patternResult.suffix}"`,
        warning: 'Detta är en gissning baserad på ordmönster'
      });
    }
    
    // Word not found
    return res.status(404).json({
      success: false,
      word: normalizedWord,
      error: 'Word not found',
      errorSv: 'Ordet finns inte i ordboken',
      suggestion: 'Statistiskt sett är ~70% av svenska ord "en-ord"',
      confidence: 'none'
    });
    
  } catch (error) {
    console.error('Lookup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      errorSv: 'Ett serverfel uppstod'
    });
  }
});

/**
 * POST /api/enorett/batch
 * Look up multiple words at once
 */
router.post('/batch', async (req, res) => {
  try {
    const { words } = req.body;
    
    if (!words || !Array.isArray(words)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid words array',
        errorSv: 'Saknar eller ogiltig ordlista'
      });
    }
    
    if (words.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Too many words (max 50)',
        errorSv: 'För många ord (max 50)'
      });
    }
    
    const results = [];
    
    for (const word of words) {
      const normalizedWord = word.trim().toLowerCase();
      const entry = dictionary.find(e => e.word === normalizedWord);
      
      if (entry) {
        results.push({
          word: entry.word,
          article: entry.article,
          translation: entry.translation,
          confidence: 'high'
        });
      } else {
        const patternResult = detectByPattern(normalizedWord);
        if (patternResult) {
          results.push({
            word: normalizedWord,
            article: patternResult.article,
            confidence: 'medium'
          });
        } else {
          results.push({
            word: normalizedWord,
            article: null,
            confidence: 'none'
          });
        }
      }
    }
    
    return res.json({
      success: true,
      count: results.length,
      results: results
    });
    
  } catch (error) {
    console.error('Batch lookup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      errorSv: 'Ett serverfel uppstod'
    });
  }
});

/**
 * GET /api/enorett/stats
 * Get dictionary statistics
 */
router.get('/stats', (req, res) => {
  const enWords = dictionary.filter(e => e.article === 'en').length;
  const ettWords = dictionary.filter(e => e.article === 'ett').length;
  
  res.json({
    success: true,
    total: dictionary.length,
    en: enWords,
    ett: ettWords,
    enPercentage: ((enWords / dictionary.length) * 100).toFixed(1),
    ettPercentage: ((ettWords / dictionary.length) * 100).toFixed(1)
  });
});

/**
 * Pattern detection helper
 * Same logic as the extension for consistency
 */
function detectByPattern(word) {
  const patterns = {
    en: [
      { regex: /-are$/, suffix: '-are' },
      { regex: /-ing$/, suffix: '-ing' },
      { regex: /-het$/, suffix: '-het' },
      { regex: /-else$/, suffix: '-else' },
      { regex: /-tion$/, suffix: '-tion' },
      { regex: /-dom$/, suffix: '-dom' },
      { regex: /-skap$/, suffix: '-skap' },
    ],
    ett: [
      { regex: /-ium$/, suffix: '-ium' },
      { regex: /-ande$/, suffix: '-ande' },
      { regex: /-ende$/, suffix: '-ende' },
      { regex: /-eri$/, suffix: '-eri' },
      { regex: /-ment$/, suffix: '-ment' },
      { regex: /-em$/, suffix: '-em' },
    ]
  };
  
  // Check en-patterns
  for (const pattern of patterns.en) {
    if (pattern.regex.test(word)) {
      return { article: 'en', suffix: pattern.suffix };
    }
  }
  
  // Check ett-patterns
  for (const pattern of patterns.ett) {
    if (pattern.regex.test(word)) {
      return { article: 'ett', suffix: pattern.suffix };
    }
  }
  
  return null;
}

/**
 * Get example sentences for a word (Pro feature)
 */
function getExampleSentences(word, article) {
  // In production, this would come from a database
  // For now, return simple examples
  const examples = {
    'bil': ['Jag köpte en bil igår.', 'Bilen är röd.'],
    'hus': ['Vi bor i ett hus.', 'Huset är stort.'],
    'bok': ['Jag läser en bok.', 'Boken är intressant.'],
    'barn': ['Ett barn leker.', 'Barnet är glad.']
  };
  
  return examples[word] || [`Detta är ${article === 'en' ? 'en' : 'ett'} ${word}.`];
}

/**
 * Get pronunciation guide for a word (Pro feature)
 */
function getPronunciation(word) {
  // In production, this would use IPA or phonetic transcription
  // For now, return a simple guide
  const pronunciations = {
    'bil': '[bi:l]',
    'hus': '[hʉ:s]',
    'bok': '[bu:k]',
    'barn': '[bɑ:ɳ]'
  };
  
  return pronunciations[word] || `[${word}]`;
}

export default router;

