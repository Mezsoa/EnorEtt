/**
 * EnorEtt Popup UI Logic
 * Handles user interactions and displays lookup results
 */

// Import functions will be loaded from other scripts

// DOM Elements
const wordInput = document.getElementById('wordInput');
const clearBtn = document.getElementById('clearBtn');
const checkBtn = document.getElementById('checkBtn');
const resultSection = document.getElementById('resultSection');
const resultContent = document.getElementById('resultContent');
const examplesSection = document.getElementById('examplesSection');
const feedbackSection = document.getElementById('feedbackSection');
const statsInfo = document.getElementById('statsInfo');
const loadingIndicator = document.getElementById('loadingIndicator');
const proBanner = document.getElementById('proBanner');
const proUpgradeBtn = document.getElementById('proUpgradeBtn');
const loginSection = document.getElementById('loginSection');
const userSection = document.getElementById('userSection');
const userEmail = document.getElementById('userEmail');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');

// State
let currentWord = '';
let lastResult = null;
let isPro = false;

// API fallback configuration (popup-local to avoid global collisions).
// Production only: CSP in manifest does not allow localhost. For local dev, you could
// temporarily add 'http://localhost:3000' and allow it in extension_pages connect-src.
const POPUP_API_BASES = [
  'https://enorett.se',
  'https://www.enorett.se',
  'https://api.enorett.se'
];
const FETCH_TIMEOUT_MS = 8000;

/**
 * Fetch helper with domain fallback and timeout
 * @param {string} path - Relative (/api/...) or absolute URL
 * @param {object} options - fetch options
 * @returns {Promise<{response: Response, base: string}>}
 */
async function popupFetchWithFallback(path, options = {}) {
  let lastError = null;
  
  for (const base of POPUP_API_BASES) {
    const url = path.startsWith('http') ? path : `${base}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        return { response, base };
      }
      lastError = new Error(`HTTP ${response.status} at ${url}`);
    } catch (e) {
      clearTimeout(timeoutId);
      lastError = e;
    }
  }
  
  throw lastError || new Error('No endpoint reachable');
}

/**
 * Initialize the popup
 */
async function init() {
  // Set up event listeners
  wordInput.addEventListener('input', handleInput);
  wordInput.addEventListener('keypress', handleKeyPress);
  clearBtn.addEventListener('click', handleClear);
  checkBtn.addEventListener('click', handleCheck);
  
  // Example buttons
  const exampleBtns = document.querySelectorAll('.example-btn');
  exampleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const word = btn.dataset.word;
      wordInput.value = word;
      handleInput();
      handleCheck();
    });
  });
  
  // Feedback buttons
  const feedbackBtns = document.querySelectorAll('.feedback-btn');
  feedbackBtns.forEach(btn => {
    btn.addEventListener('click', handleFeedback);
  });
  
  // Pro upgrade button
  proUpgradeBtn.addEventListener('click', handleProUpgrade);
  
  // Login/logout buttons
  loginBtn.addEventListener('click', handleLogin);
  logoutBtn.addEventListener('click', handleLogout);
  
  // Delegated click for audio button (avoids inline onclick / XSS)
  resultContent.addEventListener('click', (e) => {
    const btn = e.target.closest('.result-audio-btn');
    if (btn && btn.dataset.audioUrl) {
      playPronunciation(btn.dataset.audioUrl);
    }
  });

  // Focus input on load
  wordInput.focus();
  
  // Load stats
  updateStats();
  
  // Check auth status and subscription
  // Also check if auth exists in localStorage (from browser login) and sync it
  await syncAuthFromLocalStorage();
  await checkAuthStatus();
  await checkSubscriptionStatus();
  
  // Check if there's a word from context menu
  checkForContextMenuWord();
}

/**
 * Sync auth from backend to extension storage
 * This handles the case when user logs in via browser
 */
async function syncAuthFromLocalStorage() {
  try {
    // First check if we already have auth in extension storage
    const authData = await chrome.storage.local.get(['enorett_auth']);
    if (authData.enorett_auth && authData.enorett_auth.user) {
      return; // Already have auth
    }
    
    // If no auth in extension storage, check if we have userId/email
    const userData = await chrome.storage.local.get(['enorett_userId', 'enorett_userEmail']);
    const userId = userData.enorett_userId;
    const email = userData.enorett_userEmail;
    
    if (userId) {
      // Try to get fresh auth from backend using userId
    // Use subscription/status endpoint instead since it's more reliable
    try {
      const { response } = await popupFetchWithFallback(
        `/api/subscription/status?userId=${encodeURIComponent(userId)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId
          }
        }
      );
      
      const data = await response.json();
      if (data.success && data.user) {
        // Save auth to extension storage
        await chrome.storage.local.set({
          enorett_auth: {
            user: data.user,
            subscription: data.subscription,
            token: null
          },
          enorett_userId: data.user.userId,
          enorett_userEmail: data.user.email
        });
        
        // Also save subscription if available
        if (data.subscription) {
          await chrome.storage.local.set({
            enorett_subscription: {
              ...data.subscription,
              lastSynced: new Date().toISOString()
            }
          });
        }
        
        console.log('✅ Synced auth from backend');
        return; // Success, exit
      }
    } catch (e) {
      console.warn('Could not sync auth from backend:', e.message);
    }
    
    console.warn('Could not sync auth from any endpoint');
    }
  } catch (error) {
    console.warn('Error syncing auth:', error);
  }
}

