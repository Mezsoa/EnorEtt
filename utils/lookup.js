/**
 * EnorEtt Lookup Logic
 * Determines whether a Swedish noun takes "en" or "ett" article
 * 
 * Strategy:
 * 1. Primary: Dictionary lookup
 * 2. Fallback: Pattern-based detection using common Swedish suffixes
 * 3. Future: API integration for unknown words
 * 
 * Note: dictionary is loaded from dictionary.js
 */

/**
 * Common Swedish word patterns and their typical article
 * These are heuristics and not 100% accurate, but helpful for unknown words
 */
const patterns = {
  en: [
    /-are$/,      // lärare, författare
    /-ing$/,      // tidning, möjlighet (with some exceptions)
    /-het$/,      // möjlighet, säkerhet
    /-else$/,     // känelse, berättelse
    /-tion$/,     // station, nation
    /-dom$/,      // visdom, kungardom
    /-skap$/,     // vänskap, kunskap (some exceptions)
    /-nad$/,      // byggnad, öppnad
    /-or$/,       // mor, dator
    /-ik$/,       // musik, fysik
    /-ur$/,       // kultur,atur
  ],
  ett: [
    /-ium$/,      // museum, stadium
    /-ande$/,     // boende, levande
    /-ende$/,     // slutet, användande
    /-eri$/,      // bageri, bryggeri
    /-ment$/,     // moment, argument
    /-em$/,       // system, problem
    /-tek$/,      // bibliotek, apotek
    /-um$/,       // album, faktum
    /-iv$/,       // arkiv, motiv
    /-o$/,        // foto, piano (many loanwords)
  ]
};

/**
 * Lookup a Swedish word and return its article
 * 
 * @param {string} word - The Swedish noun to look up
 * @param {boolean} useAPI - Whether to use API fallback (Pro feature)
 * @returns {Promise<object>} Result object with article, confidence, and explanation
 */
async function lookupWord(word, useAPI = false) {
  // Check if user is Pro for API access
  let isProUserValue = false;
  try {
    // Check storage directly (subscription.js functions are available in popup context)
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get(['enorett_subscription']);
      const subscription = result.enorett_subscription;
      if (subscription && (subscription.status === 'active' || subscription.status === 'trialing')) {
        if (subscription.expiresAt) {
          const expiresAt = new Date(subscription.expiresAt);
          isProUserValue = expiresAt > new Date();
        } else {
          isProUserValue = true;
        }
      }
    }
  } catch (error) {
    console.warn('Could not check Pro status:', error);
    isProUserValue = false;
  }
  
  // Only allow API access for Pro users
  if (useAPI && !isProUserValue) {
    useAPI = false;
  }
  // Normalize the input
  const normalizedWord = word.trim().toLowerCase();
  
  // Validation
  if (!normalizedWord) {
    return {
      success: false,
      error: "Vänligen ange ett ord",
      errorEn: "Please enter a word"
    };
  }
  
  // Check if input contains multiple words
  if (normalizedWord.includes(' ')) {
    return {
      success: false,
      error: "Vänligen ange endast ett ord",
      errorEn: "Please enter only one word"
    };
  }
  
  // 1. DICTIONARY LOOKUP (Primary method)
  const dictEntry = dictionary.find(entry => entry.word === normalizedWord);
  
  if (dictEntry) {
    return {
      success: true,
      word: dictEntry.word,
      article: dictEntry.article,
      translation: dictEntry.translation,
      confidence: "high",
      source: "dictionary",
      explanation: `Från ordbok: ${dictEntry.word} = ${dictEntry.translation}`
    };
  }
  
  // 2. PATTERN-BASED DETECTION (Fallback)
  const patternResult = detectByPattern(normalizedWord);
  
  if (patternResult) {
    return {
      success: true,
      word: normalizedWord,
      article: patternResult.article,
      confidence: "medium",
      source: "pattern",
      explanation: `Baserat på ändelsen "${patternResult.suffix}" (vanligtvis ${patternResult.article}-ord)`,
      warning: "Detta är en gissning baserad på ordmönster"
    };
  }
  
  // 3. API LOOKUP (Pro feature)
  if (useAPI && isProUserValue) {
    try {
      const apiResult = await fetchFromAPI(normalizedWord, true);
      if (apiResult.success) {
        return apiResult;
      }
    } catch (error) {
      console.warn('API lookup failed:', error);
    }
  }
  
  // 4. UNKNOWN WORD - Show upgrade prompt for free users
  const upgradePrompt = !isProUserValue ? "Upgrade to Pro för 10,000+ ord och API-åtkomst" : null;
  
  return {
    success: false,
    word: normalizedWord,
    error: "Ordet finns inte i ordboken",
    errorEn: "Word not found in dictionary",
    suggestion: upgradePrompt || "Statistiskt sett är ~70% av svenska ord 'en-ord'",
    confidence: "none",
    requiresPro: !isProUserValue
  };
}

