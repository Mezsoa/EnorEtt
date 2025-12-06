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
        response.examples = entry.examples || await getExampleSentences(entry.word, entry.article);
        response.pronunciation = entry.pronunciation || await getPronunciation(entry.word);
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
 * Extended database of example sentences for common Swedish words
 */
const exampleDatabase = {
  // Common nouns (en-words)
  'bil': ['Jag köpte en bil igår.', 'Bilen är röd och snabb.', 'Vi åker med bilen till jobbet.'],
  'bok': ['Jag läser en bok om historia.', 'Boken är mycket intressant.', 'Har du läst den här boken?'],
  'hund': ['Min hund är mycket snäll.', 'Hunden leker i trädgården.', 'Jag går ut med hunden varje dag.'],
  'katt': ['Katten sover på soffan.', 'Min katt älskar att leka.', 'Katten jagar en mus.'],
  'stol': ['Sitt på stolen där.', 'Stolen är bekväm.', 'Jag behöver en ny stol.'],
  'dörr': ['Öppna dörren, tack.', 'Dörren är stängd.', 'Han gick genom dörren.'],
  'fönster': ['Öppna fönstret för att få luft.', 'Fönstret är stort.', 'Jag tittar ut genom fönstret.'],
  'väg': ['Vägen är lång.', 'Vi följer denna väg.', 'Vägen leder till staden.'],
  'stad': ['Stockholm är en stor stad.', 'Jag bor i en liten stad.', 'Staden har många invånare.'],
  'land': ['Sverige är ett vackert land.', 'Landet är stort.', 'Jag reser till ett nytt land.'],
  'sjö': ['Sjön är vacker.', 'Vi simmar i sjön.', 'Sjön ligger nära skogen.'],
  'skog': ['Skogen är tät.', 'Vi går genom skogen.', 'Skogen är full av träd.'],
  'träd': ['Trädet är högt.', 'Jag sitter under trädet.', 'Trädet blommar på våren.'],
  'blomma': ['Blomman är vacker.', 'Jag plockar en blomma.', 'Blomman doftar gott.'],
  'mat': ['Maten är god.', 'Jag lagar mat varje dag.', 'Vill du ha mer mat?'],
  'vatten': ['Vattnet är kallt.', 'Jag dricker vatten.', 'Vattnet rinner i floden.'],
  'kaffe': ['Kaffet är varmt.', 'Jag dricker kaffe på morgonen.', 'Kaffet smakar gott.'],
  'te': ['Teet är varmt.', 'Jag dricker te med mjölk.', 'Teet hjälper mig att slappna av.'],
  'bröd': ['Brödet är nybakat.', 'Jag äter bröd till frukost.', 'Brödet smakar gott med smör.'],
  'äpple': ['Äpplet är rött.', 'Jag äter ett äpple.', 'Äpplet är sött och saftigt.'],
  'skola': ['Skolan börjar klockan åtta.', 'Jag går i skolan varje dag.', 'Skolan ligger nära hemmet.'],
  'lärare': ['Läraren är snäll.', 'Min lärare undervisar i svenska.', 'Läraren hjälper eleverna.'],
  'elev': ['Eleven läser en bok.', 'Eleven svarar på frågan.', 'Eleven är duktig.'],
  'vän': ['Min vän är snäll.', 'Jag träffar min vän idag.', 'Vännen hjälper mig.'],
  'familj': ['Familjen är stor.', 'Jag älskar min familj.', 'Familjen samlas på julafton.'],
  'mor': ['Min mor lagar mat.', 'Morn är snäll.', 'Jag ringer min mor.'],
  'far': ['Min far arbetar hårt.', 'Farn är stark.', 'Jag träffar min far.'],
  'bror': ['Brodern är äldre än jag.', 'Jag spelar med min bror.', 'Brodern hjälper mig.'],
  'syster': ['Systern är yngre än jag.', 'Jag går med min syster.', 'Systern är snäll.'],
  
  // Common nouns (ett-words)
  'hus': ['Vi bor i ett hus.', 'Huset är stort och vackert.', 'Huset har många rum.'],
  'barn': ['Barnet leker i trädgården.', 'Ett barn springer på gatan.', 'Barnet är glad och leker.'],
  'bord': ['Bordet är stort.', 'Jag sitter vid bordet.', 'Bordet är gjort av trä.'],
  'djur': ['Djuret är snällt.', 'Ett djur springer i skogen.', 'Djuret äter gräs.'],
  'får': ['Fåret betar på ängen.', 'Ett får är vitt.', 'Fåret ger ull.'],
  'lamm': ['Lammet är litet.', 'Ett lamm leker på fältet.', 'Lammet är sött.'],
  'ägg': ['Ägget är stort.', 'Jag äter ett ägg.', 'Ägget är kokt.'],
  'öga': ['Ögat är blått.', 'Jag har ett öga.', 'Ögat ser bra.'],
  'öra': ['Örat är stort.', 'Jag har ett öra.', 'Örat hör bra.'],
  'hjärta': ['Hjärtat slår snabbt.', 'Jag har ett hjärta.', 'Hjärtat är viktigt.'],
  'huvud': ['Huvudet är stort.', 'Jag har ett huvud.', 'Huvudet innehåller hjärnan.'],
  'problem': ['Problemet är svårt.', 'Jag har ett problem.', 'Problemet måste lösas.'],
  'svar': ['Svaret är rätt.', 'Jag har ett svar.', 'Svaret hjälper mig.'],
  'beslut': ['Beslutet är taget.', 'Jag fattar ett beslut.', 'Beslutet är viktigt.'],
  'liv': ['Livet är vackert.', 'Jag lever ett liv.', 'Livet är kort.'],
  'mål': ['Målet är högt.', 'Jag har ett mål.', 'Målet är att vinna.'],
  'system': ['Systemet fungerar bra.', 'Jag använder ett system.', 'Systemet är komplext.'],
  'program': ['Programmet är intressant.', 'Jag tittar på ett program.', 'Programmet börjar snart.'],
  'rum': ['Rummet är stort.', 'Jag bor i ett rum.', 'Rummet är ljust.'],
  'badrum': ['Badrummet är rent.', 'Jag går till badrummet.', 'Badrummet har en dusch.'],
  'kök': ['Köket är stort.', 'Jag lagar mat i köket.', 'Köket är modernt.'],
  'sovrum': ['Sovrummet är bekvämt.', 'Jag sover i sovrummet.', 'Sovrummet är mörkt.'],
  'vardagsrum': ['Vardagsrummet är stort.', 'Jag sitter i vardagsrummet.', 'Vardagsrummet har en soffa.'],
};

