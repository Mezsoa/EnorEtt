/**
 * EnorEtt Content Script
 * Runs on web pages to provide inline word checking functionality
 * 
 * Features:
 * - Listen for context menu triggers
 * - Show inline tooltip with results
 * - Minimal DOM manipulation for performance
 */

// State
let tooltipElement = null;
let isTooltipVisible = false;

/**
 * Initialize content script
 */
function init() {
  console.log('EnorEtt content script loaded');
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(handleMessage);
  
  // Optional: Listen for double-click on words
  // document.addEventListener('dblclick', handleDoubleClick);
}

/**
 * Handle messages from background script
 */
function handleMessage(message, sender, sendResponse) {
  console.log('Content script received message:', message);
  
  switch (message.type) {
    case 'SHOW_RESULT':
      showInlineTooltip(message.data);
      sendResponse({ success: true });
      break;
      
    case 'HIDE_TOOLTIP':
      hideTooltip();
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
  
  return false;
}

/**
 * Handle double-click on words (optional feature)
 */
function handleDoubleClick(event) {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText && selectedText.split(/\s+/).length === 1) {
    // Get cursor position
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Send lookup request to background
    chrome.runtime.sendMessage({
      type: 'LOOKUP_REQUEST',
      word: selectedText.toLowerCase(),
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top
      }
    });
  }
}

/**
 * Show inline tooltip with word result
 */
function showInlineTooltip(data) {
  // Remove existing tooltip
  hideTooltip();
  
  // Create tooltip element
  tooltipElement = createTooltipElement(data);
  
  // Add to page
  document.body.appendChild(tooltipElement);
  
  // Position tooltip
  positionTooltip(data.position);
  
  // Show tooltip with animation
  setTimeout(() => {
    tooltipElement.classList.add('enorett-visible');
    isTooltipVisible = true;
  }, 10);
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    hideTooltip();
  }, 5000);
  
  // Hide on click outside
  document.addEventListener('click', handleClickOutside);
}

/**
 * Create tooltip DOM element
 */
function createTooltipElement(data) {
  const tooltip = document.createElement('div');
  tooltip.className = 'enorett-tooltip';
  tooltip.id = 'enorett-tooltip';
  
  const { word, article, translation, success } = data;
  
  if (success) {
    tooltip.innerHTML = `
      <div class="enorett-tooltip-content">
        <div class="enorett-tooltip-article ${article}">${article}</div>
        <div class="enorett-tooltip-word">${word}</div>
        ${translation ? `<div class="enorett-tooltip-translation">${translation}</div>` : ''}
        <div class="enorett-tooltip-checkmark">✓</div>
      </div>
      <div class="enorett-tooltip-arrow"></div>
    `;
  } else {
    tooltip.innerHTML = `
      <div class="enorett-tooltip-content enorett-error">
        <div class="enorett-tooltip-error">Ordet hittades inte</div>
      </div>
      <div class="enorett-tooltip-arrow"></div>
    `;
  }
  
  // Add styles inline to avoid conflicts
  addTooltipStyles();
  
  return tooltip;
}

/**
 * Add tooltip styles to page
 */
function addTooltipStyles() {
  // Check if styles already exist
  if (document.getElementById('enorett-tooltip-styles')) {
    return;
  }
  
  const style = document.createElement('style');
  style.id = 'enorett-tooltip-styles';
  style.textContent = `
    .enorett-tooltip {
      position: fixed;
      z-index: 999999;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(74, 144, 226, 0.2);
      padding: 12px 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      opacity: 0;
      transform: translateY(-5px);
      transition: opacity 0.2s ease, transform 0.2s ease;
      pointer-events: auto;
    }
    
    .enorett-tooltip.enorett-visible {
      opacity: 1;
      transform: translateY(0);
    }
    
    .enorett-tooltip-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    
    .enorett-tooltip-article {
      font-size: 16px;
      font-weight: 700;
      text-transform: lowercase;
    }
    
    .enorett-tooltip-article.en {
      color: #4A90E2;
    }
    
    .enorett-tooltip-article.ett {
      color: #50C8C8;
    }
    
    .enorett-tooltip-word {
      font-size: 18px;
      font-weight: 600;
      color: #2C3E50;
    }
    
    .enorett-tooltip-translation {
      font-size: 12px;
      color: #7F8C8D;
      font-style: italic;
    }
    
    .enorett-tooltip-checkmark {
      font-size: 16px;
      margin-top: 4px;
    }
    
    .enorett-tooltip-error {
      color: #D9534F;
      font-size: 13px;
    }
    
    .enorett-tooltip-arrow {
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      width: 12px;
      height: 12px;
      background: white;
      transform: translateX(-50%) rotate(45deg);
      box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Position tooltip near cursor or selection
 */
function positionTooltip(position) {
  if (!tooltipElement || !position) {
    return;
  }
  
  const tooltipRect = tooltipElement.getBoundingClientRect();
  const padding = 10;
  
  let top = position.y - tooltipRect.height - padding;
  let left = position.x - tooltipRect.width / 2;
  
  // Keep tooltip within viewport
  if (top < padding) {
    top = position.y + padding;
  }
  
  if (left < padding) {
    left = padding;
  }
  
  if (left + tooltipRect.width > window.innerWidth - padding) {
    left = window.innerWidth - tooltipRect.width - padding;
  }
  
  tooltipElement.style.top = `${top}px`;
  tooltipElement.style.left = `${left}px`;
}

/**
 * Hide tooltip
 */
function hideTooltip() {
  if (tooltipElement) {
    tooltipElement.classList.remove('enorett-visible');
    
    setTimeout(() => {
      if (tooltipElement && tooltipElement.parentNode) {
        tooltipElement.parentNode.removeChild(tooltipElement);
      }
      tooltipElement = null;
      isTooltipVisible = false;
    }, 200);
  }
  
  document.removeEventListener('click', handleClickOutside);
}

/**
 * Handle clicks outside tooltip
 */
function handleClickOutside(event) {
  if (tooltipElement && !tooltipElement.contains(event.target)) {
    hideTooltip();
  }
}

/**
 * Clean up when page unloads
 */
window.addEventListener('beforeunload', () => {
  hideTooltip();
});

// Initialize content script
init();