/**
 * Handle input changes
 */
function handleInput() {
  const value = wordInput.value.trim();
  
  // Show/hide clear button
  if (value) {
    clearBtn.classList.add('visible');
    checkBtn.disabled = false;
  } else {
    clearBtn.classList.remove('visible');
    checkBtn.disabled = true;
  }
}

/**
 * Handle Enter key press
 */
function handleKeyPress(e) {
  if (e.key === 'Enter' && wordInput.value.trim()) {
    handleCheck();
  }
}

/**
 * Handle clear button click
 */
function handleClear() {
  wordInput.value = '';
  handleInput();
  hideResults();
  showExamples();
  wordInput.focus();
}

/**
 * Handle check button click
 */
async function handleCheck() {
  const word = wordInput.value.trim();
  
  if (!word) {
    return;
  }
  
  currentWord = word;
  
  // Show loading
  showLoading();
  hideExamples();
  
  try {
    // Check if user is Pro for API access
    const useAPI = isPro;
    
    // Lookup the word
    const result = await lookupWord(word, useAPI);
    lastResult = result;
    
    // Hide loading
    hideLoading();
    
    // Display result
    displayResult(result);
    
    // Show feedback section after successful lookup
    if (result.success) {
      setTimeout(() => {
        feedbackSection.classList.remove('hidden');
        statsInfo.classList.add('hidden');
      }, 500);
    }
  } catch (error) {
    console.error('Lookup error:', error);
    hideLoading();
    displayError('Ett fel uppstod. Försök igen.');
  }
}

/**
 * Display lookup result
 */
function displayResult(result) {
  if (result.success) {
    displaySuccessResult(result);
  } else {
    displayErrorResult(result);
  }
  
  showResults();
}

/**
 * Display successful result
 * All user/API-sourced values are escaped to prevent XSS.
 */
