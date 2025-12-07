import { setTimeout as delay } from 'timers/promises';

/**
 * @typedef {Object} KarpGenusResult
 * @property {string} word - Lemma returned by Karp (lowercased)
 * @property {'en'|'ett'|null} article - Article mapped from genus (null if unknown)
 * @property {'UTR'|'NEU'|null} genus - Genus code from MSD
 * @property {string|null} msd - Raw MSD string if present
 * @property {string|null} pos - Part-of-speech hint (e.g., "NN")
 * @property {boolean} fromCache - True if served from in-memory cache
 */

const KARP_ENDPOINT = process.env.KARP_ENDPOINT || 'https://spraakbanken4.it.gu.se/karp/v6/query';
const KARP_RESOURCE = 'saldo';
const DEFAULT_TIMEOUT_MS = Number(process.env.KARP_TIMEOUT_MS || 7000);
const CACHE_TTL_MS = Number(process.env.KARP_CACHE_TTL_MS || 12 * 60 * 60 * 1000); // 12h

/** @type {Map<string, { data: KarpGenusResult, expiresAt: number }>} */
const karpCache = new Map();

/**
 * Fetch genus/article for a Swedish word via Karp (SALDO).
 *
 * @param {string} rawWord - Input word (any casing/spacing)
 * @returns {Promise<KarpGenusResult|null>}
 */
export async function fetchGenus(rawWord) {
  const word = (rawWord || '').trim().toLowerCase();
  if (!word) return null;

  const cached = karpCache.get(word);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, fromCache: true };
  }

  const payload = {
    query: {
      q: [
        {
          bool: {
            must: [
              {
                wildcard: {
                  value: word,
                },
              },
            ],
          },
        },
      ],
    },
    resource: [KARP_RESOURCE],
    start: 0,
    size: 10,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(KARP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Karp responded with status ${response.status}`);
    }

    // Read response as text first to handle empty responses
    const text = await response.text();
    
    // Check if response is empty (Karp API may return empty responses)
    if (!text || text.trim().length === 0) {
      console.warn(`Karp returned empty response for word "${word}" - API may be unavailable`);
      return null;
    }

    // Try to parse JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.warn(`Karp response could not be parsed for word "${word}":`, parseError.message);
      return null;
    }

    const hitEntries = extractHits(data);
    const best = selectBestEntry(hitEntries);

    if (!best) return null;

    const result = {
      word: best.lemma || word,
      article: best.genus === 'UTR' ? 'en' : best.genus === 'NEU' ? 'ett' : null,
      genus: best.genus,
      msd: best.msd,
      pos: best.pos,
      fromCache: false,
    };

    karpCache.set(word, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`Karp request timed out for word "${word}"`);
    } else {
      console.warn('Karp request failed:', error.message);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Extract hit entries from the Karp payload in a defensive manner.
 * @param {any} data
 * @returns {Array<Object>}
 */
function extractHits(data) {
  if (!data) return [];
  if (Array.isArray(data.hits)) return data.hits;
  if (data.hits && Array.isArray(data.hits.hits)) return data.hits.hits;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

/**
 * Pick the most relevant entry:
 * - Prefer nouns (POS contains "NN")
 * - Prefer entries with explicit genus (UTR/NEU in MSD)
 *
 * @param {Array<Object>} entries
 */
function selectBestEntry(entries) {
  const normalized = entries
    .map(normalizeEntry)
    .filter(Boolean);

  const nounsWithGenus = normalized.filter((e) => e.genus && isNoun(e.pos));
  if (nounsWithGenus.length > 0) return nounsWithGenus[0];

  const withGenus = normalized.filter((e) => e.genus);
  if (withGenus.length > 0) return withGenus[0];

  return normalized[0] || null;
}

/**
 * Normalize a hit entry into a uniform shape.
 * @param {any} hit
 * @returns {{ lemma: string|null, msd: string|null, genus: 'UTR'|'NEU'|null, pos: string|null } | null}
 */
function normalizeEntry(hit) {
  if (!hit) return null;
  const entry = hit.entry || hit._source || hit.source || hit;

  const lemma = extractLemma(entry);
  const msd = extractMsd(entry);
  const pos = extractPos(entry, msd);
  const genus = deriveGenus(msd);

  return { lemma, msd, genus, pos };
}

/**
 * Try to extract lemma/baseform from common shapes.
 * @param {any} entry
 * @returns {string|null}
 */
function extractLemma(entry) {
  if (!entry) return null;
  const candidates = [
    entry.lemgram,
    entry.baseform,
    entry.lemma,
    entry.infl?.baseform,
    entry.lemmas && entry.lemmas[0],
    entry.word,
    entry.lexiconEntry?.lemma,
  ];

  for (const cand of candidates) {
    if (typeof cand === 'string' && cand.trim()) {
      return cand.toLowerCase();
    }
  }
  return null;
}

/**
 * Extract MSD string defensively.
 * @param {any} entry
 * @returns {string|null}
 */
function extractMsd(entry) {
  if (!entry) return null;
  const direct = entry.msd || entry.MSD || entry.msds?.[0];
  if (typeof direct === 'string' && direct) return direct;

  // Deep search for a string that contains UTR/NEU
  const strings = collectStrings(entry);
  return strings.find((s) => /UTR|NEU/.test(s)) || null;
}

/**
 * Extract POS from entry or from MSD (prefix often includes NN).
 * @param {any} entry
 * @param {string|null} msd
 * @returns {string|null}
 */
function extractPos(entry, msd) {
  if (entry?.pos) return entry.pos;
  if (msd && /^[A-Z]{2}/.test(msd)) {
    return msd.slice(0, 2);
  }
  const strings = collectStrings(entry);
  const posLike = strings.find((s) => /\bNN\b/.test(s) || s.startsWith('NN.'));
  return posLike ? 'NN' : null;
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
 * Recursively collect string values from an object/array.
 * @param {any} value
 * @returns {string[]}
 */
function collectStrings(value) {
  const results = [];
  const stack = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === 'string') {
      results.push(current);
    } else if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
    } else if (current && typeof current === 'object') {
      for (const val of Object.values(current)) {
        stack.push(val);
      }
    }
  }
  return results;
}

function isNoun(pos) {
  return typeof pos === 'string' && pos.toUpperCase().startsWith('NN');
}

// Small delay helper for potential backoff (kept for future use)
export async function sleep(ms) {
  await delay(ms);
}
