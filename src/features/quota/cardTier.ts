/**
 * Shared provider plan tiers determine plan-text styling.
 * flagship uses gold-set Hetian jade elitePlanValue; premium uses gold premiumPlanValue.
 *
 * Each provider's top individual plan is flagship; lower paid individual plans are premium.
 * Entry-level paid, team/business, and free plans are standard.
 *
 * - flagship: Codex Pro 500, Kimi Allegro, Claude Max 20x, Antigravity Ultra, SuperGrok Heavy
 * - premium: Codex Pro 200 / Pro 100, Claude Max 5x / unspecified Max,
 *            Kimi Allegretto, Antigravity Ultra Lite, SuperGrok, paid xAI API
 * - standard: Plus, Team, Business including Business Premium, Pro for Claude /
 *            Antigravity, Kimi Moderato / Andante, Free, and unknown tiers
 *
 * React-free for unit testing.
 */

import type { XaiBillingSummary } from '@/types';
import { resolvePlanTier } from '@/utils/quota';
import type { QuotaClassMap } from './types';

export type QuotaCardTier = 'standard' | 'premium' | 'flagship';

/** Identify SuperGrok / Heavy by monthly quota in cents when the subscription API has no label. */
export const XAI_SUPERGROK_LIMIT_CENTS = 15_000;
export const XAI_SUPERGROK_HEAVY_LIMIT_CENTS = 150_000;

export function resolveCodexCardTier(planType: string | null | undefined): QuotaCardTier {
  const tier = resolvePlanTier(planType);
  if (tier === 'elite') return 'flagship';
  if (tier === 'premium') return 'premium';
  return 'standard';
}

/** Kimi: Allegro = Pro 500, Allegretto = Pro 200, Moderato = Plus. */
export function resolveKimiCardTier(planName: string | null | undefined): QuotaCardTier {
  const normalized = planName?.trim().toLowerCase();
  if (normalized === 'allegro') return 'flagship';
  if (normalized === 'allegretto') return 'premium';
  return 'standard';
}

export function resolveAntigravityCardTier(plan: string | null | undefined): QuotaCardTier {
  const normalized = plan?.trim().toLowerCase() ?? '';
  if (normalized === 'ultra') return 'flagship';
  if (normalized === 'ultra-lite') return 'premium';
  return 'standard';
}

export function resolveClaudeCardTier(planType: string | null | undefined): QuotaCardTier {
  if (planType === 'plan_max20') return 'flagship';
  // Conservatively use the lower tier for Max without a 5x/20x distinction.
  if (planType === 'plan_max5' || planType === 'plan_max') return 'premium';
  return 'standard';
}

export function resolveXaiCardTier(billing: XaiBillingSummary): QuotaCardTier {
  if (billing.planLabel) {
    if (billing.planTier === 'elite') return 'flagship';
    if (billing.planTier === 'premium') return 'premium';
    return 'standard';
  }
  // The paid API exposes only a health check, not a plan name, but still belongs to a paid tier.
  if (billing.mode === 'paid-health') return 'premium';
  // Keep monthly-quota classification consistent with resolveXaiSubscriptionPlan.
  if (billing.monthlyLimitCents === XAI_SUPERGROK_HEAVY_LIMIT_CENTS) return 'flagship';
  if (billing.monthlyLimitCents === XAI_SUPERGROK_LIMIT_CENTS) return 'premium';
  return 'standard';
}

/** Plan-text styles for each tier. */
export function planValueClassForTier(tier: QuotaCardTier, classes: QuotaClassMap): string {
  if (tier === 'flagship') return classes.elitePlanValue;
  if (tier === 'premium') return classes.premiumPlanValue;
  return classes.codexPlanValue;
}