/**
 * Extended database of IPA pronunciations for common Swedish words
 */
const pronunciationDatabase = {
  // Common nouns (en-words)
  'bil': 'biːl',
  'bok': 'buːk',
  'hund': 'hɵnd',
  'katt': 'katː',
  'stol': 'stuːl',
  'dörr': 'dœrː',
  'fönster': 'ˈfœnstɛr',
  'väg': 'vɛːɡ',
  'stad': 'stɑːd',
  'land': 'land',
  'sjö': 'ɧøː',
  'skog': 'skuːɡ',
  'träd': 'trɛːd',
  'blomma': 'ˈblɔmːa',
  'mat': 'mɑːt',
  'vatten': 'ˈvatːɛn',
  'kaffe': 'ˈkafːɛ',
  'te': 'teː',
  'bröd': 'brøːd',
  'äpple': 'ˈɛpːlɛ',
  'skola': 'ˈskuːla',
  'lärare': 'ˈlɛːrarɛ',
  'elev': 'eˈleːv',
  'vän': 'vɛːn',
  'familj': 'faˈmɪlj',
  'mor': 'muːr',
  'far': 'fɑːr',
  'bror': 'bruːr',
  'syster': 'ˈsʏstɛr',
  
  // Common nouns (ett-words)
  'hus': 'hʉːs',
  'barn': 'bɑːɳ',
  'bord': 'buːɖ',
  'djur': 'jʉːr',
  'får': 'foːr',
  'lamm': 'lamː',
  'ägg': 'ɛɡː',
  'öga': 'ˈøːɡa',
  'öra': 'ˈøːra',
  'hjärta': 'ˈjɛrːta',
  'huvud': 'ˈhʉːvɵd',
  'problem': 'prʊˈbleːm',
  'svar': 'svɑːr',
  'beslut': 'bɛˈslʉːt',
  'liv': 'liːv',
  'mål': 'moːl',
  'system': 'sʏˈsteːm',
  'program': 'prʊˈɡram',
  'telefon': 'tɛlɛˈfoːn',
  'dator': 'ˈdɑːtʊr',
  'fönster': 'ˈfœnstɛr',
  'rum': 'rɵmː',
  'badrum': 'ˈbɑːdrɵmː',
  'kök': 'ɕøːk',
  'sovrum': 'ˈsoːvrɵmː',
  'vardagsrum': 'ˈvɑːɖaɡsˌrɵmː',
};

