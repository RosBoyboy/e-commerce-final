/** sessionStorage key: JSON array of cart line `item.key` strings to checkout */
export const CHECKOUT_SELECTED_KEYS_STORAGE = 'urbanNxt_checkout_selected_keys';

let consumedKeysCache;

/** Call from cart before writing new selection so the next checkout read is fresh */
export function resetCheckoutSelectionCache() {
  consumedKeysCache = undefined;
}

/**
 * Read & remove checkout line keys from sessionStorage once per navigation cycle.
 * Survives React 18 Strict Mode double mount.
 */
export function consumeCheckoutLineKeys() {
  if (consumedKeysCache !== undefined) {
    return consumedKeysCache;
  }
  if (typeof window === 'undefined') {
    consumedKeysCache = null;
    return null;
  }
  try {
    const raw = sessionStorage.getItem(CHECKOUT_SELECTED_KEYS_STORAGE);
    if (!raw) {
      consumedKeysCache = null;
      return null;
    }
    const keys = JSON.parse(raw);
    sessionStorage.removeItem(CHECKOUT_SELECTED_KEYS_STORAGE);
    consumedKeysCache = Array.isArray(keys) ? keys : null;
    return consumedKeysCache;
  } catch {
    consumedKeysCache = null;
    return null;
  }
}
