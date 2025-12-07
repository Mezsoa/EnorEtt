/**
 * EnorEtt API Routes
 * Handles word lookup requests
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { connectDB } from '../db/connection.js';
import User from '../models/User.js';

const router = express.Router();

// Resolve paths for loading the large dictionary that already ships with the extension
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

// Cache dictionaries in-memory to avoid rereads per request
let fullDictionaryCache = null;
let freeDictionaryCache = null;
const externalCache = new Map(); // word -> { data, expiresAt }

// External dictionary configuration (for premium features)
const EXTERNAL_API_BASE = process.env.DICT_API_BASE;
const EXTERNAL_API_KEY = process.env.DICT_API_KEY;
const EXTERNAL_API_HOST = process.env.DICT_API_HOST; // Optional (e.g. RapidAPI host header)
const EXTERNAL_API_LANG = process.env.DICT_API_LANG || 'sv';
const EXTERNAL_TIMEOUT_MS = Number(process.env.DICT_API_TIMEOUT_MS || 6000);
const EXTERNAL_CACHE_TTL_MS = Number(process.env.DICT_API_CACHE_TTL_MS || 6 * 60 * 60 * 1000); // 6h default

// Pronunciation/audio provider (optional, e.g. Forvo/RapidAPI)
const PRON_API_BASE = process.env.PRON_API_BASE;
const PRON_API_KEY = process.env.PRON_API_KEY;
const PRON_API_HOST = process.env.PRON_API_HOST;
const PRON_API_LANG = process.env.PRON_API_LANG || 'sv';
const PRON_API_TIMEOUT_MS = Number(process.env.PRON_API_TIMEOUT_MS || 6000);
const PRON_API_CACHE_TTL_MS = Number(process.env.PRON_API_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
const pronunciationCache = new Map(); // word -> { data, expiresAt }

/**
 * Load the full dictionary used by the extension (utils/dictionary.js) into Node.
 * We sandbox-evaluate the file to extract the `dictionary` variable without changing the extension code.
 */
function loadFullDictionary() {
  if (fullDictionaryCache) return fullDictionaryCache;

  const dictionaryPath = path.join(ROOT_DIR, 'utils', 'dictionary.js');
  try {
    const code = fs.readFileSync(dictionaryPath, 'utf-8');
    const sandbox = {};
    vm.createContext(sandbox);
    // Execute file to populate sandbox.dictionary
    vm.runInContext(code, sandbox, { filename: dictionaryPath });
    if (Array.isArray(sandbox.dictionary)) {
      fullDictionaryCache = sandbox.dictionary;
    } else {
      throw new Error('dictionary variable not found or invalid in utils/dictionary.js');
    }
  } catch (err) {
    console.error('Failed to load full dictionary:', err);
    // Fallback to the tiny inline dictionary so API still responds
    fullDictionaryCache = [
      { word: 'bil', article: 'en', translation: 'car' },
      { word: 'hus', article: 'ett', translation: 'house' },
      { word: 'bok', article: 'en', translation: 'book' },
      { word: 'barn', article: 'ett', translation: 'child' }
    ];
  }
  return fullDictionaryCache;
}

/**
 * Provide a trimmed free tier dictionary (first N entries) to keep the upgrade value.
 */
function getFreeDictionary(limit = 250) {
  if (freeDictionaryCache) return freeDictionaryCache;
  const full = loadFullDictionary();
  freeDictionaryCache = full.slice(0, Math.min(limit, full.length));
  return freeDictionaryCache;
}

/**
 * Fetch helper with timeout
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = EXTERNAL_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse external dictionary response in a provider-agnostic way.
 * Tries common shapes (entries/results arrays).
 */
