import { normalizePlanType } from './parsers';

/**
 * Pure Codex plan-tier mapping. See features/quota/cardTier.ts for card styling tiers.
 *
 * - elite   -> Pro 500, plan=promax
 * - premium -> Pro 200, plan=pro; Pro 100, plan=prolite
 * - plain   -> Plus / Team / Business, including Business Premium / Free / unknown
 */
export type CodexPlanTier = 'elite' | 'premium' | 'plain';

/** Accepted spellings of Pro 500. */
export const PRO_MAX_CODEX_PLAN_TYPES = new Set(['promax', 'pro-max', 'pro_max']);

/** Accepted spellings of Pro 100. */
export const PRO_LITE_CODEX_PLAN_TYPES = new Set(['prolite', 'pro-lite', 'pro_lite']);

/** Pro 200. */
export const PRO_CODEX_PLAN_TYPE = 'pro';

/** Business Premium has Premium in its name but shares the Plus tier. */
export const BUSINESS_PREMIUM_CODEX_PLAN_TYPE = 'self_serve_business_prolite';

export function resolvePlanTier(planType: string | null | undefined): CodexPlanTier {
  const normalized = normalizePlanType(planType);
  if (!normalized) return 'plain';
  if (PRO_MAX_CODEX_PLAN_TYPES.has(normalized)) return 'elite';
  if (normalized === PRO_CODEX_PLAN_TYPE || PRO_LITE_CODEX_PLAN_TYPES.has(normalized)) {
    return 'premium';
  }
  return 'plain';
}
