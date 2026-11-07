/**
 * Pure Antigravity quota-label to i18n-key mapping for testing.
 *
 * Upstream displayName changes across versions, such as Five Hour Limit Remaining; match normalized
 * text first, then fall back to the structured window field.
 */

import type { TFunction } from 'i18next';
import type { AntigravityQuotaSubscription } from '@/types';

const GROUP_LABEL_KEYS = new Map<string, string>([
  ['gemini models', 'group_gemini_models'],
  ['claude and gpt models', 'group_claude_gpt_models'],
]);

const BUCKET_LABEL_KEYS = new Map<string, string>([
  ['weekly limit', 'weekly_limit'],
  ['daily limit', 'daily_limit'],
  ['5 hour limit', 'five_hour_limit'],
  ['5-hour limit', 'five_hour_limit'],
  ['five hour limit', 'five_hour_limit'],
  ['five-hour limit', 'five_hour_limit'],
  ['monthly limit', 'monthly_limit'],
]);

const BUCKET_WINDOW_KEYS = new Map<string, string>([
  ['5h', 'five_hour_limit'],
  ['five-hour', 'five_hour_limit'],
  ['five_hour', 'five_hour_limit'],
  ['daily', 'daily_limit'],
  ['day', 'daily_limit'],
  ['weekly', 'weekly_limit'],
  ['week', 'weekly_limit'],
  ['monthly', 'monthly_limit'],
  ['month', 'monthly_limit'],
]);

/**
 * Append models that share the group's quota but are absent from its upstream model description.
 */
const GROUP_EXTRA_MODELS = new Map<string, readonly string[]>([
  ['group_gemini_models', ['Gemini Argon']],
]);

const GROUP_MODELS_PATTERN = /^models within this group:\s*(.+)$/i;

const normalizeText = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

/** Strip the common Remaining suffix, such as Weekly Limit Remaining -> weekly limit. */
const stripRemainingSuffix = (value: string): string =>
  value.replace(/\s*(?:-|:)?\s*remaining$/, '').trim();

export function resolveAntigravityGroupLabelKey(label: string): string | null {
  return GROUP_LABEL_KEYS.get(normalizeText(label)) ?? null;
}

/**
 * Parse models from a group description and append supplemental models, deduplicating
 * case-insensitively.
 * Return null unless the description starts with Models within this group: so callers show raw
 * text.
 */
export function resolveAntigravityGroupModels(
  label: string,
  description: string | undefined
): string[] | null {
  const match = description?.trim().match(GROUP_MODELS_PATTERN);
  if (!match) return null;

  const models = match[1]
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  const groupKey = resolveAntigravityGroupLabelKey(label);
  const extras = groupKey ? (GROUP_EXTRA_MODELS.get(groupKey) ?? []) : [];
  const seen = new Set(models.map(normalizeText));
  extras.forEach((model) => {
    if (seen.has(normalizeText(model))) return;
    seen.add(normalizeText(model));
    models.push(model);
  });
  return models;
}

export function resolveAntigravityBucketLabelKey(
  label: string,
  window: string | undefined
): string | null {
  const normalized = normalizeText(label);
  const byLabel =
    BUCKET_LABEL_KEYS.get(normalized) ?? BUCKET_LABEL_KEYS.get(stripRemainingSuffix(normalized));
  if (byLabel) return byLabel;
  if (!window) return null;
  return BUCKET_WINDOW_KEYS.get(normalizeText(window)) ?? null;
}

interface AntigravityBucketLike {
  label: string;
  window?: string;
  remainingFraction: number;
}

/**
 * A full five-hour bucket is unavailable if its group's weekly limit is exhausted.
 * Upstream marks it disabled even with remainingFraction = 1; do not show Quota available then.
 */
export function shouldShowAntigravityQuotaAvailable(
  bucket: AntigravityBucketLike,
  groupBuckets: readonly AntigravityBucketLike[]
): boolean {
  if (bucket.remainingFraction !== 1) return false;
  if (resolveAntigravityBucketLabelKey(bucket.label, bucket.window) !== 'five_hour_limit') {
    return true;
  }
  return !groupBuckets.some(
    (item) =>
      resolveAntigravityBucketLabelKey(item.label, item.window) === 'weekly_limit' &&
      item.remainingFraction <= 0
  );
}

/* ---------- Translated labels shared by the card body and the ledger row model ---------- */

export const translateAntigravityGroupLabel = (value: string, t: TFunction): string => {
  const key = resolveAntigravityGroupLabelKey(value);
  return key ? t(`antigravity_quota.${key}`) : value;
};

export const translateAntigravityBucketLabel = (
  value: string,
  t: TFunction,
  window?: string
): string => {
  const key = resolveAntigravityBucketLabelKey(value, window);
  return key ? t(`antigravity_quota.${key}`) : value;
};

export const translateAntigravityQuotaDescription = (
  value: string | undefined,
  t: TFunction,
  label = ''
): string | undefined => {
  if (!value) return undefined;
  const models = resolveAntigravityGroupModels(label, value);
  if (models) {
    return t('antigravity_quota.group_models_description', { models: models.join(', ') });
  }
  return value;
};

export const getAntigravityPlanLabel = (
  subscription: AntigravityQuotaSubscription | null | undefined,
  t: TFunction
): string | null => {
  if (!subscription) return null;
  if (subscription.plan === 'free') return t('antigravity_subscription.plan_free');
  if (subscription.plan === 'pro') return t('antigravity_subscription.plan_pro');
  if (subscription.plan === 'ultra') return t('antigravity_subscription.plan_ultra');
  if (subscription.plan === 'ultra-lite') return t('antigravity_subscription.plan_ultra_lite');
  return (
    subscription.tierName ||
    subscription.tierId ||
    (subscription.plan === 'unknown' ? t('antigravity_subscription.plan_unknown') : null)
  );
};

/** ultra / ultra-lite wear the gold badge. */
export const isAntigravityPremiumPlan = (
  subscription: AntigravityQuotaSubscription | null | undefined
): boolean => {
  const normalized = subscription?.plan?.toLowerCase() ?? '';
  return normalized === 'ultra' || normalized === 'ultra-lite';
};
