/**
 * Authentication utilities for EnorEtt extension
 */

const API_BASES = [
  'https://www.enorett.se',
  'https://api.enorett.se',
  'https://enorett.se'
];
const AUTH_STORAGE_KEY = 'enorett_auth';

/**
 * Fetch helper with domain fallback
 */
async function fetchWithFallback(path, options) {
  let lastError = null;
  for (const base of API_BASES) {
    const url = `${base}${path}`;
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return { response, base };
      }
      lastError = new Error(`HTTP ${response.status} at ${url}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('No endpoint reachable');
}

/**
 * Get current auth token and user info
 */
async function getAuth() {
  try {
    const result = await chrome.storage.local.get([AUTH_STORAGE_KEY]);
    return result[AUTH_STORAGE_KEY] || null;
  } catch (error) {
    console.error('Error getting auth:', error);
    return null;
  }
}

/**
 * Save auth token and user info
 */
async function setAuth(authData) {
  try {
    await chrome.storage.local.set({
      [AUTH_STORAGE_KEY]: authData,
      enorett_userId: authData.user.userId,
      enorett_userEmail: authData.user.email
    });
  } catch (error) {
    console.error('Error saving auth:', error);
  }
}

/**
 * Clear auth data
 */
async function clearAuth() {
  try {
    await chrome.storage.local.remove([AUTH_STORAGE_KEY]);
  } catch (error) {
    console.error('Error clearing auth:', error);
  }
}

/**
 * Register new user
 */
async function register(email, password) {
  try {
    const { response } = await fetchWithFallback('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      await setAuth(data);
      
      // Also save subscription if returned
      if (data.subscription && typeof chrome !== 'undefined' && chrome.storage) {
        try {
          await chrome.storage.local.set({
            enorett_subscription: {
              ...data.subscription,
              lastSynced: new Date().toISOString()
            }
          });
        } catch (e) {
          console.warn('Could not save subscription:', e);
        }
      }
      
      return { success: true, data };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Login user
 */
async function login(email, password) {
  try {
    const { response } = await fetchWithFallback('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      await setAuth(data);
      
      // Also save subscription if returned
      if (data.subscription && typeof chrome !== 'undefined' && chrome.storage) {
        try {
          await chrome.storage.local.set({
            enorett_subscription: {
              ...data.subscription,
              lastSynced: new Date().toISOString()
            }
          });
        } catch (e) {
          console.warn('Could not save subscription:', e);
        }
      }
      
      return { success: true, data };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get current user info
 */
async function getCurrentUser() {
  try {
    const auth = await getAuth();
    if (!auth || !auth.user) {
      return null;
    }
    
    // Try to get fresh user info
    const { response } = await fetchWithFallback('/api/auth/me', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': auth.user.userId
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update stored auth
      await setAuth({ ...auth, user: data.user, subscription: data.subscription });
      
      // Also save subscription separately if returned
      if (data.subscription && typeof chrome !== 'undefined' && chrome.storage) {
        try {
          await chrome.storage.local.set({
            enorett_subscription: {
              ...data.subscription,
              lastSynced: new Date().toISOString()
            }
          });
        } catch (e) {
          console.warn('Could not save subscription:', e);
        }
      }
      
      return data.user;
    }
    
    return auth.user;
  } catch (error) {
    console.warn('Error getting current user:', error);
    // Return cached user if available
    const auth = await getAuth();
    return auth?.user || null;
  }
}

/**
 * Check if user is logged in
 */
async function isLoggedIn() {
  const auth = await getAuth();
  return !!auth && !!auth.user;
}

/**
 * Get auth headers for API requests
 */
async function getAuthHeaders() {
  const auth = await getAuth();
  if (!auth || !auth.user) {
    return {};
  }
  
  return {
    'X-User-Id': auth.user.userId
  };
}
