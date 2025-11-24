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
 * GET /api/enorett?word=X
 * Look up a Swedish word
 */
router.get('/', async (req, res) => {
  try {
    const { word } = req.query;
    
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
      return res.json({
        success: true,
        word: entry.word,
        article: entry.article,
        translation: entry.translation,
        confidence: 'high',
        source: 'dictionary',
        explanation: `Från ordbok: ${entry.word} = ${entry.translation}`,
        ...(entry.frequency && { frequency: entry.frequency })
      });
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

export default router;

