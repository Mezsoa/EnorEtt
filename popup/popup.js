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

// State
let currentWord = '';
let lastResult = null;

/**
 * Initialize the popup
 */
function init() {
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
  
  // Focus input on load
  wordInput.focus();
  
  // Load stats
  updateStats();
  
  // Check if there's a word from context menu
  checkForContextMenuWord();
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
    // Lookup the word
    const result = await lookupWord(word);
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
 */
function displaySuccessResult(result) {
  const { word, article, translation, confidence, source, explanation, warning } = result;
  
  const html = `
    <div class="result-main">
      <div class="result-article ${article}">
        ${article}
      </div>
      <div class="result-word">
        ${word}
      </div>
      ${translation ? `<div class="result-translation">${translation}</div>` : ''}
    </div>
    
    <div class="result-details">
      ${confidence ? `
        <div class="result-info">
          <span class="result-info-icon">ℹ️</span>
          <div class="result-info-text">
            ${explanation || `Detta är ett ${article}-ord`}
            <br>
            <span class="result-confidence ${confidence}">
              ${getConfidenceLabel(confidence)}
            </span>
          </div>
        </div>
      ` : ''}
      
      ${warning ? `
        <div class="result-warning">
          <span class="result-warning-icon">⚠️</span>
          <div class="result-info-text">${warning}</div>
        </div>
      ` : ''}
    </div>
  `;
  
  resultContent.innerHTML = html;
}

/**
 * Display error result
 */
function displayErrorResult(result) {
  const { word, error, errorEn, suggestion } = result;
  
  const html = `
    <div class="result-error">
      <div class="result-error-icon">🤔</div>
      <div class="result-error-title">${error || 'Ordet hittades inte'}</div>
      <div class="result-error-text">
        ${errorEn || 'Word not found in dictionary'}
      </div>
      ${suggestion ? `
        <div class="result-suggestion">
          💡 ${suggestion}
        </div>
      ` : ''}
    </div>
  `;
  
  resultContent.innerHTML = html;
}

/**
 * Display generic error
 */
function displayError(message) {
  const html = `
    <div class="result-error">
      <div class="result-error-icon">❌</div>
      <div class="result-error-title">Ett fel uppstod</div>
      <div class="result-error-text">${message}</div>
    </div>
  `;
  
  resultContent.innerHTML = html;
  showResults();
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
 * Handle Pro upgrade button click
 */
function handleProUpgrade() {
  // Open landing page in new tab
  chrome.tabs.create({
    url: 'https://enorett.com/upgrade' // Replace with your actual landing page
  });
  
  // Track upgrade click (analytics)
  console.log('Pro upgrade clicked');
}

document.addEventListener('DOMContentLoaded', init);