/**
 * Get example sentences for a word (Pro feature)
 * First checks local database, then tries Wiktionary API as fallback
 */
async function getExampleSentences(word, article) {
  const normalizedWord = word.toLowerCase();
  
  // Check local database first
  if (exampleDatabase[normalizedWord]) {
    return exampleDatabase[normalizedWord];
  }
  
  // Try to fetch from Wiktionary API as fallback
  try {
    const examples = await fetchExamplesFromWiktionary(normalizedWord);
    if (examples && examples.length > 0) {
      return examples;
    }
  } catch (error) {
    console.log(`Could not fetch examples from Wiktionary for ${word}:`, error.message);
  }
  
  // Fallback: Generate a simple example sentence
  const articleWord = article === 'en' ? 'en' : 'ett';
  const capitalizedWord = word.charAt(0).toUpperCase() + word.slice(1);
  if (article === 'en') {
    return [`Detta är ${articleWord} ${word}.`, `${capitalizedWord}en är viktig.`];
  } else {
    return [`Detta är ${articleWord} ${word}.`, `${capitalizedWord}et är viktigt.`];
  }
}

/**
 * Get pronunciation guide for a word (Pro feature)
 * First checks local database, then tries Wiktionary API as fallback
 */
async function getPronunciation(word) {
  const normalizedWord = word.toLowerCase();
  
  // Check local database first
  if (pronunciationDatabase[normalizedWord]) {
    return `[${pronunciationDatabase[normalizedWord]}]`;
  }
  
  // Try to fetch from Wiktionary API as fallback
  try {
    const pronunciation = await fetchPronunciationFromWiktionary(normalizedWord);
    if (pronunciation) {
      return `[${pronunciation}]`;
    }
  } catch (error) {
    console.log(`Could not fetch pronunciation from Wiktionary for ${word}:`, error.message);
  }
  
  // Fallback: Return word in brackets (indicates no pronunciation available)
  return null;
}

/**
 * Fetch example sentences from Wiktionary API
 */
async function fetchExamplesFromWiktionary(word) {
  try {
    // Wiktionary API endpoint for Swedish
    const url = `https://sv.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'EnorEtt/1.0 (https://enorett.se)'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    // Extract example sentences from Swedish definitions
    if (data.sv && Array.isArray(data.sv)) {
      const examples = [];
      for (const entry of data.sv) {
        if (entry.examples && Array.isArray(entry.examples)) {
          for (const example of entry.examples) {
            if (example.text) {
              examples.push(example.text);
            }
          }
        }
      }
      if (examples.length > 0) {
        return examples.slice(0, 3); // Return max 3 examples
      }
    }
    
    return null;
  } catch (error) {
    console.error('Wiktionary API error:', error);
    return null;
  }
}

/**
 * Fetch IPA pronunciation from Wiktionary API
 */
async function fetchPronunciationFromWiktionary(word) {
  try {
    // Wiktionary API endpoint for Swedish
    const url = `https://sv.wiktionary.org/api/rest_v1/page/pronunciation/${encodeURIComponent(word)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'EnorEtt/1.0 (https://enorett.se)'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    // Extract IPA pronunciation
    if (data.sv && Array.isArray(data.sv)) {
      for (const entry of data.sv) {
        if (entry.phonetic && entry.phonetic.length > 0) {
          // Return first IPA pronunciation
          return entry.phonetic[0];
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Wiktionary pronunciation API error:', error);
    return null;
  }
}

export default router;