function displaySuccessResult(result) {
  const { word, article, translation, confidence, source, explanation, warning, examples, pronunciation, audioUrl } = result;
  
  const displayArticle = article || '—';
  const articleClass = article ? article : 'unknown';
  const safeConfidence = confidence || 'none';
  const safeWord = escapeHtml(word);
  const safeTranslation = translation ? escapeHtml(translation) : '';
  const safeExplanation = escapeHtml(explanation || (article ? `Detta är ett ${article}-ord` : 'Ingen artikel hittades'));
  const safeWarning = warning ? escapeHtml(warning) : '';
  const safePronunciation = pronunciation ? escapeHtml(pronunciation) : '';
  const safeAudioUrl = audioUrl ? escapeHtml(audioUrl) : '';
  const safeExamples = (examples && Array.isArray(examples) && isPro)
    ? examples.map(ex => escapeHtml(String(ex)))
    : [];

  const html = `
    <div class="result-main">
      <div class="result-article ${articleClass}">
        ${escapeHtml(displayArticle)}
      </div>
      <div class="result-word">
        ${safeWord}
      </div>
      ${safeTranslation ? `<div class="result-translation">${safeTranslation}</div>` : ''}
    </div>
    
    <div class="result-details">
      ${safeConfidence ? `
        <div class="result-info">
          <span class="result-info-icon">ℹ️</span>
          <div class="result-info-text">
            ${safeExplanation}
            <br>
            <span class="result-confidence ${safeConfidence}">
              ${getConfidenceLabel(safeConfidence)}
            </span>
          </div>
        </div>
      ` : ''}
      
      ${safeWarning ? `
        <div class="result-warning">
          <span class="result-warning-icon">⚠️</span>
          <div class="result-info-text">${safeWarning}</div>
        </div>
      ` : ''}
      
      ${safeExamples.length > 0 ? `
        <div class="result-examples">
          <div class="result-examples-title">Exempel:</div>
          ${safeExamples.map(example => `<div class="result-example">${example}</div>`).join('')}
        </div>
      ` : ''}
      
      ${(safePronunciation || safeAudioUrl) && isPro ? `
        <div class="result-pronunciation">
          <span class="result-pronunciation-icon">🔊</span>
          ${safePronunciation ? `<span class="result-pronunciation-text">${safePronunciation}</span>` : ''}
          ${safeAudioUrl ? `<button type="button" class="result-audio-btn" data-audio-url="${safeAudioUrl}">Spela upp</button>` : ''}
        </div>
      ` : ''}
    </div>
  `;

  resultContent.innerHTML = html;
}

/**
 * Display error result
 * All user/API-sourced values are escaped to prevent XSS.
 */
