/**
 * Local storage obfuscation service (reversible)
 * Based on the original project's src/utils/secure-storage.js
 *
 * IMPORTANT: this is not a security boundary, just light obfuscation against casual reading.
 */

import { obfuscateData, deobfuscateData, isObfuscated } from '@/utils/encryption';

interface StorageOptions {
  /**
   * Whether to obfuscate the stored value. This was historically called `encrypt`,
   * but the implementation is reversible obfuscation, not cryptographic security.
   */
  obfuscate?: boolean;
  encrypt?: boolean;
}

class ObfuscatedStorageService {
  /**
   * Store a value
   */
  setItem(key: string, value: unknown, options: StorageOptions = {}): void {
    const obfuscate = options.obfuscate ?? options.encrypt ?? true;

    if (value === null || value === undefined) {
      this.removeItem(key);
      return;
    }

    const stringValue = JSON.stringify(value);
    const storedValue = obfuscate ? obfuscateData(stringValue) : stringValue;

    localStorage.setItem(key, storedValue);
  }

  /**
   * Read a value
   */
  getItem<T = unknown>(key: string, options: StorageOptions = {}): T | null {
    const obfuscate = options.obfuscate ?? options.encrypt ?? true;

    const raw = localStorage.getItem(key);
    if (raw === null) return null;

    try {
      const decrypted = obfuscate ? deobfuscateData(raw) : raw;
      return JSON.parse(decrypted) as T;
    } catch {
      // JSON parse failed; try to stay compatible with legacy plain-string data (non-JSON)
      try {
        // If obfuscated, deobfuscate and return the result as-is
        if (obfuscate && isObfuscated(raw)) {
          const decrypted = deobfuscateData(raw);
          // Still not JSON after deobfuscation: return the raw string
          return decrypted as T;
        }
        // Non-obfuscated plain string: return directly
        return raw as T;
      } catch {
        // Total failure: silently return null (avoid polluting the console)
        return null;
      }
    }
  }

  /**
   * Remove a value
   */
  removeItem(key: string): void {
    localStorage.removeItem(key);
  }

  /**
   * Migrate legacy plaintext cache entries to the obfuscated format
   */
  migratePlaintextKeys(keys: string[]): void {
    keys.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;

      // Already obfuscated: skip
      if (isObfuscated(raw)) {
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Original value is not JSON: use the string as-is
        parsed = raw;
      }

      try {
        this.setItem(key, parsed);
      } catch (error) {
        console.warn(`Failed to migrate key "${key}":`, error);
      }
    });
  }
}

export const obfuscatedStorage = new ObfuscatedStorageService();
