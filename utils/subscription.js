/**
 * EnorEtt Subscription Management
 * Handles Pro subscription status, sync, and validation
 */

const SUBSCRIPTION_STORAGE_KEY = 'enorett_subscription';
const SUBSCRIPTION_SYNC_INTERVAL = 60 * 60 * 1000; // 1 hour
const API_ENDPOINT = 'https://api.enorett.se';

/**
 * Get subscription status from local storage
 * @returns {Promise<object|null>} Subscription object or null
 */
async function getSubscriptionStatus() {
  try {
    const result = await chrome.storage.local.get([SUBSCRIPTION_STORAGE_KEY]);
    return result[SUBSCRIPTION_STORAGE_KEY] || null;
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return null;
  }
}

/**
 * Check if user has active Pro subscription/purchase
 * @returns {Promise<boolean>} True if user has active Pro access
 */
async function isProUser() {
  const subscription = await getSubscriptionStatus();
  
  if (!subscription) {
    return false;
  }
  
  // Check if subscription/purchase is active
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    return false;
  }
  
  // Check if purchase hasn't expired (for one-time payments)
  if (subscription.expiresAt) {
    const expiresAt = new Date(subscription.expiresAt);
    if (expiresAt < new Date()) {
      // Access expired, clear it
      await clearSubscription();
      return false;
    }
  }
  
  // If expiresAt is null, it's lifetime access (one-time payment)
  // If purchaseType is 'one-time' and no expiresAt, it's lifetime
  if (subscription.purchaseType === 'one-time' && !subscription.expiresAt) {
    return true; // Lifetime access
  }
  
  return true;
}

/**
 * Set subscription status in local storage
 * @param {object} subscriptionData - Subscription data object
 */
async function setSubscriptionStatus(subscriptionData) {
  try {
    await chrome.storage.local.set({
      [SUBSCRIPTION_STORAGE_KEY]: {
        ...subscriptionData,
        lastSynced: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error setting subscription status:', error);
  }
}

/**
 * Clear subscription status
 */
async function clearSubscription() {
  try {
    await chrome.storage.local.remove([SUBSCRIPTION_STORAGE_KEY]);
  } catch (error) {
    console.error('Error clearing subscription:', error);
  }
}

/**
 * Sync subscription status with backend API
 * @param {string} userId - Optional user ID (if available)
 * @returns {Promise<object|null>} Updated subscription status or null
 */
async function syncSubscription(userId = null) {
  try {
    // Get user ID from storage if not provided
    if (!userId) {
      const userData = await chrome.storage.local.get(['enorett_userId']);
      userId = userData.enorett_userId;
    }
    
    // If no user ID, user is not logged in/subscribed
    if (!userId) {
      return null;
    }
    
    // Try multiple API endpoints
    const apiEndpoints = [
      `${API_ENDPOINT}/api/subscription/status`,
      'https://api.enorett.se/api/subscription/status',
      'https://www.enorett.se/api/subscription/status',
      'https://enorett.se/api/subscription/status'
    ];
    
    let lastError = null;
    
    for (const endpoint of apiEndpoints) {
      try {
        const url = `${endpoint}?userId=${encodeURIComponent(userId)}`;
        
        // Add timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.subscription) {
            await setSubscriptionStatus(data.subscription);
            return data.subscription;
          }
          // No active subscription
          await clearSubscription();
          return null;
        } else {
          lastError = new Error(`API error: ${response.status}`);
        }
      } catch (error) {
        lastError = error;
        // Try next endpoint
        continue;
      }
    }
    
    // All endpoints failed
    if (lastError) {
      throw lastError;
    }
    
    // Should never reach here, but just in case
    return null;
  } catch (error) {
    console.error('Error syncing subscription:', error);
    // On error, return cached subscription if available
    return await getSubscriptionStatus();
  }
}

/**
 * Check if subscription has expired
 * @param {object} subscription - Subscription object
 * @returns {boolean} True if subscription has expired
 */
function checkSubscriptionExpiry(subscription) {
  if (!subscription || !subscription.expiresAt) {
    return false;
  }
  
  const expiresAt = new Date(subscription.expiresAt);
  return expiresAt < new Date();
}

/**
 * Get subscription expiry date
 * @returns {Promise<Date|null>} Expiry date or null
 */
async function getSubscriptionExpiry() {
  const subscription = await getSubscriptionStatus();
  
  if (!subscription || !subscription.expiresAt) {
    return null;
  }
  
  return new Date(subscription.expiresAt);
}

/**
 * Get days until subscription expires
 * @returns {Promise<number|null>} Days until expiry or null
 */
async function getDaysUntilExpiry() {
  const expiryDate = await getSubscriptionExpiry();
  
  if (!expiryDate) {
    return null;
  }
  
  const now = new Date();
  const diffTime = expiryDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : 0;
}

/**
 * Initialize subscription sync (call periodically)
 */
async function initSubscriptionSync() {
  // Sync immediately
  await syncSubscription();
  
  // Set up periodic sync
  setInterval(async () => {
    await syncSubscription();
  }, SUBSCRIPTION_SYNC_INTERVAL);
}

/**
 * Handle subscription update from payment success callback
 * @param {object} subscriptionData - Subscription data from payment callback
 */
async function handleSubscriptionUpdate(subscriptionData) {
  await setSubscriptionStatus({
    status: subscriptionData.status || 'active',
    plan: subscriptionData.plan || 'pro',
    expiresAt: subscriptionData.expiresAt,
    userId: subscriptionData.userId,
    stripeCustomerId: subscriptionData.stripeCustomerId,
    stripeSubscriptionId: subscriptionData.stripeSubscriptionId
  });
  
  // Notify popup if open
  try {
    chrome.runtime.sendMessage({
      type: 'SUBSCRIPTION_UPDATED',
      subscription: subscriptionData
    });
  } catch (error) {
    // Popup might not be open, ignore
  }
}

// Initialize sync on load (for background script)
if (typeof chrome !== 'undefined' && chrome.runtime) {
  // Only initialize if this is the background script context
  if (typeof window === 'undefined' || !window.document) {
    initSubscriptionSync();
  }
}