function displayErrorResult(result) {
  const { word, error, errorEn, suggestion, requiresPro } = result;
  const safeError = escapeHtml(error || 'Ordet hittades inte');
  const safeErrorEn = escapeHtml(errorEn || 'Word not found in dictionary');
  const safeSuggestion = suggestion ? escapeHtml(suggestion) : '';

  const html = `
    <div class="result-error">
      <div class="result-error-icon">🤔</div>
      <div class="result-error-title">${safeError}</div>
      <div class="result-error-text">
        ${safeErrorEn}
      </div>
      ${safeSuggestion ? `
        <div class="result-suggestion ${requiresPro ? 'pro-prompt' : ''}">
          💡 ${safeSuggestion}
          ${requiresPro ? `
            <button type="button" class="upgrade-prompt-btn" id="popupProUpgradeBtn">Upgrade to Pro</button>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `;

  resultContent.innerHTML = html;
  if (requiresPro) {
    const btn = resultContent.querySelector('#popupProUpgradeBtn');
    if (btn) btn.addEventListener('click', handleProUpgrade);
  }
}

/**
 * Display generic error
 * Message is escaped to prevent XSS.
 */
function displayError(message) {
  const safeMessage = escapeHtml(String(message));
  const html = `
    <div class="result-error">
      <div class="result-error-icon">❌</div>
      <div class="result-error-title">Ett fel uppstod</div>
      <div class="result-error-text">${safeMessage}</div>
    </div>
  `;

  resultContent.innerHTML = html;
  showResults();
}

/**
 * Play pronunciation audio if available.
 * Only allows https: URLs to prevent abuse.
 */
function playPronunciation(url) {
  try {
    const u = typeof url === 'string' ? url.trim() : '';
    if (!u || !u.startsWith('https://')) {
      console.warn('Audio URL not allowed (https only)');
      return;
    }
    const audio = new Audio(u);
    audio.play().catch(() => {
      console.warn('Could not play audio');
    });
  } catch (e) {
    console.warn('Audio URL invalid:', e);
  }
}

/**
 * Get confidence label
 */
function getConfidenceLabel(confidence) {
  const labels = {
    high: 'Hög säkerhet',
    medium: 'Medel säkerhet',
    low: 'Låg säkerhet',
    none: 'Okänd'
  };
  return labels[confidence] || confidence;
}

/**
 * Handle feedback button click
 */
function handleFeedback(e) {
  const feedback = e.target.dataset.feedback;
  
  // Visual feedback
  e.target.classList.add('selected');
  setTimeout(() => {
    e.target.classList.remove('selected');
  }, 300);
  
  // Track feedback (could be sent to analytics)
  trackFeedback(currentWord, lastResult, feedback);
  
  // Optional: Show thank you message
  const feedbackQuestion = feedbackSection.querySelector('.feedback-question');
  const originalText = feedbackQuestion.textContent;
  feedbackQuestion.textContent = 'Tack för din feedback! 🙏';
  
  setTimeout(() => {
    feedbackQuestion.textContent = originalText;
  }, 2000);
}

/**
 * Track feedback (placeholder for analytics)
 */
function trackFeedback(word, result, feedback) {
  console.log('Feedback:', { word, result, feedback });
  
  // TODO: Send to analytics service
  // Example: chrome.runtime.sendMessage({ type: 'FEEDBACK', data: { word, feedback } });
}

/**
 * Update stats display
 */
function updateStats() {
  try {
    const stats = getDictionaryStats();
    if (stats) {
      const statsText = statsInfo.querySelector('.stats-text');
      statsText.textContent = `📚 ${stats.total}+ ord i databasen`;
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

/**
 * Check for word from context menu
 */
async function checkForContextMenuWord() {
  try {
    // Check if there's a pending word from context menu
    const result = await chrome.storage.local.get(['pendingWord']);
    
    if (result.pendingWord) {
      wordInput.value = result.pendingWord;
      handleInput();
      handleCheck();
      
      // Clear the pending word
      chrome.storage.local.remove(['pendingWord']);
    }
  } catch (error) {
    console.error('Error checking for pending word:', error);
  }
}

/**
 * Show loading indicator
 */
function showLoading() {
  loadingIndicator.classList.remove('hidden');
  checkBtn.disabled = true;
}

/**
 * Hide loading indicator
 */
function hideLoading() {
  loadingIndicator.classList.add('hidden');
  checkBtn.disabled = false;
}

/**
 * Show results section
 */
function showResults() {
  resultSection.classList.remove('hidden');
}

/**
 * Hide results section
 */
function hideResults() {
  resultSection.classList.add('hidden');
  feedbackSection.classList.add('hidden');
  statsInfo.classList.remove('hidden');
}

/**
 * Show examples section
 */
function showExamples() {
  examplesSection.classList.remove('hidden');
}

/**
 * Hide examples section
 */
function hideExamples() {
  examplesSection.classList.add('hidden');
}

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOOKUP_WORD') {
    wordInput.value = message.word;
    handleInput();
    handleCheck();
  }
});

// Initialize on load
/**
 * Check auth status and update UI
 */
async function checkAuthStatus() {
  try {
    const loggedIn = await isLoggedIn();
    if (loggedIn) {
      const user = await getCurrentUser();
      if (user) {
        userEmail.textContent = user.email;
        loginSection.classList.add('hidden');
        userSection.classList.remove('hidden');
      } else {
        loginSection.classList.remove('hidden');
        userSection.classList.add('hidden');
      }
    } else {
      loginSection.classList.remove('hidden');
      userSection.classList.add('hidden');
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
    loginSection.classList.remove('hidden');
    userSection.classList.add('hidden');
  }
}

/**
 * Handle login button click
 */
function handleLogin() {
  // Open login page in new tab with redirect parameter
  chrome.tabs.create({
    url: 'https://enorett.se/login?redirect=/upgrade'
  });
}

/**
 * Handle logout button click
 */
async function handleLogout() {
  // Send logout to background script which will:
  // 1. Clear extension storage
  // 2. Broadcast to content scripts to clear localStorage
  // 3. Notify all popups
  try {
    await chrome.runtime.sendMessage({ type: 'AUTH_LOGOUT' });
    console.log('✅ Logout successful');
  } catch (e) {
    // Fallback: clear locally
    console.warn('Could not send logout to background, clearing locally:', e);
    await clearAuth();
  }
  
  await checkAuthStatus();
  await checkSubscriptionStatus();
}

/**
 * Check subscription status and update UI
 */
async function checkSubscriptionStatus() {
  try {
    // First sync subscription from backend to ensure we have latest data
    const authData = await chrome.storage.local.get(['enorett_auth']);
    const auth = authData.enorett_auth;
    
    if (auth && auth.user) {
      // User is logged in, sync subscription from backend with fallback
      try {
        const { response } = await popupFetchWithFallback(
          `/api/subscription/status?userId=${encodeURIComponent(auth.user.userId)}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-User-Id': auth.user.userId
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.subscription) {
            // Save subscription
            await chrome.storage.local.set({
              enorett_subscription: {
                ...data.subscription,
                lastSynced: new Date().toISOString()
              }
            });
          } else if (data.success && !data.subscription) {
            // No subscription, clear it
            await chrome.storage.local.remove(['enorett_subscription']);
          }
        }
      } catch (e) {
        console.warn('Could not sync subscription from backend:', e.message);
      }
    }
    
    // Now check if user is Pro
    isPro = await isProUser();
    updateProUI();
  } catch (error) {
    console.error('Error checking subscription status:', error);
    isPro = false;
    updateProUI();
  }
}

/**
 * Update UI based on Pro status
 */
function updateProUI() {
  if (isPro) {
    // Hide upgrade banner for Pro users
    proBanner.classList.add('hidden');
    
    // Update stats to show Pro dictionary count
    const statsText = statsInfo.querySelector('.stats-text');
    if (statsText) {
      statsText.textContent = '📚 10,000+ ord i databasen (Premium)';
      statsText.style.color = '#4562e3';
      statsText.style.fontWeight = '600';
    }
    
    // Add Premium badge to header if not exists
    const header = document.querySelector('.header');
    if (header && !header.querySelector('.premium-badge')) {
      const badge = document.createElement('div');
      badge.className = 'premium-badge';
      badge.textContent = '⭐ Premium';
      badge.style.cssText = 'position: absolute; top: 8px; right: 8px; background: linear-gradient(135deg, #4562e3 0%, #764ba2 100%); color: white; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: 700;';
      header.style.position = 'relative';
      header.appendChild(badge);
    }
    
    console.log('✅ Premium status active!');
  } else {
    // Show upgrade banner for free users
    proBanner.classList.remove('hidden');
    
    // Remove Premium badge if exists
    const badge = document.querySelector('.premium-badge');
    if (badge) {
      badge.remove();
    }
    
    // Reset stats text
    const statsText = statsInfo.querySelector('.stats-text');
    if (statsText) {
      statsText.textContent = '📚 1,000+ ord i databasen';
      statsText.style.color = '';
      statsText.style.fontWeight = '';
    }
  }
}

/**
 * Handle Pro upgrade button click
 */
async function handleProUpgrade() {
  // Check if user is logged in
  const loggedIn = await isLoggedIn();
  
  if (!loggedIn) {
    // Redirect to login first
    chrome.tabs.create({
      url: 'https://enorett.se/login?redirect=/upgrade'
    });
    return;
  }
  
  // Open landing page in new tab
  chrome.tabs.create({
    url: 'https://enorett.se/upgrade'
  });
  
  // Track upgrade click (analytics)
  console.log('Pro upgrade clicked');
}

/**
 * Listen for subscription updates and auth updates
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SUBSCRIPTION_UPDATED') {
    checkSubscriptionStatus();
    sendResponse({ success: true });
  } else if (message.type === 'AUTH_UPDATED') {
    // Auth was updated (login/logout), refresh UI
    checkAuthStatus();
    checkSubscriptionStatus();
    sendResponse({ success: true });
  }
  return false;
});

// Listen for storage changes (when auth is updated in another tab/context)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes.enorett_auth || changes.enorett_userId)) {
    // Auth changed, refresh UI
    checkAuthStatus();
    checkSubscriptionStatus();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  init().catch(err => console.warn('Init failed:', err));
});

