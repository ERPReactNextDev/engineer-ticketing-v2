/**
 * Storage Helper for CONX
 * Detects if running in an iframe and uses prefixed localStorage keys
 * to prevent conflicts with parent applications (e.g., TaskFlow)
 */

const STORAGE_PREFIX = "conx_";

/**
 * Check if the current window is running inside an iframe
 * Returns false during SSR (window not available)
 */
export const isInIframe = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
};

/**
 * Get a prefixed key if in iframe, otherwise return the key as-is
 */
const getPrefixedKey = (key: string): string => {
  return isInIframe() ? `${STORAGE_PREFIX}${key}` : key;
};

/**
 * localStorage wrapper that handles iframe isolation
 * Returns null/does nothing during SSR
 */
export const conxStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    const prefixedKey = getPrefixedKey(key);
    return localStorage.getItem(prefixedKey);
  },

  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    const prefixedKey = getPrefixedKey(key);
    localStorage.setItem(prefixedKey, value);
  },

  removeItem: (key: string): void => {
    if (typeof window === "undefined") return;
    const prefixedKey = getPrefixedKey(key);
    localStorage.removeItem(prefixedKey);
  },

  clear: (): void => {
    if (typeof window === "undefined") return;
    // Only clear CONX-prefixed keys when in iframe
    if (isInIframe()) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } else {
      localStorage.clear();
    }
  },

  // Check if a key exists
  hasItem: (key: string): boolean => {
    if (typeof window === "undefined") return false;
    const prefixedKey = getPrefixedKey(key);
    return localStorage.getItem(prefixedKey) !== null;
  },
};

/**
 * Migration helper: migrate existing non-prefixed keys to prefixed keys
 * Call this once on app initialization when in iframe
 */
export const migrateToPrefixedStorage = (): void => {
  if (typeof window === "undefined") return;
  if (!isInIframe()) return;

  const keysToMigrate = [
    "userId",
    "userName",
    "engiconnect_role",
    "userRole",
    "userDepartment",
    "department",
    "deviceId",
  ];

  keysToMigrate.forEach(key => {
    const value = localStorage.getItem(key);
    if (value && !conxStorage.hasItem(key)) {
      conxStorage.setItem(key, value);
      // Don't remove the original key to avoid breaking the parent app
    }
  });
};
