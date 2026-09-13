/**
 * Credential identity derivation: the card's primary line shows the "account", not the file name.
 * React-free -- consumed directly by tests/authFileIdentity.test.ts.
 *
 * Background: real file names look like codex-<hash8>-<email>-<plan>.json; the email sits in
 * the middle, so single-line tail truncation keeps only the provider prefix the type badge
 *
 * already conveys.
 *
 * Two hard rules:
 * 1. Read only email / projectId. The backend also sends account, but for api-key credentials
 *    account IS the API key itself (sdk/cliproxy/auth/types.go AccountInfo); putting it in the
 *    primary line, title or search haystack leaks the secret. For oauth, account duplicates email.
 * 2. Never regex the email out of the file name. codex uses '-' as separator, but '-' is legal
 *    in both the local part and the domain: codex-abc12345-first-last@example.com-team cannot
 *    be split correctly by any regex -- it only yields plausible-looking wrong values. Providers
 *    that need email expose json:"email" on the backend; kimi has no email in the file name anyway.
 */

import type { AuthFileItem } from '@/types';

export type AuthFileIdentityKind = 'email' | 'projectId' | 'fileName';

export type AuthFileIdentity = {
  /** Card primary line. Empty string when there is no identity clue at all --
   *  no fake placeholder. */
  primary: string;
  /** Source of the primary line. For 'fileName' it renders in mono and the secondary line is
   *  omitted. */
  kind: AuthFileIdentityKind;
  /** Card secondary line (file name without .json); null = do not render the line. */
  secondary: string | null;
  /** Original full file name, used as the secondary line's title. */
  fullName: string;
};

/** AuthFileItem has an index signature, so non-string backend values pass type-check; guard it. */
const readIdentityText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/** Strip the .json suffix (case-insensitive), only when something remains afterwards. */
export const stripJsonExtension = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed.length <= 5) return trimmed;
  return trimmed.toLowerCase().endsWith('.json') ? trimmed.slice(0, -5) : trimmed;
};

/**
 * Identity fallback chain: email -> projectId -> file name (without .json).
 * Deliberately provider-agnostic: runtime-only virtual credentials (name === email === channel ID)
 * are handled structurally by the secondary-line dedupe guard, which is sturdier than a provider
 * allowlist.
 */
export const deriveAuthFileIdentity = (file: AuthFileItem): AuthFileIdentity => {
  const fullName = readIdentityText(file.name);
  const base = stripJsonExtension(fullName);
  const email = readIdentityText(file.email);
  const projectId = readIdentityText(file.projectId);

  const kind: AuthFileIdentityKind = email ? 'email' : projectId ? 'projectId' : 'fileName';
  const primary = email || projectId || base;

  const secondary =
    kind === 'fileName' || !base || base.toLowerCase() === primary.toLowerCase() ? null : base;

  return { primary, kind, secondary, fullName };
};
