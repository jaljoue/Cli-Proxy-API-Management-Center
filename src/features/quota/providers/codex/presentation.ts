/**
 * Codex plan presentation: plan_type -> label + badge tier.
 * Shared by the card body and the quota page row model.
 */

import type { TFunction } from 'i18next';
import { normalizePlanType, PREMIUM_CODEX_PLAN_TYPES, resolvePlanTier } from '@/utils/quota';
import type { CodexPlanTier } from '@/utils/quota';

export const getCodexPlanLabel = (t: TFunction, planType?: string | null): string | null => {
  const normalized = normalizePlanType(planType);
  if (!normalized) return null;
  if (normalized === 'pro') return t('codex_quota.plan_pro');
  if (PREMIUM_CODEX_PLAN_TYPES.has(normalized) && normalized !== 'pro') {
    return t('codex_quota.plan_prolite');
  }
  if (normalized === 'plus') return t('codex_quota.plan_plus');
  if (normalized === 'team') return t('codex_quota.plan_team');
  if (normalized === 'free') return t('codex_quota.plan_free');
  return planType || normalized;
};

export const getCodexPlanTier = (planType?: string | null): CodexPlanTier =>
  resolvePlanTier(planType);
