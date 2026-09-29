/**
 * Credential name masking for screen sharing.
 *
 * `codex-ae5d455f-first.last@example.dev-pro.json` → `codex-ae5d455f-f•••@e•••.dev-pro.json`.
 * Only the email is touched: the provider prefix, hash and plan suffix stay
 * readable so rows remain distinguishable while nothing personal is on screen.
 *
 * Pure — tests/quotaLedgerModel.test.ts pins the shapes.
 */

const MASK = '•••';

/**
 * An email embedded in a file name.
 *
 * The local part deliberately excludes `-`: file names join their segments
 * with it (`codex-<hash>-<email>-<plan>`), and `-` is also legal inside an
 * address, so the two cannot be told apart by syntax. Excluding it keeps the
 * prefix and hash readable at the cost of leaving a hyphenated local part
 * partly visible — which is why callers pass the credential's real `email`
 * when the backend provides one (see `maskCredentialName`). The TLD must not
 * be followed by another domain character, so `first@example.com-pro` stops at
 * `.com` and the plan suffix survives.
 */
const EMBEDDED_EMAIL = /([A-Za-z0-9._%+]+)@((?:[A-Za-z0-9-]+\.)+)([A-Za-z]{2,})(?![A-Za-z0-9.])/g;

const maskParts = (local: string, domain: string, tld: string): string => {
  const firstDomainLabel = domain.split('.')[0] ?? '';
  return `${local.charAt(0)}${MASK}@${firstDomainLabel.charAt(0)}${MASK}.${tld}`;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Mask every email-shaped run inside `value`. */
export const maskEmail = (value: string): string =>
  value.replace(EMBEDDED_EMAIL, (_match, local: string, domain: string, tld: string) =>
    maskParts(local, domain, tld)
  );

/** Masked form of one known address, or the address unchanged when it isn't one. */
export const maskKnownEmail = (email: string): string => {
  const at = email.indexOf('@');
  const lastDot = email.lastIndexOf('.');
  if (at <= 0 || lastDot <= at + 1) return email;
  return maskParts(email.slice(0, at), email.slice(at + 1, lastDot + 1), email.slice(lastDot + 1));
};

/**
 * Mask the email inside a credential file name, keeping the `.json` suffix.
 *
 * With `knownEmail` (the backend's `email` field) the replacement is exact and
 * case-insensitive, so a hyphenated local part is fully covered; without it the
 * embedded-email pattern is the fallback.
 */
export const maskCredentialName = (name: string, knownEmail?: string | null): string => {
  const trimmed = name.trim();
  const hasJson = /\.json$/i.test(trimmed);
  const base = hasJson ? trimmed.slice(0, -5) : trimmed;
  const known = typeof knownEmail === 'string' ? knownEmail.trim() : '';
  let masked: string;
  if (known && base.toLowerCase().includes(known.toLowerCase())) {
    masked = maskEmail(base.replace(new RegExp(escapeRegExp(known), 'ig'), maskKnownEmail(known)));
  } else {
    masked = maskEmail(base);
  }
  return hasJson ? `${masked}${trimmed.slice(-5)}` : masked;
};

export const containsEmail = (value: string): boolean => {
  EMBEDDED_EMAIL.lastIndex = 0;
  const found = EMBEDDED_EMAIL.test(value.replace(/\.json$/i, ''));
  EMBEDDED_EMAIL.lastIndex = 0;
  return found;
};

/**
 * Collapse long hex digests inside a file name so a plugin-materialized
 * credential (`opencode-go-key-<sha256>.json`) fits on one line. Short hashes
 * such as the 8-char Codex prefix are left alone; the full name goes in `title`.
 */
export const shortenCredentialName = (name: string, keep = 12): string =>
  name.replace(/[0-9a-f]{24,}/gi, (digest) => `${digest.slice(0, keep)}…`);

/**
 * Credential title for cards, ledger rows and timeline lanes. When the file
 * name does not carry the account email (plugin key records such as
 * `opencode-go-key-<sha256>.json`), the email leads so the account reads the
 * same way it does in Claude and Codex file names.
 */
export const credentialDisplayName = (
  name: string,
  email: string | null | undefined,
  maskEmails: boolean
): string => {
  const shown = shortenCredentialName(maskEmails ? maskCredentialName(name, email) : name);
  const known = typeof email === 'string' ? email.trim() : '';
  if (!known || name.toLowerCase().includes(known.toLowerCase())) return shown;
  return `${maskEmails ? maskKnownEmail(known) : known} · ${shown}`;
};
