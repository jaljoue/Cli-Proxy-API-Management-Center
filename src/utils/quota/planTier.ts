import { normalizePlanType } from './parsers';

/**
 * Pure mapping from Codex plan tier -> badge style.
 *
 * - elite   -> liquid platinum badge (Pro 20x, plan=pro)
 * - premium -> gold badge (Pro Lite; Antigravity ultra / xAI paid reuse the gold class too)
 * - plain   -> plain text badge (plus/team/free/unknown)
 */
export type CodexPlanTier = 'elite' | 'premium' | 'plain';

export const PREMIUM_CODEX_PLAN_TYPES = new Set(['pro', 'prolite', 'pro-lite', 'pro_lite']);

// Pro 20x (plan=pro) sits one tier above gold premium: the liquid platinum badge,
// see .elitePlanValue in QuotaPage.module.scss.
export const ELITE_CODEX_PLAN_TYPE = 'pro';

/**
 * Order-sensitive: 'pro' also matches PREMIUM_CODEX_PLAN_TYPES, so the elite check must come first,
 * or Pro 20x silently falls back to gold. The contract is guarded by tests/quotaPlanTier.test.ts.
 */
export function resolvePlanTier(planType: string | null | undefined): CodexPlanTier {
  const normalized = normalizePlanType(planType);
  if (!normalized) return 'plain';
  if (normalized === ELITE_CODEX_PLAN_TYPE) return 'elite';
  if (PREMIUM_CODEX_PLAN_TYPES.has(normalized)) return 'premium';
  return 'plain';
}
