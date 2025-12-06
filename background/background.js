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
      
    case 'GET_USER_ID':
      getOrCreateUserId().then(userId => {
        sendResponse({ userId: userId });
      }).catch(() => {
        sendResponse({ userId: null });
      });
      return true; // Keep channel open for async response
      
    case 'GET_AUTH':
      chrome.storage.local.get(['enorett_auth']).then(result => {
        sendResponse({ auth: result.enorett_auth || null });
      }).catch(() => {
        sendResponse({ auth: null });
      });
      return true; // Keep channel open for async response
      
    case 'AUTH_LOGIN':
      // Save auth data from login page
      if (message.data && message.data.user) {
        chrome.storage.local.set({
          enorett_auth: message.data,
          enorett_userId: message.data.user.userId,
          enorett_userEmail: message.data.user.email
        }).then(() => {
          // Notify all popups that auth was updated
          chrome.runtime.sendMessage({
            type: 'AUTH_UPDATED',
            auth: message.data
          }).catch(() => {
            // Popup might not be open, ignore
          });
          sendResponse({ success: true });
        }).catch(() => {
          sendResponse({ success: false });
        });
        return true;
      }
      sendResponse({ success: false });
      break;
      
    case 'PAYMENT_SUCCESS':
      handlePaymentSuccess(message.data);
      sendResponse({ success: true });
      break;
      
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
 * Generate or get user ID
 */
async function getOrCreateUserId() {
  try {
    const userData = await chrome.storage.local.get(['enorett_userId']);
    let userId = userData.enorett_userId;
    
    if (!userId) {
      // Generate a unique user ID
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      await chrome.storage.local.set({ enorett_userId: userId });
      console.log('Generated new userId:', userId);
    }
    
    return userId;
  } catch (error) {
    console.error('Error getting/creating userId:', error);
    return null;
  }
}

/**
 * Initialize subscription sync
 */
async function initSubscriptionSync() {
  try {
    // Ensure userId exists
    await getOrCreateUserId();
    
    // Sync subscription status periodically
    const syncSubscription = async () => {
      try {
        // Get auth data first (preferred method)
        const authData = await chrome.storage.local.get(['enorett_auth']);
        const auth = authData.enorett_auth;
        
        // Get user ID from auth or fallback to old method
        let userId = null;
        if (auth && auth.user) {
          userId = auth.user.userId;
        } else {
        const userData = await chrome.storage.local.get(['enorett_userId']);
          userId = userData.enorett_userId;
        }
        
        if (!userId) {
          console.log('No userId found, skipping subscription sync');
          return;
        }
        
        // API endpoint - try multiple endpoints if needed
        const apiEndpoints = [
          'https://api.enorett.se/api/subscription/status',
          'https://www.enorett.se/api/subscription/status',
          'https://enorett.se/api/subscription/status'
        ];
        
        let lastError = null;
        
        for (const endpoint of apiEndpoints) {
          try {
            const url = `${endpoint}?userId=${encodeURIComponent(userId)}`;
            console.log('Syncing subscription from:', url);
            
            // Build headers with auth
            const headers = {
              'Content-Type': 'application/json',
              'X-User-Id': userId
            };
            
            // Add timeout to fetch
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(url, {
              method: 'GET',
              headers: headers,
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.subscription) {
                await chrome.storage.local.set({
                  enorett_subscription: {
                    ...data.subscription,
                    lastSynced: new Date().toISOString()
                  }
                });
                console.log('✅ Subscription synced successfully');
                return; // Success, exit function
              } else {
                // No active subscription
                await chrome.storage.local.remove(['enorett_subscription']);
                console.log('ℹ️ No active subscription found');
                return;
              }
            } else {
              console.warn(`API returned status ${response.status} from ${endpoint}`);
              lastError = new Error(`HTTP ${response.status}`);
            }
          } catch (error) {
            console.warn(`Error fetching from ${endpoint}:`, error.message);
            lastError = error;
            // Try next endpoint
            continue;
          }
        }
        
        // If we get here, all endpoints failed
        if (lastError) {
          throw lastError;
        }
      } catch (error) {
        console.error('Error syncing subscription:', error);
        
        // Don't spam errors - only log if it's been a while since last sync
        chrome.storage.local.get(['enorett_subscription'], (result) => {
          const subscription = result.enorett_subscription;
          const lastSynced = subscription?.lastSynced;
          
          if (!lastSynced || new Date() - new Date(lastSynced) > 3600000) {
            // Only log error if last sync was more than 1 hour ago
            console.error('Failed to sync subscription after multiple attempts:', error.message);
          }
        });
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

// This listener is now merged with the main message handler above

/**
 * Handle payment success
 */
async function handlePaymentSuccess(data) {
  try {
    // Get auth data first (preferred method)
    const authData = await chrome.storage.local.get(['enorett_auth']);
    const auth = authData.enorett_auth;
    
    // Get userId from auth or fallback
    let userId = null;
    if (auth && auth.user) {
      userId = auth.user.userId;
    } else {
      userId = await getOrCreateUserId();
    }
    
    // If sessionId is provided, fetch subscription details
    if (data.sessionId) {
      // Try multiple endpoints
      const endpoints = [
        `https://api.enorett.se/api/subscription/status?sessionId=${encodeURIComponent(data.sessionId)}`,
        `https://www.enorett.se/api/subscription/status?sessionId=${encodeURIComponent(data.sessionId)}`,
        `https://enorett.se/api/subscription/status?sessionId=${encodeURIComponent(data.sessionId)}`
      ];
      
      let response = null;
      for (const url of endpoints) {
        try {
          const headers = {
            'Content-Type': 'application/json'
          };
          if (userId) {
            headers['X-User-Id'] = userId;
          }
          
          response = await fetch(url, {
            method: 'GET',
            headers: headers
          });
          if (response.ok) break;
        } catch (e) {
          continue;
        }
      }
      
      if (response && response.ok) {
        const result = await response.json();
        if (result.success && result.subscription) {
          // Save subscription, userId, and email
          const storageData = {
            enorett_subscription: {
              ...result.subscription,
              userId: result.subscription.userId || userId,
              lastSynced: new Date().toISOString()
            },
            enorett_userId: result.subscription.userId || userId
          };
          
          // Save email if available
          if (result.user && result.user.email) {
            storageData.enorett_userEmail = result.user.email;
          }
          
          await chrome.storage.local.set(storageData);
          
          console.log('✅ Premium purchase confirmed! Status saved.');
          
          // Notify all popups
          chrome.runtime.sendMessage({
            type: 'SUBSCRIPTION_UPDATED',
            subscription: result.subscription
          }).catch(() => {
            // Popup might not be open, ignore
          });
          
          // Show success notification
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon-48.png'),
            title: 'EnorEtt Premium',
            message: 'Din Premium-prenumeration är nu aktiv! 🎉'
          });
        }
      }
    } else if (data.subscription) {
      // Direct subscription data provided
      const storageData = {
        enorett_subscription: {
          ...data.subscription,
          userId: data.subscription.userId || userId,
          lastSynced: new Date().toISOString()
        },
        enorett_userId: data.subscription.userId || userId
      };
      
      // Save email if available
      if (data.user && data.user.email) {
        storageData.enorett_userEmail = data.user.email;
      }
      
      await chrome.storage.local.set(storageData);
      
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

