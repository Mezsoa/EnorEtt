/**
 * EnorEtt Background Service Worker
 * Handles context menu, message passing, and extension lifecycle
 */

// Context menu item ID
const CONTEXT_MENU_ID = 'enorett-check';

/**
 * Initialize extension on install
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('EnorEtt installed:', details.reason);
  
  // Create context menu
  createContextMenu();
  
  // Show welcome notification on first install
  if (details.reason === 'install') {
    showWelcomeNotification();
  }
});

/**
 * Create context menu for checking selected text
 */
function createContextMenu() {
  // Remove existing menu items
  chrome.contextMenus.removeAll(() => {
    // Create new context menu item
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Kolla en/ett för "%s"',
      contexts: ['selection'],
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error creating context menu:', chrome.runtime.lastError);
      } else {
        console.log('Context menu created successfully');
      }
    });
  });
}

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID) {
    const selectedText = info.selectionText.trim();
    
    if (selectedText) {
      // Extract first word if multiple words selected
      const word = selectedText.split(/\s+/)[0].toLowerCase();
      
      // Store the word for the popup to pick up
      chrome.storage.local.set({ pendingWord: word });
      
      // Open popup or send message to existing popup
      chrome.action.openPopup().catch(() => {
        // If popup is already open, send message to it
        chrome.runtime.sendMessage({
          type: 'LOOKUP_WORD',
          word: word
        }).catch(err => {
          console.error('Error sending message:', err);
        });
      });
    }
  }
});

/**
 * Handle messages from popup or content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  switch (message.type) {
    case 'FEEDBACK':
      handleFeedback(message.data);
      sendResponse({ success: true });
      break;
      
    case 'TRACK_EVENT':
      trackEvent(message.data);
      sendResponse({ success: true });
      break;
      
    case 'GET_STATS':
      getExtensionStats().then(stats => {
        sendResponse({ success: true, stats });
      });
      return true; // Keep channel open for async response
      
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
  
  return false;
});

/**
 * Handle user feedback
 */
function handleFeedback(data) {
  console.log('User feedback:', data);
  
  // TODO: Send to analytics service
  // Example: Send to Google Analytics, Mixpanel, or custom backend
  
  // Store feedback locally for now
  chrome.storage.local.get(['feedback'], (result) => {
    const feedback = result.feedback || [];
    feedback.push({
      ...data,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 100 feedback items
    if (feedback.length > 100) {
      feedback.shift();
    }
    
    chrome.storage.local.set({ feedback });
  });
}

/**
 * Track analytics event
 */
function trackEvent(data) {
  console.log('Track event:', data);
  
  // TODO: Send to analytics service
  // Example: Google Analytics 4, Mixpanel, Amplitude, etc.
  
  // Store event locally for now
  chrome.storage.local.get(['events'], (result) => {
    const events = result.events || [];
    events.push({
      ...data,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 1000 events
    if (events.length > 1000) {
      events.shift();
    }
    
    chrome.storage.local.set({ events });
  });
}

/**
 * Get extension statistics
 */
async function getExtensionStats() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['events', 'feedback'], (result) => {
      const events = result.events || [];
      const feedback = result.feedback || [];
      
      const stats = {
        totalLookups: events.filter(e => e.type === 'lookup').length,
        totalFeedback: feedback.length,
        positiveFeedback: feedback.filter(f => f.feedback === 'yes').length,
        negativeFeedback: feedback.filter(f => f.feedback === 'no').length,
      };
      
      resolve(stats);
    });
  });
}

/**
 * Show welcome notification on first install
 */
function showWelcomeNotification() {
  // Note: notifications require permission in manifest
  console.log('Welcome to EnorEtt!');
  
  // Optional: Open welcome page or tutorial
  // chrome.tabs.create({ url: 'welcome.html' });
}

/**
 * Handle extension icon click
 */
chrome.action.onClicked.addListener((tab) => {
  // This is handled automatically by the popup
  // But we can add custom logic here if needed
  console.log('Extension icon clicked');
});

/**
 * Listen for keyboard shortcuts (if configured in manifest)
 */
chrome.commands.onCommand.addListener((command) => {
  console.log('Command received:', command);
  
  if (command === 'open-popup') {
    chrome.action.openPopup();
  }
});

/**
 * Handle extension updates
 */
chrome.runtime.onUpdateAvailable.addListener((details) => {
  console.log('Update available:', details);
  // Auto-reload extension after update
  chrome.runtime.reload();
});

/**
 * Cleanup on extension shutdown
 */
chrome.runtime.onSuspend.addListener(() => {
  console.log('EnorEtt service worker suspending');
  // Perform any cleanup here
});

/**
 * Initialize subscription sync
 */
async function initSubscriptionSync() {
  try {
    // Sync subscription status periodically
    const syncSubscription = async () => {
      try {
        // Get user ID from storage
        const userData = await chrome.storage.local.get(['enorett_userId']);
        const userId = userData.enorett_userId;
        
        if (!userId) {
          return;
        }
        
        // Fetch subscription status from API
        const response = await fetch(`https://api.enorett.se/api/subscription/status?userId=${encodeURIComponent(userId)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.subscription) {
            await chrome.storage.local.set({
              enorett_subscription: {
                ...data.subscription,
                lastSynced: new Date().toISOString()
              }
            });
          } else {
            // No active subscription
            await chrome.storage.local.remove(['enorett_subscription']);
          }
        }
      } catch (error) {
        console.error('Error syncing subscription:', error);
      }
    };
    
    // Sync immediately on startup
    await syncSubscription();
    
    // Set up periodic sync (every hour)
    setInterval(syncSubscription, 60 * 60 * 1000);
  } catch (error) {
    console.error('Error initializing subscription sync:', error);
  }
}

/**
 * Handle payment success callback
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PAYMENT_SUCCESS') {
    handlePaymentSuccess(message.data);
    sendResponse({ success: true });
  }
  return false;
});

/**
 * Handle payment success
 */
async function handlePaymentSuccess(data) {
  try {
    // If sessionId is provided, fetch subscription details
    if (data.sessionId) {
      const response = await fetch(`https://api.enorett.se/api/subscription/status?sessionId=${encodeURIComponent(data.sessionId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.subscription) {
          await chrome.storage.local.set({
            enorett_subscription: {
              ...result.subscription,
              lastSynced: new Date().toISOString()
            }
          });
          
          // Notify all popups
          chrome.runtime.sendMessage({
            type: 'SUBSCRIPTION_UPDATED',
            subscription: result.subscription
          }).catch(() => {
            // Popup might not be open, ignore
          });
        }
      }
    } else if (data.subscription) {
      // Direct subscription data provided
      await chrome.storage.local.set({
        enorett_subscription: {
          ...data.subscription,
          lastSynced: new Date().toISOString()
        }
      });
      
      // Notify all popups
      chrome.runtime.sendMessage({
        type: 'SUBSCRIPTION_UPDATED',
        subscription: data.subscription
      }).catch(() => {
        // Popup might not be open, ignore
      });
    }
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

// Initialize subscription sync
initSubscriptionSync();

// Log when service worker starts
console.log('EnorEtt background service worker started');

