/**
 * Validation helpers
 */

/**
 * Validate the API key charset (only printable ASCII allowed)
 */
export function isValidApiKeyCharset(key: string): boolean {
  if (!key) return false;
  return /^[\x21-\x7E]+$/.test(key);
}
