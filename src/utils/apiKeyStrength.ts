/**
 * API key strength estimate from character-set entropy and predictability penalties.
 * The UI consumes only tier and segments, so scoring changes do not require component changes.
 */

export type ApiKeyStrengthTier = 'weak' | 'fair' | 'good' | 'strong';

export interface ApiKeyStrength {
  tier: ApiKeyStrengthTier;
  /** Lit segments, from 0 to 4; 0 means empty input. */
  segments: number;
  /** Estimated entropy, rounded down to whole bits. */
  bits: number;
}

/** Tiers from weakest to strongest; the index equals lit segments minus one. */
const TIER_ORDER: readonly ApiKeyStrengthTier[] = ['weak', 'fair', 'good', 'strong'];

export const API_KEY_STRENGTH_SEGMENTS = TIER_ORDER.length;

// Match isValidApiKeyCharset's 94 visible ASCII characters, 0x21 through 0x7E.
const CHARSET_CLASSES: readonly { pattern: RegExp; size: number }[] = [
  { pattern: /[a-z]/, size: 26 },
  { pattern: /[A-Z]/, size: 26 },
  { pattern: /[0-9]/, size: 10 },
  { pattern: /[^a-zA-Z0-9]/, size: 32 },
];

/** Predictable password fragments incur a large penalty. */
const GUESSABLE_TOKENS: readonly string[] = [
  'password',
  'passwd',
  '123456',
  'qwerty',
  'admin',
  'secret',
  'apikey',
  'api-key',
  'letmein',
  'changeme',
  'iloveyou',
  'default',
  'test',
  'demo',
];

// Repeated and sequential characters contribute only a residual amount to effective length.
const REPEAT_WEIGHT = 0.25;
const SEQUENCE_WEIGHT = 0.35;
const GUESSABLE_FACTOR = 0.4;

// Entropy thresholds in bits. Random base62 of length 48 is about 285 bits; 32 hex characters
// give 128 bits.
const BITS_FOR_FAIR = 40;
const BITS_FOR_GOOD = 64;
const BITS_FOR_STRONG = 96;

// Cap tiers by length because short strings remain vulnerable to offline guessing despite
// estimated entropy.
const LENGTH_CAPS: readonly { below: number; tier: ApiKeyStrengthTier }[] = [
  { below: 8, tier: 'weak' },
  { below: 16, tier: 'fair' },
  { below: 24, tier: 'good' },
];

/** Low character diversity makes length-based entropy misleading, such as 32 copies of a. */
const MIN_UNIQUE_FOR_FAIR = 5;

/**
 * Repeated characters and continuations of ascending or descending sequences count only
 * partially.
 * Random strings rarely incur this penalty; patterned strings shrink substantially.
 */
function effectiveLength(key: string): number {
  let total = 0;
  let sequenceRun = 1;

  for (let index = 0; index < key.length; index += 1) {
    const code = key.charCodeAt(index);
    const previous = index > 0 ? key.charCodeAt(index - 1) : Number.NaN;

    if (code === previous) {
      total += REPEAT_WEIGHT;
      sequenceRun = 1;
      continue;
    }

    const delta = code - previous;
    if (delta === 1 || delta === -1) {
      sequenceRun += 1;
      // The first two characters count as new information; predictability starts with the third.
      total += sequenceRun >= 3 ? SEQUENCE_WEIGHT : 1;
      continue;
    }

    sequenceRun = 1;
    total += 1;
  }

  return total;
}

/**
 * Find the shortest period: deadbeefdeadbeef gives 8, abcabca gives 3, and nonperiodic strings
 * return their length.
 * Search the doubled string and account for incomplete trailing periods.
 */
function smallestPeriod(key: string): number {
  const period = `${key}${key}`.indexOf(key, 1);
  return period > 0 && period < key.length ? period : key.length;
}

function charsetSize(key: string): number {
  return CHARSET_CLASSES.reduce(
    (size, charClass) => (charClass.pattern.test(key) ? size + charClass.size : size),
    0
  );
}

function tierForBits(bits: number): ApiKeyStrengthTier {
  if (bits >= BITS_FOR_STRONG) return 'strong';
  if (bits >= BITS_FOR_GOOD) return 'good';
  if (bits >= BITS_FOR_FAIR) return 'fair';
  return 'weak';
}

function capTier(tier: ApiKeyStrengthTier, cap: ApiKeyStrengthTier): ApiKeyStrengthTier {
  return TIER_ORDER.indexOf(tier) <= TIER_ORDER.indexOf(cap) ? tier : cap;
}

/**
 * Estimate user-created API key strength for guidance only; this does not affect save
 * validation.
 */
export function evaluateApiKeyStrength(rawKey: string): ApiKeyStrength {
  const key = rawKey.trim();
  if (!key) return { tier: 'weak', segments: 0, bits: 0 };

  const pool = charsetSize(key);
  const lowerCased = key.toLowerCase();
  const guessable = GUESSABLE_TOKENS.some((token) => lowerCased.includes(token));
  // Guessing a periodic string requires one period; count repetitions only at residual value.
  const period = smallestPeriod(key);
  const length = effectiveLength(key.slice(0, period)) + (key.length - period) * REPEAT_WEIGHT;
  const bits = Math.floor(length * Math.log2(pool) * (guessable ? GUESSABLE_FACTOR : 1));

  let tier = tierForBits(bits);
  for (const { below, tier: cap } of LENGTH_CAPS) {
    if (key.length < below) tier = capTier(tier, cap);
  }
  if (new Set(key).size < MIN_UNIQUE_FOR_FAIR) tier = capTier(tier, 'weak');

  return { tier, segments: TIER_ORDER.indexOf(tier) + 1, bits };
}
