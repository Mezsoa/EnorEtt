/**
 * Sparv API client for fetching genus/article information
 * Sparv can provide MSD (morphosyntactic description) which includes genus (UTR/NEU)
 * This serves as an alternative to Karp when it's unavailable
 */

import { setTimeout as delay } from 'timers/promises';

/**
 * @typedef {Object} SparvGenusResult
 * @property {string} word - Lemma returned by Sparv (lowercased)
 * @property {'en'|'ett'|null} article - Article mapped from genus (null if unknown)
 * @property {'UTR'|'NEU'|null} genus - Genus code from MSD
 * @property {string|null} msd - Raw MSD string if present
 * @property {string|null} pos - Part-of-speech hint (e.g., "NN")
 * @property {boolean} fromCache - True if served from in-memory cache
 */

const SPARV_ENDPOINT = process.env.SPARV_ENDPOINT || 'https://ws.spraakbanken.gu.se/ws/sparv/v2/';
const DEFAULT_TIMEOUT_MS = Number(process.env.SPARV_TIMEOUT_MS || 7000);
const CACHE_TTL_MS = Number(process.env.SPARV_CACHE_TTL_MS || 12 * 60 * 60 * 1000); // 12h

/** @type {Map<string, { data: SparvGenusResult, expiresAt: number }>} */
const sparvCache = new Map();

/**
 * Fetch genus/article for a Swedish word via Sparv.
 * Creates a simple sentence with the word to get MSD annotation.
 *
 * @param {string} rawWord - Input word (any casing/spacing)
 * @returns {Promise<SparvGenusResult|null>}
 */
export async function fetchGenus(rawWord) {
  const word = (rawWord || '').trim().toLowerCase();
  if (!word) return null;

  const cached = sparvCache.get(word);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, fromCache: true };
  }

  // Create a simple sentence with the word to get MSD annotation
  // Use "Det är en/ett [word]" pattern to help Sparv identify genus
  const testSentence = `Det är ${word}.`;

  const params = new URLSearchParams({
    text: testSentence,
    language: 'sv',
    settings: JSON.stringify({
      positional_attributes: {
        lexical_attributes: ['pos', 'msd', 'lemma'],
      },
    }),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${SPARV_ENDPOINT}?${params.toString()}`, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Sparv responded with status ${response.status}`);
    }

    const xmlText = await response.text();
    if (!xmlText || xmlText.trim().length === 0) {
      return null;
    }

    // Parse XML to extract MSD for our word
    const result = parseSparvResponse(xmlText, word);
    if (!result) return null;

    sparvCache.set(word, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`Sparv request timed out for word "${word}"`);
    } else {
      console.warn('Sparv request failed:', error.message);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse Sparv XML response to extract MSD/genus for a specific word
 * @param {string} xmlText - XML response from Sparv
 * @param {string} word - The word we're looking for
 * @returns {SparvGenusResult|null}
 */
function parseSparvResponse(xmlText, word) {
  // Extract all word elements with their attributes
  const wordElements = xmlText.matchAll(/<w([^>]+)>([^<]+)<\/w>/gi);
  
  let bestMatch = null;
  let bestMsd = null;
  let bestLemma = null;

  for (const match of wordElements) {
    const attributes = match[1];
    const wordText = match[2].toLowerCase().trim();
    
    // Check if this word matches (either in text or lemma)
    const lemmaMatch = attributes.match(/lemma="([^"]+)"/i);
    const lemma = lemmaMatch ? lemmaMatch[1].toLowerCase().replace(/\|/g, '') : '';
    
    if (wordText === word || lemma === word) {
      // Extract MSD
      const msdMatch = attributes.match(/msd="([^"]+)"/i);
      if (msdMatch) {
        const msd = msdMatch[1];
        // Prefer nouns (NN) for genus information
        if (!bestMsd || (msd.includes('NN') && !bestMsd.includes('NN'))) {
          bestMsd = msd;
          bestMatch = wordText;
          bestLemma = lemma || wordText;
        }
      }
    }
  }

  if (!bestMsd || !bestMatch) {
    return null;
  }

  // Extract genus from MSD (e.g., "NN.UTR.SIN.IND.NOM" or "NN.NEU.SIN.IND.NOM")
  const genus = deriveGenus(bestMsd);
  const pos = extractPos(bestMsd);

  return {
    word: bestLemma || bestMatch,
    article: genus === 'UTR' ? 'en' : genus === 'NEU' ? 'ett' : null,
    genus,
    msd: bestMsd,
    pos,
    fromCache: false,
  };
}

/**
 * Determine genus from MSD content.
 * @param {string|null} msd
 * @returns {'UTR'|'NEU'|null}
 */
function deriveGenus(msd) {
  if (!msd) return null;
  if (msd.includes('UTR')) return 'UTR';
  if (msd.includes('NEU')) return 'NEU';
  return null;
}

/**
 * Extract POS from MSD (first two characters usually)
 * @param {string|null} msd
 * @returns {string|null}
 */
function extractPos(msd) {
  if (!msd) return null;
  // MSD format is usually like "NN.UTR.SIN.IND.NOM"
  const match = msd.match(/^([A-Z]{2})/);
  return match ? match[1] : null;
}

// Small delay helper for potential backoff
export async function sleep(ms) {
  await delay(ms);
}
