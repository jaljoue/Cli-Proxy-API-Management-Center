/**
 * Pure logic for the auth file list: wildcard search, field matching, sorting.
 * React-free -- consumed directly by tests/authFilesListLogic.test.ts.
 */

import type { AuthFileItem } from '@/types';
import { normalizeProviderKey } from './constants';
import { deriveAuthFileIdentity } from './identity';
import type { AuthFilesSortMode } from './uiState';

const escapeWildcardSearchSegment = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Returns null without '*' (includes path). Deliberately no ^/$ anchors, keeping substring
 *  semantics. */
export const buildWildcardSearch = (value: string): RegExp | null => {
  if (!value.includes('*')) return null;
  const pattern = value.split('*').map(escapeWildcardSearchSegment).join('.*');
  return new RegExp(pattern, 'i');
};

/**
 * Search haystack: file name + type + provider + account email + project ID.
 * Explicitly excludes account -- for api-key credentials it IS the API key; see identity.ts.
 */
export const matchesAuthFileSearch = (
  file: AuthFileItem,
  term: string,
  wildcard: RegExp | null
): boolean => {
  if (!term) return true;
  const needle = term.toLowerCase();
  return [file.name, file.type, file.provider, file.email, file.projectId].some((value) => {
    const content = (value || '').toString();
    return wildcard ? wildcard.test(content) : content.toLowerCase().includes(needle);
  });
};

/** Returns a new array without mutating the input. Unknown modes return an unsorted copy. */
export const sortAuthFiles = (files: AuthFileItem[], mode: AuthFilesSortMode): AuthFileItem[] => {
  const copy = [...files];
  if (mode === 'default') {
    copy.sort((a, b) => {
      const providerA = normalizeProviderKey(String(a.provider ?? a.type ?? 'unknown'));
      const providerB = normalizeProviderKey(String(b.provider ?? b.type ?? 'unknown'));
      const providerCompare = providerA.localeCompare(providerB);
      if (providerCompare !== 0) return providerCompare;
      return a.name.localeCompare(b.name);
    });
  } else if (mode === 'az') {
    // Sort by the card's primary line (email when present) so what you see is the sort order;
    // ties broken by file name.
    // Decorate once to avoid re-deriving inside the comparator.
    const keys = new Map(copy.map((file) => [file, deriveAuthFileIdentity(file).primary]));
    copy.sort(
      (a, b) => (keys.get(a) ?? '').localeCompare(keys.get(b) ?? '') || a.name.localeCompare(b.name)
    );
  } else if (mode === 'priority') {
    copy.sort((a, b) => {
      const pa = typeof a.priority === 'number' ? a.priority : 0;
      const pb = typeof b.priority === 'number' ? b.priority : 0;
      return pb - pa; // higher priority first
    });
  }
  return copy;
};
