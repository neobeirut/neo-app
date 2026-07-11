import CryptoJS from 'crypto-js';

/**
 * Global Encryption Toggle Flag
 * Set `ENCRYPTION_ENABLED` to:
 * - `false`: Deactivates encryption app-wide. Saves unencrypted data directly to database columns.
 * - `true`: Reactivates AES Zero-Knowledge local payload encryption.
 */
export const ENCRYPTION_ENABLED = false;

export const DEFAULT_DECRYPTION_KEY = 'neo_default_sec_2026';

/**
 * Gets the decryption key automatically for the current user/restaurant.
 * Fallbacks cleanly to ensure users are never blocked by a passphrase modal.
 */
export const getStoredDecryptionKey = (user?: any): string => {
  if (user?.restaurants?.settings?.decryption_key) {
    return user.restaurants.settings.decryption_key;
  }
  const savedKey = localStorage.getItem('flow_decryption_key');
  if (savedKey) return savedKey;

  if (user?.restaurant_id) {
    return `neo_sec_${user.restaurant_id}`;
  }
  return DEFAULT_DECRYPTION_KEY;
};

/**
 * Encrypts a string value using AES encryption and a secret passphrase.
 * If ENCRYPTION_ENABLED is false, returns empty string so raw DB columns are used instead.
 */
export const encryptAES = (text: string, secretKey: string): string => {
  if (!ENCRYPTION_ENABLED || !text) return '';
  const keyToUse = secretKey || DEFAULT_DECRYPTION_KEY;
  return CryptoJS.AES.encrypt(text, keyToUse).toString();
};

/**
 * Decrypts a ciphertext string using AES decryption and a secret passphrase.
 * Returns the decrypted UTF-8 string, trying all candidate fallbacks if primary key fails.
 * Also handles raw JSON strings directly.
 */
export const decryptAES = (ciphertext: string, secretKey?: string, user?: any): string => {
  if (!ciphertext) return '';
  const trimmed = String(ciphertext).trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }

  const keyToUse = secretKey || getStoredDecryptionKey(user);

  const candidateKeys = Array.from(new Set([
    keyToUse,
    user?.restaurants?.settings?.decryption_key,
    user?.restaurant_id ? `neo_sec_${user.restaurant_id}` : null,
    DEFAULT_DECRYPTION_KEY,
    localStorage.getItem('flow_decryption_key'),
    'flow_default_sec_2026',
    'neo_sec_2026',
    'flow_sec_2026',
    'neo_flow_sec_2026',
    'flow_secret',
    'neo_secret',
    'secret'
  ])).filter(Boolean) as string[];

  for (const fk of candidateKeys) {
    try {
      const bytes = CryptoJS.AES.decrypt(trimmed, fk);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (decrypted && (decrypted.startsWith('{') || decrypted.startsWith('[') || decrypted.length > 0)) {
        return decrypted;
      }
    } catch (e) {
      // ignore
    }
  }

  return '';
};

