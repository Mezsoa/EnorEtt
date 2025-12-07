import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * @typedef {Object} PronunciationLookup
 * @property {string|null} ipa - IPA transcription if found
 * @property {boolean} fromCache - Always false (kept for API symmetry)
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PRON_PATH = path.resolve(
  __dirname,
  'externals',
  'NST svensk leksikon',
  'swe030224NST.pron',
  'swe030224NST.pron'
);

/** @type {Map<string, string>} */
const pronDict = new Map();
let loadedPath = null;
let isLoaded = false;

/**
 * Load the NST/LEX pronunciation dictionary into memory.
 *
 * @param {string} [customPath] - Optional override path
 */
export function loadPronunciations(customPath = DEFAULT_PRON_PATH) {
  if (isLoaded) return;

  const filePath = customPath;
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const text = fileBuffer.toString('utf-8');
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      if (!line || line.startsWith('#')) continue;
      const [word, ipa] = line.split(/\t+/);
      if (!word || !ipa) continue;
      pronDict.set(word.trim().toLowerCase(), ipa.trim());
    }

    loadedPath = filePath;
    isLoaded = true;
    console.log(`Loaded pronunciation dictionary (${pronDict.size} entries) from ${filePath}`);
  } catch (error) {
    console.warn('Failed to load pronunciation dictionary:', error.message);
    isLoaded = true; // avoid repeated attempts
  }
}

/**
 * Look up IPA transcription for a word.
 *
 * @param {string} rawWord
 * @returns {PronunciationLookup}
 */
export function lookupPronunciation(rawWord) {
  if (!isLoaded) {
    loadPronunciations();
  }
  const word = (rawWord || '').trim().toLowerCase();
  if (!word) return { ipa: null, fromCache: false };

  const ipa = pronDict.get(word) || null;
  return { ipa, fromCache: false };
}

export function getPronDictSize() {
  return pronDict.size;
}

export function getPronDictPath() {
  return loadedPath;
}
