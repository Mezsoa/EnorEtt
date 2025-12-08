/**
 * @typedef {Object} KorpExampleResult
 * @property {string[]} examples - Example sentences (deduped, trimmed)
 * @property {boolean} fromCache - True if served from cache
 */

const KORP_ENDPOINT = process.env.KORP_ENDPOINT || 'https://ws.spraakbanken.gu.se/ws/korp/v8/query';
// Use single corpus 'rom99' as default - multiple corpora may cause issues with some corpus names
const CORPORA = process.env.KORP_CORPORA || 'rom99';
const DEFAULT_LIMIT = Number(process.env.KORP_MAX_EXAMPLES || 5);
const CACHE_TTL_MS = Number(process.env.KORP_CACHE_TTL_MS || 6 * 60 * 60 * 1000); // 6h
const DEFAULT_TIMEOUT_MS = Number(process.env.KORP_TIMEOUT_MS || 7000);

/** @type {Map<string, { data: KorpExampleResult, expiresAt: number }>} */
const korpCache = new Map();

/**
 * Fetch example sentences for a Swedish word using Korp.
 * @param {string} rawWord
 * @param {number} limit
 * @returns {Promise<KorpExampleResult|null>}
 */
export async function fetchExamples(rawWord, limit = DEFAULT_LIMIT) {
  const word = (rawWord || '').trim().toLowerCase();
  if (!word) return null;

  const cached = korpCache.get(word);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, fromCache: true };
  }

  // Korp API v8 requires CQP format: [word = "word"]
  const cqpQuery = `[word = "${word}"]`;
  const params = new URLSearchParams({
    corpus: CORPORA,
    cqp: cqpQuery,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${KORP_ENDPOINT}?${params.toString()}`, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Korp responded with status ${response.status}`);
    }

    const data = await response.json();
    
    // Check for API errors
    if (data.ERROR) {
      throw new Error(`Korp API error: ${data.ERROR.type} - ${data.ERROR.value}`);
    }
    
    const examples = parseExamples(data, limit);
    if (!examples.length) return null;

    const result = { examples, fromCache: false };
    korpCache.set(word, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`Korp request timed out for word "${word}"`);
    } else {
      console.warn('Korp request failed:', error.message);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse example sentences from Korp payload.
 * @param {any} data
 * @param {number} limit
 * @returns {string[]}
 */
function parseExamples(data, limit) {
  const sentences = [];
  // Korp API v8 returns data.kwic array directly
  const kwicArray = Array.isArray(data?.kwic)
    ? data.kwic
    : Array.isArray(data?.hits?.hits)
      ? data.hits.hits
      : Array.isArray(data?.results?.kwic)
        ? data.results.kwic
        : [];

  for (const kwic of kwicArray) {
    // Korp v8 returns tokens array directly in kwic object
    const tokens = Array.isArray(kwic?.tokens)
      ? kwic.tokens
      : Array.isArray(kwic?.left) && Array.isArray(kwic?.right)
        ? [...kwic.left, ...(kwic.kwic ? [kwic.kwic] : []), ...kwic.right]
        : [];

    // Extract word from each token - Korp v8 uses 'word' property
    const sentence = tokens
      .map((t) => {
        // Try multiple possible properties for word
        return t?.word || t?.w || t?.lex || t?.lem || t?.baseform || t?.token || '';
      })
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (sentence) {
      sentences.push(sentence);
    }

    if (sentences.length >= limit) break;
  }

  // Deduplicate while preserving order
  const seen = new Set();
  const deduped = [];
  for (const s of sentences) {
    if (!seen.has(s)) {
      seen.add(s);
      deduped.push(s);
    }
  }
  return deduped.slice(0, limit);
}
