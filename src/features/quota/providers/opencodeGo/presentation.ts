/**
 * OpenCode Go plan presentation: plan_type -> label + badge tier.
 * Shared by the card body and the quota page row model.
 */

import type { TFunction } from 'i18next';
import { normalizePlanType } from '@/utils/quota';

const PLAN_LABEL_KEYS: Record<string, string> = {
  go: 'opencode_go_quota.plan_go',
  'go-plus': 'opencode_go_quota.plan_go_plus',
};

export const getOpencodeGoPlanLabel = (t: TFunction, planType?: string | null): string | null => {
  const normalized = normalizePlanType(planType);
  if (!normalized) return null;
  const key = PLAN_LABEL_KEYS[normalized];
  return key ? t(key) : planType || normalized;
};

export const isOpencodeGoPremiumPlan = (planType?: string | null): boolean =>
  normalizePlanType(planType) === 'go-plus';