function parseExternalDictionaryPayload(payload, normalizedWord) {
  if (!payload) return null;

  const entries = Array.isArray(payload.entries)
    ? payload.entries
    : Array.isArray(payload.results)
      ? payload.results
      : Array.isArray(payload)
        ? payload
        : [];

  const candidate = entries.find(e => (e.word || e.lemma || e.id || '').toLowerCase() === normalizedWord) || entries[0];
  if (!candidate) return null;

  // Extract fields with fallbacks
  const translation =
    candidate.translation ||
    candidate.gloss ||
    candidate.meaning ||
    (Array.isArray(candidate.senses) && candidate.senses[0]?.glosses?.[0]) ||
    null;

  const examples =
    candidate.examples ||
    (Array.isArray(candidate.senses) && candidate.senses[0]?.examples) ||
    (Array.isArray(candidate.examples) ? candidate.examples : null) ||
    null;

  const pronunciation =
    candidate.pronunciation ||
    (candidate.pronunciations && (candidate.pronunciations.ipa || candidate.pronunciations.text)) ||
    null;

  const audioUrl =
    candidate.audio ||
    candidate.audioUrl ||
    (candidate.pronunciations && candidate.pronunciations.audio) ||
    null;

  // Article detection (best-effort) — look for leading "en"/"ett" markers
  let article = null;
  if (candidate.article) {
    article = candidate.article;
  } else if (Array.isArray(candidate.senses)) {
    const gloss = candidate.senses[0]?.glosses?.join(' ') || '';
    if (/^en\s/i.test(gloss)) article = 'en';
    if (/^ett\s/i.test(gloss)) article = 'ett';
  }

  return {
    word: (candidate.word || candidate.lemma || candidate.id || normalizedWord).toLowerCase(),
    article,
    translation: translation || null,
    examples: Array.isArray(examples) ? examples : null,
    pronunciation: pronunciation || null,
    audioUrl: audioUrl || null,
    source: 'external_api'
  };
}

/**
 * Fetch from external dictionary API (Pro only)
 */
async function fetchExternalDictionary(normalizedWord) {
  if (!EXTERNAL_API_BASE || !EXTERNAL_API_KEY) return null;

  const cacheHit = externalCache.get(normalizedWord);
  if (cacheHit && cacheHit.expiresAt > Date.now()) {
    return cacheHit.data;
  }

  const url = `${EXTERNAL_API_BASE.replace(/\/$/, '')}?word=${encodeURIComponent(normalizedWord)}&lang=${encodeURIComponent(EXTERNAL_API_LANG)}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${EXTERNAL_API_KEY}`
  };
  if (EXTERNAL_API_HOST) {
    headers['X-RapidAPI-Host'] = EXTERNAL_API_HOST;
    headers['X-RapidAPI-Key'] = EXTERNAL_API_KEY;
    delete headers.Authorization; // RapidAPI typically uses this header instead
  }

  try {
    const response = await fetchWithTimeout(url, { method: 'GET', headers });
    if (!response.ok) {
      throw new Error(`External API error: ${response.status}`);
    }
    const payload = await response.json();
    const parsed = parseExternalDictionaryPayload(payload, normalizedWord);
    if (parsed) {
      externalCache.set(normalizedWord, {
        data: parsed,
        expiresAt: Date.now() + EXTERNAL_CACHE_TTL_MS
      });
      return parsed;
    }
  } catch (err) {
    console.warn('External dictionary fetch failed:', err.message);
  }

  return null;
}

/**
 * Parse pronunciation/audio payload (provider-agnostic, Forvo-friendly)
 */
function parsePronunciationPayload(payload, normalizedWord) {
  if (!payload) return null;

  const entries = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.results)
      ? payload.results
      : Array.isArray(payload.pronunciations)
        ? payload.pronunciations
        : Array.isArray(payload)
          ? payload
          : [];

  const candidate = entries.find(e => (e.word || e.term || e.id || '').toLowerCase() === normalizedWord) || entries[0];
  if (!candidate) return null;

  const audioUrl =
    candidate.pathmp3 ||
    candidate.mp3 ||
    candidate.audio ||
    candidate.audioUrl ||
    candidate.url ||
    (candidate.urls && (candidate.urls.mp3 || candidate.urls.ogg)) ||
    null;

  const pronunciation =
    candidate.pronunciation ||
    candidate.ipa ||
    (candidate.transcriptions && (candidate.transcriptions.ipa || candidate.transcriptions.text)) ||
    null;

  if (!audioUrl && !pronunciation) return null;

  return {
    word: (candidate.word || candidate.term || candidate.id || normalizedWord).toLowerCase(),
    pronunciation: pronunciation || null,
    audioUrl: audioUrl || null,
    source: 'external_pron'
  };
}

/**
 * Fetch pronunciation/audio from external provider (Pro only)
 */