/**
 * Detect article by word pattern (suffix matching)
 * 
 * @param {string} word - The word to analyze
 * @returns {object|null} Pattern match result or null
 */
function detectByPattern(word) {
  // Check en-word patterns
  for (const pattern of patterns.en) {
    if (pattern.test(word)) {
      const suffix = word.match(pattern)[0];
      return {
        article: "en",
        suffix: suffix,
        pattern: pattern.toString()
      };
    }
  }
  
  // Check ett-word patterns
  for (const pattern of patterns.ett) {
    if (pattern.test(word)) {
      const suffix = word.match(pattern)[0];
      return {
        article: "ett",
        suffix: suffix,
        pattern: pattern.toString()
      };
    }
  }
  
  return null;
}

/**
 * Fetch word data from API (Future feature)
 * This is a placeholder for when the backend API is implemented
 * 
 * @param {string} word - The word to look up
 * @returns {Promise<object>} API result
 */
async function fetchFromAPI(word, isPro = false) {
  // Try multiple API endpoints (prioritize www.enorett.se since api.enorett.se may not resolve)
  const apiEndpoints = [
    'https://www.enorett.se/api/enorett',
    'https://enorett.se/api/enorett',
    'https://api.enorett.se/api/enorett'
  ];
  
  // Get user ID for Pro verification
  let userId = null;
  try {
    const userData = await chrome.storage.local.get(['enorett_userId']);
    userId = userData.enorett_userId;
  } catch (error) {
    console.warn('Could not get user ID:', error);
  }
  
  let lastError = null;
  
  // Try each endpoint until one succeeds
  for (const endpoint of apiEndpoints) {
    try {
      const url = `${endpoint}?word=${encodeURIComponent(word)}${isPro ? '&pro=true' : ''}${userId ? `&userId=${encodeURIComponent(userId)}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          return {
            success: false,
            error: "Pro-funktion krävs",
            errorEn: "Pro feature required",
            requiresPro: true
          };
        }
        lastError = new Error(`API error: ${response.status}`);
        continue; // Try next endpoint
      }
      
      const data = await response.json();
      
      return {
        success: true,
        word: data.word,
        article: data.article,
        translation: data.translation,
        confidence: data.confidence || "high",
        source: "api",
        explanation: data.explanation,
        examples: data.examples || [],
        pronunciation: data.pronunciation || null
      };
    } catch (error) {
      lastError = error;
      // Try next endpoint
      continue;
    }
  }
  
  // All endpoints failed
  return {
    success: false,
    error: "API-anrop misslyckades",
    errorEn: "API call failed",
    details: lastError ? lastError.message : "All endpoints failed"
  };
}

/**
 * Batch lookup multiple words
 * Useful for future features like checking entire sentences
 * 
 * @param {string[]} words - Array of words to look up
 * @returns {Promise<object[]>} Array of lookup results
 */
async function lookupMultiple(words) {
  const results = [];
  
  for (const word of words) {
    const result = await lookupWord(word);
    results.push(result);
  }
  
  return results;
}

/**
 * Get random word from dictionary (useful for testing/examples)
 * 
 * @param {string} article - Optional filter by article ("en" or "ett")
 * @returns {object} Random dictionary entry
 */
function getRandomWord(article = null) {
  let pool = dictionary;
  
  if (article === "en" || article === "ett") {
    pool = dictionary.filter(entry => entry.article === article);
  }
  
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

/**
 * Search dictionary by translation (English to Swedish)
 * 
 * @param {string} englishWord - English word to search for
 * @returns {object[]} Array of matching entries
 */
function searchByTranslation(englishWord) {
  const normalized = englishWord.trim().toLowerCase();
  
  return dictionary.filter(entry => 
    entry.translation.toLowerCase().includes(normalized)
  );
}

/**
 * Get suggestions for similar words (simple implementation)
 * Could be enhanced with Levenshtein distance or other algorithms
 * 
 * @param {string} word - The word to find similar matches for
 * @param {number} maxResults - Maximum number of suggestions
 * @returns {object[]} Array of similar words
 */
function getSuggestions(word, maxResults = 5) {
  const normalized = word.trim().toLowerCase();
  
  // Find words that start with the same letters
  const suggestions = dictionary.filter(entry => 
    entry.word.startsWith(normalized.slice(0, 2))
  ).slice(0, maxResults);
  
  return suggestions;
}

