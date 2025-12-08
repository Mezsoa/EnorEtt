import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { fetchGenus } from './sparvClient.js';
import { fetchExamples } from './korpClient.js';
import { lookupPronunciation } from './pronunciationLoader.js';

/**
 * @typedef {Object} LookupResult
 * @property {string} word
 * @property {'en'|'ett'|null} article
 * @property {'UTR'|'NEU'|null} genus
 * @property {string|null} ipa
 * @property {string[]} examples
 * @property {{ sparv: boolean, lex: boolean, korp: boolean, dictionary: boolean }} source
 * @property {'high'|'medium'|'low'} confidence
 * @property {boolean} isPremiumData
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ROOT_DIR points to project root (two levels up from api/utils/)
const ROOT_DIR = path.resolve(__dirname, '../..');

const FREE_LIMIT = Number(process.env.FREE_DICTIONARY_LIMIT || 250);

let fullDictionaryCache = null;
let freeDictionaryCache = null;

/**
 * Load the extension dictionary (utils/dictionary.js) using a sandbox to avoid modifying the file.
 * @returns {Array<{ word: string, article: 'en'|'ett', translation?: string }>}
 */
function loadFullDictionary() {
  if (fullDictionaryCache) return fullDictionaryCache;

  const dictionaryPath = path.join(ROOT_DIR, 'utils', 'dictionary.js');
  try {
    const code = fs.readFileSync(dictionaryPath, 'utf-8');
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: dictionaryPath });
    if (Array.isArray(sandbox.dictionary)) {
      fullDictionaryCache = sandbox.dictionary;
    } else {
      throw new Error('dictionary variable not found or invalid in utils/dictionary.js');
    }
  } catch (err) {
    console.error('Failed to load full dictionary:', err);
    fullDictionaryCache = [];
  }
  return fullDictionaryCache;
}

function getFreeDictionary() {
  if (freeDictionaryCache) return freeDictionaryCache;
  const full = loadFullDictionary();
  freeDictionaryCache = full.slice(0, Math.min(FREE_LIMIT, full.length));
  return freeDictionaryCache;
}

/**
 * Derive genus from article when Karp data is missing.
 * @param {'en'|'ett'|null} article
 * @returns {'UTR'|'NEU'|null}
 */
function genusFromArticle(article) {
  if (article === 'en') return 'UTR';
  if (article === 'ett') return 'NEU';
  return null;
}

/**
 * Main lookup orchestrator.
 * @param {string} rawWord
 * @param {boolean} isPro
 * @returns {Promise<LookupResult>}
 */
export async function lookupWord(rawWord, isPro = false) {
  const word = (rawWord || '').trim().toLowerCase();
  if (!word) {
    throw new Error('Word is required');
  }

  const freeDictionary = getFreeDictionary();
  const fullDictionary = loadFullDictionary();

  const pronResult = lookupPronunciation(word);

  const freeHit = freeDictionary.find((entry) => entry.word === word);
  if (freeHit) {
    return {
      word: freeHit.word,
      article: freeHit.article,
      genus: genusFromArticle(freeHit.article),
      ipa: pronResult.ipa,
      examples: [],
      source: { dictionary: true, sparv: false, lex: Boolean(pronResult.ipa), korp: false },
      confidence: 'high',
      isPremiumData: false,
    };
  }

  const proHit = fullDictionary.find((entry) => entry.word === word);
  
  // Bug 1 Fix: If word exists in premium dictionary but user is not pro, deny access
  if (proHit && !isPro) {
    // Return error object that can be handled by the route
    return {
      word,
      article: null,
      genus: null,
      ipa: null,
      examples: [],
      source: { dictionary: false, sparv: false, lex: false, korp: false },
      confidence: 'none',
      isPremiumData: false,
      requiresPro: true,
      error: 'Premium subscription required',
      errorSv: 'Premium-prenumeration krävs',
    };
  }
  
  if (proHit && isPro) {
    return {
      word: proHit.word,
      article: proHit.article,
      genus: genusFromArticle(proHit.article),
      ipa: pronResult.ipa,
      examples: [],
      source: { dictionary: true, sparv: false, lex: Boolean(pronResult.ipa), korp: false },
      confidence: 'high',
      isPremiumData: true,
    };
  }

  // Remote lookups - use Sparv for genus information
  const sparvResult = await fetchGenus(word);
  const korpResult = await fetchExamples(word);

  const article = sparvResult?.article || null;
  const genus = sparvResult?.genus || genusFromArticle(article);

  const hasArticle = Boolean(article);
  const hasIpa = Boolean(pronResult?.ipa);
  const hasExamples = Boolean(korpResult?.examples?.length);

  // Bug 2 Fix: If no data found from any source, return error indication
  if (!hasArticle && !hasIpa && !hasExamples) {
    return {
      word,
      article: null,
      genus: null,
      ipa: null,
      examples: [],
      source: { dictionary: false, sparv: false, lex: false, korp: false },
      confidence: 'none',
      isPremiumData: false,
      error: 'Word not found',
      errorSv: 'Ordet hittades inte',
    };
  }

  const confidence = hasArticle ? 'medium' : hasIpa || hasExamples ? 'low' : 'low';

  return {
    word,
    article,
    genus,
    ipa: pronResult?.ipa || null,
    examples: korpResult?.examples || [],
    source: {
      dictionary: false,
      sparv: Boolean(sparvResult),
      lex: hasIpa,
      korp: hasExamples,
    },
    confidence,
    isPremiumData: false,
  };
}