async function fetchPronunciation(normalizedWord) {
  if (!PRON_API_BASE || !PRON_API_KEY) return null;

  const cacheHit = pronunciationCache.get(normalizedWord);
  if (cacheHit && cacheHit.expiresAt > Date.now()) {
    return cacheHit.data;
  }

  const url = `${PRON_API_BASE.replace(/\/$/, '')}?word=${encodeURIComponent(normalizedWord)}&lang=${encodeURIComponent(PRON_API_LANG)}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${PRON_API_KEY}`
  };
  if (PRON_API_HOST) {
    headers['X-RapidAPI-Host'] = PRON_API_HOST;
    headers['X-RapidAPI-Key'] = PRON_API_KEY;
    delete headers.Authorization;
  }

  try {
    const response = await fetchWithTimeout(url, { method: 'GET', headers }, PRON_API_TIMEOUT_MS);
    if (!response.ok) {
      throw new Error(`Pronunciation API error: ${response.status}`);
    }
    const payload = await response.json();
    const parsed = parsePronunciationPayload(payload, normalizedWord);
    if (parsed) {
      pronunciationCache.set(normalizedWord, {
        data: parsed,
        expiresAt: Date.now() + PRON_API_CACHE_TTL_MS
      });
      return parsed;
    }
  } catch (err) {
    console.warn('Pronunciation fetch failed:', err.message);
  }

  return null;
}

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
          const Purchase = (await import('../models/Purchase.js')).default;
          const purchase = await Purchase.findActivePurchase(user.userId);
          isProUser = purchase && purchase.isActive();
        }
      } catch (e) {
        console.warn('Error checking Pro status:', e);
      }
    }
    
    // Load dictionaries
    const fullDictionary = loadFullDictionary();
    const freeDictionary = getFreeDictionary();

    // Try exact match in free dictionary
    const freeHit = freeDictionary.find(entry => entry.word === normalizedWord);
    if (freeHit) {
      return res.json({
        success: true,
        word: freeHit.word,
        article: freeHit.article,
        translation: freeHit.translation,
        confidence: 'high',
        source: 'dictionary_free'
      });
    }

    // Check if word exists in full dictionary (Pro scope)
    const proHit = fullDictionary.find(entry => entry.word === normalizedWord);
    if (proHit) {
      if (!isProUser) {
        return res.json({
          success: false,
          error: 'Word available for Premium users',
          errorSv: 'Ordet finns tillgängligt för Premium-användare',
          requiresPro: true,
          suggestion: 'Upgrade to Pro för tillgång till fler ord'
        });
      }

      // Enrich with pronunciation/audio if available
      let pronunciationData = null;
      if (isProUser) {
        pronunciationData = await fetchPronunciation(normalizedWord);
      }

      return res.json({
        success: true,
        word: proHit.word,
        article: proHit.article,
        translation: proHit.translation,
        pronunciation: pronunciationData?.pronunciation || null,
        audioUrl: pronunciationData?.audioUrl || null,
        confidence: 'high',
        source: 'dictionary_pro'
      });
    }
    
    // Pro users: try external dictionary API for richer data (examples/uttal)
    if (isProUser) {
      const externalResult = await fetchExternalDictionary(normalizedWord);
      let pronunciationData = null;
      if (!externalResult?.audioUrl || !externalResult?.pronunciation) {
        pronunciationData = await fetchPronunciation(normalizedWord);
      }

      if (externalResult) {
        const article = externalResult.article || null;
        const translation = externalResult.translation || null;
        const pronunciation = externalResult.pronunciation || pronunciationData?.pronunciation || null;
        const audioUrl = externalResult.audioUrl || pronunciationData?.audioUrl || null;
        const examples = externalResult.examples;

        const hasContent = article || translation || (examples && examples.length > 0) || pronunciation || audioUrl;
        if (!hasContent) {
          // Treat as not found if nothing useful returned
          return res.json({
            success: false,
            error: 'Word not found in dictionary',
            errorSv: 'Ordet finns inte i ordboken',
            requiresPro: false
          });
        }

        return res.json({
          success: true,
          word: externalResult.word,
          article,
          translation,
          pronunciation,
          audioUrl,
          examples,
          confidence: article ? 'medium' : 'low',
          source: externalResult.source
        });
      }

      if (pronunciationData) {
        return res.json({
          success: true,
          word: normalizedWord,
          article: null,
          translation: null,
          pronunciation: pronunciationData.pronunciation,
          audioUrl: pronunciationData.audioUrl,
          examples: null,
          confidence: 'low',
          source: pronunciationData.source
        });
      }

      return res.json({
        success: false,
        error: 'Word not found in dictionary',
        errorSv: 'Ordet finns inte i ordboken',
        requiresPro: false
      });
    }
    
    // Word not found and user not Pro
    return res.json({
      success: false,
      error: 'Word not found in dictionary',
      errorSv: 'Ordet finns inte i ordboken',
      requiresPro: true,
      suggestion: 'Upgrade to Pro för 10,000+ ord'
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
