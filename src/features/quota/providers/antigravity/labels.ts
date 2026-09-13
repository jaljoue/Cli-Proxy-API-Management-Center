/**
 * Antigravity group / bucket label localization (pure functions shared by the card body and the
 * page row model).
 */

import type { TFunction } from 'i18next';
import type { AntigravityQuotaSubscription } from '@/types';

const ANTIGRAVITY_GROUP_LABEL_KEYS = new Map<string, string>([
  ['gemini models', 'group_gemini_models'],
  ['claude and gpt models', 'group_claude_gpt_models'],
]);

const ANTIGRAVITY_BUCKET_LABEL_KEYS = new Map<string, string>([
  ['weekly limit', 'weekly_limit'],
  ['daily limit', 'daily_limit'],
  ['5 hour limit', 'five_hour_limit'],
  ['5-hour limit', 'five_hour_limit'],
  ['five hour limit', 'five_hour_limit'],
  ['monthly limit', 'monthly_limit'],
]);

const normalizeAntigravityQuotaText = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const translateWith = (value: string, keys: Map<string, string>, t: TFunction): string => {
  const key = keys.get(normalizeAntigravityQuotaText(value));
  return key ? t(`antigravity_quota.${key}`) : value;
};

export const translateAntigravityGroupLabel = (value: string, t: TFunction): string =>
  translateWith(value, ANTIGRAVITY_GROUP_LABEL_KEYS, t);

export const translateAntigravityBucketLabel = (value: string, t: TFunction): string =>
  translateWith(value, ANTIGRAVITY_BUCKET_LABEL_KEYS, t);

export const translateAntigravityQuotaDescription = (
  value: string | undefined,
  t: TFunction
): string | undefined => {
  if (!value) return undefined;
  const modelsMatch = value.match(/^models within this group:\s*(.+)$/i);
  if (modelsMatch) {
    return t('antigravity_quota.group_models_description', {
      models: modelsMatch[1].trim(),
    });
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
