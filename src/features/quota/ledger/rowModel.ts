/**
 * Ledger row model: one normalized shape for every provider's quota state.
 *
 * The provider bodies (`*QuotaBody.tsx`) render each state on its own terms
 * inside a card. The ledger lays credentials out as rows with aligned meter
 * columns, so it needs a shape it can compare across providers: a list of
 * meters (label / remaining / reset), a list of facts (plan, manual resets,
 * monthly credits), and a plan badge. This module is that projection.
 *
 * Pure and React-free — `now` and `locale` are injected so every string here
 * is pinned by tests/quotaLedgerModel.test.ts. The per-provider reading rules
 * mirror the bodies and `resetSchedule.ts`; the summary strip
 * (`summaryModel.ts`) is built from these rows rather than from the raw states
 * so both views can never disagree about a number.
 */

import type { TFunction } from 'i18next';
import type {
  AntigravityQuotaState,
  ClaudeQuotaState,
  CodexQuotaState,
  KimiQuotaState,
  OpencodeGoQuotaState,
  XaiQuotaState,
} from '@/types';
import {
  formatDateTimeValue as formatFallbackDateTime,
} from '@/utils/format';
import {
  formatInstantShort,
  formatKimiResetHint,
  formatQuotaResetTime,
  formatRelativeInstant,
  parseIsoToMs,
  resolveResetMs,
} from '@/utils/quota';
import { HOUR_MS } from '@/utils/time/durations';
import type { QuotaCardState } from '../providers';
import type { QuotaProviderType } from '../providers/types';
import { getAntigravityPlanLabel, isAntigravityPremiumPlan } from '../providers/antigravity/labels';
import {
  translateAntigravityBucketLabel,
  translateAntigravityGroupLabel,
} from '../providers/antigravity/labels';
import { getCodexPlanLabel, getCodexPlanTier } from '../providers/codex/presentation';
import {
  formatXaiOnDemandAmount,
  formatXaiPercent,
  formatXaiRemainingAmount,
  resolveXaiPlan,
} from '../providers/xai/presentation';
import { collectQuotaRowInstants, pickUrgentRowId } from '../resetSchedule';

export type LedgerTone = 'plain' | 'premium' | 'elite';

/** `in 4 days · 09/16, 14:00` — relative first, because that is what you react to. */
export interface LedgerReset {
  relative: string | null;
  absolute: string | null;
  /** Reset falls within the next hour: worth warning emphasis. */
  soon: boolean;
}

export interface LedgerMeter {
  id: string;
  label: string;
  /** Remaining percent 0..100; null renders as `--` with an empty track. */
  remaining: number | null;
  /** Optional text shown beside the percent (amounts, `Used 12%`). */
  detail?: string;
  reset: LedgerReset | null;
  resetAtMs: number | null;
  periodHours: number | null;
  /** The meter the summary strip aggregates for this provider. */
  primary: boolean;
}

export interface LedgerFact {
  id: string;
  label: string;
  value: string;
  tone?: LedgerTone;
  /** Secondary lines under the value (reset credit expiries, billing period). */
  lines: string[];
  /** One of the lines is a countdown inside the final hour. */
  soon?: boolean;
  /** Error text for this fact only (e.g. reset-credit lookup failed). */
  error?: string;
}

export interface LedgerRow {
  planLabel: string | null;
  planTone: LedgerTone;
  /** Mono meta under the plan: `renews 10/03, 17:02 · in 21 days`. */
  subline: string[];
  meters: LedgerMeter[];
  facts: LedgerFact[];
  /** Provider-level note shown in place of meters (xAI paid health, no data). */
  message: string | null;
}

export interface LedgerRowInput {
  type: QuotaProviderType;
  quota: QuotaCardState | undefined;
  t: TFunction;
  now: number;
  locale?: string;
}

const EMPTY_ROW: LedgerRow = {
  planLabel: null,
  planTone: 'plain',
  subline: [],
  meters: [],
  facts: [],
  message: null,
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const remainingFromUsed = (used: number | null | undefined): number | null =>
  used === null || used === undefined ? null : clampPercent(100 - clampPercent(used));

const usableMs = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const usableLabel = (value: string | null | undefined): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed && trimmed !== '-' ? trimmed : null;
};

/**
 * Pair an absolute label with a countdown. Baked labels win for the absolute
 * half (Codex resolves `reset_after_seconds` at fetch time), the instant only
 * feeds the countdown — the same rule as `buildResetDisplay`, with the halves
 * swapped for the ledger's relative-first reading.
 */
export function buildLedgerReset(
  absoluteLabel: string | null | undefined,
  atMs: number | null | undefined,
  now: number,
  locale?: string,
  soon = false
): LedgerReset | null {
  const absolute = usableLabel(absoluteLabel);
  const ms = usableMs(atMs);
  if (absolute === null && ms === null) return null;
  return {
    relative: ms === null ? null : formatRelativeInstant(ms, now, locale),
    absolute: absolute ?? formatInstantShort(ms as number),
    soon,
  };
}

const isSoon = (atMs: number | null, now: number) =>
  atMs !== null && atMs - now > 0 && atMs - now < HOUR_MS;

/** Move the primary meter to the front, keeping the rest in provider order. */
const promotePrimary = (meters: LedgerMeter[], primaryId: string | null): LedgerMeter[] => {
  const withFlag = meters.map((meter) => ({ ...meter, primary: meter.id === primaryId }));
  const index = withFlag.findIndex((meter) => meter.primary);
  if (index <= 0) return withFlag;
  return [withFlag[index], ...withFlag.slice(0, index), ...withFlag.slice(index + 1)];
};

const firstIdOf = (meters: LedgerMeter[], preferred: readonly string[]): string | null => {
  for (const id of preferred) {
    if (meters.some((meter) => meter.id === id)) return id;
  }
  return meters[0]?.id ?? null;
};

interface WindowLike {
  id: string;
  label: string;
  labelKey?: string;
  labelParams?: Record<string, string | number>;
  usedPercent: number | null;
  resetLabel: string;
  resetAtMs?: number | null;
  periodHours?: number | null;
}

const metersFromWindows = (
  windows: readonly WindowLike[],
  t: TFunction,
  now: number,
  locale: string | undefined,
  urgentId: string | null
): LedgerMeter[] =>
  windows.map((window) => {
    const resetAtMs = usableMs(window.resetAtMs);
    return {
      id: window.id,
      label: window.labelKey ? t(window.labelKey, window.labelParams ?? {}) : window.label,
      remaining: remainingFromUsed(window.usedPercent),
      reset: buildLedgerReset(window.resetLabel, resetAtMs, now, locale, window.id === urgentId),
      resetAtMs,
      periodHours: usableMs(window.periodHours),
      primary: false,
    };
  });

/* ------------------------------------------------------------- providers */

function buildClaudeRow(quota: ClaudeQuotaState, input: LedgerRowInput): LedgerRow {
  const { t, now, locale } = input;
  const urgentId = pickUrgentRowId(collectQuotaRowInstants('claude', quota), now);
  const meters = metersFromWindows(quota.windows ?? [], t, now, locale, urgentId);
  const facts: LedgerFact[] = [];
  const extra = quota.extraUsage;
  if (extra && extra.is_enabled) {
    facts.push({
      id: 'extra-usage',
      label: t('claude_quota.extra_usage_label'),
      value: `$${(extra.used_credits / 100).toFixed(2)} / $${(extra.monthly_limit / 100).toFixed(2)}`,
      lines: [],
    });
  }
  return {
    ...EMPTY_ROW,
    planLabel: quota.planType ? t(`claude_quota.${quota.planType}`) : null,
    // The scoped Fable window is the one that actually runs out first on a
    // Max plan; it leads the row and the summary.
    meters: promotePrimary(meters, firstIdOf(meters, ['seven-day-fable', 'seven-day'])),
    facts,
    message: meters.length === 0 ? t('claude_quota.empty_windows') : null,
  };
}

function buildCodexRow(quota: CodexQuotaState, input: LedgerRowInput): LedgerRow {
  const { t, now, locale } = input;
  const urgentId = pickUrgentRowId(collectQuotaRowInstants('codex', quota), now);
  const meters = metersFromWindows(quota.windows ?? [], t, now, locale, urgentId);

  const subline: string[] = [];
  const activeUntil = quota.subscriptionActiveUntil ?? null;
  if (activeUntil) {
    const ms = resolveResetMs([activeUntil]);
    const absolute = ms === null ? formatFallbackDateTime(activeUntil) : formatInstantShort(ms);
    subline.push(t('quota_management.renews_at', { time: absolute }));
    if (ms !== null) subline.push(formatRelativeInstant(ms, now, locale));
  }

  const facts: LedgerFact[] = [];
  const available = quota.rateLimitResetCreditsAvailableCount ?? null;
  const credits = quota.rateLimitResetCredits ?? [];
  if (available !== null || credits.length > 0 || quota.rateLimitResetCreditsError) {
    const lines = credits.map((credit, index) => {
      const expiresAtMs = parseIsoToMs(credit.expiresAt);
      const reset = buildLedgerReset(
        expiresAtMs === null ? credit.expiresAt : formatInstantShort(expiresAtMs),
        expiresAtMs,
        now,
        locale
      );
      return [t('codex_quota.reset_credit_number', { index: index + 1 }), reset?.relative, reset?.absolute]
        .filter((part): part is string => Boolean(part))
        .join(' · ');
    });
    facts.push({
      id: 'manual-resets',
      label: t('codex_quota.reset_credits_label'),
      value:
        available === null
          ? String(credits.length)
          : t('quota_management.count_available', { count: available }),
      lines,
      soon: credits.some((credit) => {
        const ms = parseIsoToMs(credit.expiresAt);
        return credit.status === 'available' && isSoon(ms, now);
      }),
      error: quota.rateLimitResetCreditsError || undefined,
    });
  }

  return {
    ...EMPTY_ROW,
    planLabel: getCodexPlanLabel(t, quota.planType),
    planTone: getCodexPlanTier(quota.planType),
    subline,
    meters: promotePrimary(meters, firstIdOf(meters, ['weekly', 'monthly', 'five-hour'])),
    facts,
    message: meters.length === 0 ? t('codex_quota.empty_windows') : null,
  };
}

function buildKimiRow(quota: KimiQuotaState, input: LedgerRowInput): LedgerRow {
  const { t, now, locale } = input;
  const urgentId = pickUrgentRowId(collectQuotaRowInstants('kimi', quota), now);
  const meters: LedgerMeter[] = (quota.rows ?? []).map((row) => {
    const remaining =
      row.limit > 0
        ? clampPercent(Math.round(((row.limit - row.used) / row.limit) * 100))
        : row.used > 0
          ? 0
          : null;
    const resetAtMs = usableMs(row.resetAtMs);
    return {
      id: row.id,
      label: row.labelKey ? t(row.labelKey, row.labelParams ?? {}) : (row.label ?? ''),
      remaining,
      reset: buildLedgerReset(
        resetAtMs === null ? formatKimiResetHint(t, row.resetHint) : null,
        resetAtMs,
        now,
        locale,
        row.id === urgentId
      ),
      resetAtMs,
      periodHours: usableMs(row.periodHours),
      primary: false,
    };
  });
  return {
    ...EMPTY_ROW,
    meters: promotePrimary(meters, firstIdOf(meters, ['summary'])),
    message: meters.length === 0 ? t('kimi_quota.empty_data') : null,
  };
}

function buildXaiRow(quota: XaiQuotaState, input: LedgerRowInput): LedgerRow {
  const { t, now, locale } = input;
  const billing = quota.billing;
  if (!billing) return { ...EMPTY_ROW, message: t('xai_quota.empty_data') };

  if (billing.mode === 'paid-health') {
    return {
      ...EMPTY_ROW,
      planLabel: t('xai_quota.plan_paid'),
      planTone: 'premium',
      message: t('xai_quota.paid_health'),
    };
  }

  const plan = resolveXaiPlan(billing.monthlyLimitCents);
  const weeklyUsed =
    billing.periodType === 'weekly' && billing.usagePercent !== null
      ? clampPercent(billing.usagePercent)
      : null;
  const weeklyResetAtMs = billing.periodType === 'weekly' ? usableMs(billing.resetAtMs) : null;
  const weeklySoon = isSoon(weeklyResetAtMs, now);

  const meters: LedgerMeter[] = [
    {
      // Always present, even without data — it is the xAI primary and the
      // summary strip needs a column to aggregate into.
      id: 'weekly',
      label: t('xai_quota.weekly_limit'),
      remaining: weeklyUsed === null ? null : clampPercent(100 - weeklyUsed),
      reset: buildLedgerReset(
        formatQuotaResetTime(billing.periodEnd),
        weeklyResetAtMs,
        now,
        locale,
        weeklySoon
      ),
      resetAtMs: weeklyResetAtMs,
      periodHours: billing.periodHours ?? (billing.periodType === 'weekly' ? 24 * 7 : null),
      primary: true,
    },
    ...billing.productUsage.map((item): LedgerMeter => {
      const used = item.usagePercent === null ? null : clampPercent(item.usagePercent);
      return {
        id: `product-${item.product}`,
        label: t('xai_quota.product_usage', { product: item.product }),
        remaining: used === null ? null : clampPercent(100 - used),
        reset: null,
        resetAtMs: null,
        periodHours: null,
        primary: false,
      };
    }),
  ];

  const onDemandCap = billing.onDemandCapCents ?? 0;
  if (onDemandCap > 0) {
    const used =
      billing.onDemandUsedPercent === null ? null : clampPercent(billing.onDemandUsedPercent);
    meters.push({
      id: 'on-demand',
      label: t('xai_quota.pay_as_you_go_label'),
      remaining: used === null ? null : clampPercent(100 - used),
      detail: formatXaiOnDemandAmount(billing),
      reset: null,
      resetAtMs: null,
      periodHours: null,
      primary: false,
    });
  }

  const facts: LedgerFact[] = [];
  const hasMonthlyData =
    billing.monthlyLimitCents !== null ||
    billing.usedCents !== null ||
    Boolean(billing.billingPeriodEnd);
  if (hasMonthlyData) {
    const monthlyEndMs = parseIsoToMs(billing.billingPeriodEnd);
    const monthlyReset = buildLedgerReset(
      formatQuotaResetTime(billing.billingPeriodEnd),
      monthlyEndMs,
      now,
      locale
    );
    const paygLine = `${t('xai_quota.pay_as_you_go_label')}: ${
      onDemandCap > 0
        ? t('xai_quota.pay_as_you_go_enabled', {
            cap: formatXaiOnDemandAmount(billing).split(' / ').pop() ?? '',
          })
        : t('xai_quota.pay_as_you_go_disabled')
    }`;
    const lines = [paygLine];
    if (monthlyReset) {
      lines.push([monthlyReset.relative, monthlyReset.absolute].filter(Boolean).join(' · '));
    }
    const monthlyRemaining = remainingFromUsed(billing.usedPercent);
    facts.push({
      id: 'monthly-credits',
      label: t('xai_quota.monthly_credits'),
      value:
        monthlyRemaining === null
          ? formatXaiRemainingAmount(billing)
          : `${formatXaiRemainingAmount(billing)} · ${formatXaiPercent(monthlyRemaining)}`,
      lines,
    });
  }

  return {
    ...EMPTY_ROW,
    planLabel: plan ? t(`xai_quota.${plan.labelKey}`) : null,
    planTone: plan?.premium ? 'premium' : 'plain',
    meters,
    facts,
  };
}

function buildAntigravityRow(quota: AntigravityQuotaState, input: LedgerRowInput): LedgerRow {
  const { t, locale } = input;
  // Antigravity countdowns run on the server-corrected clock so they agree
  // with the card body's own countdown.
  const now = input.now + (quota.serverTimeOffsetMs ?? 0);
  const urgentId = pickUrgentRowId(collectQuotaRowInstants('antigravity', quota), now);
  const groups = quota.groups ?? [];
  const meters: LedgerMeter[] = groups.flatMap((group) => {
    const groupLabel = translateAntigravityGroupLabel(group.label, t);
    return group.buckets.map((bucket): LedgerMeter => {
      const bucketLabel = translateAntigravityBucketLabel(bucket.label, t);
      const resetAtMs = usableMs(bucket.resetAtMs);
      return {
        id: bucket.id,
        label: groups.length > 1 ? `${groupLabel} · ${bucketLabel}` : bucketLabel,
        remaining: clampPercent(Math.round(Math.max(0, Math.min(1, bucket.remainingFraction)) * 100)),
        reset: buildLedgerReset(
          formatQuotaResetTime(bucket.resetTime),
          resetAtMs,
          now,
          locale,
          bucket.id === urgentId
        ),
        resetAtMs,
        periodHours: usableMs(bucket.periodHours),
        primary: false,
      };
    });
  });
  const weekly = meters.find((meter) => meter.periodHours === 24 * 7);
  return {
    ...EMPTY_ROW,
    planLabel: getAntigravityPlanLabel(quota.subscription, t),
    planTone: isAntigravityPremiumPlan(quota.subscription) ? 'premium' : 'plain',
    meters: promotePrimary(meters, weekly?.id ?? meters[0]?.id ?? null),
    message: meters.length === 0 ? t('antigravity_quota.empty_models') : null,
  };
}

function buildOpencodeGoRow(quota: OpencodeGoQuotaState, input: LedgerRowInput): LedgerRow {
  const { t, now, locale } = input;
  const urgentId = pickUrgentRowId(collectQuotaRowInstants('opencode-go', quota), now);
  const meters = metersFromWindows(quota.windows ?? [], t, now, locale, urgentId);
  return {
    ...EMPTY_ROW,
    meters: promotePrimary(meters, firstIdOf(meters, ['weekly'])),
    message: meters.length === 0 ? t('opencode_go_quota.empty_windows') : null,
  };
}

/**
 * Project one credential's loaded quota into a ledger row.
 *
 * Only `status: 'success'` states carry data; idle / loading / error rows are
 * rendered by the ledger itself from the status, so they come back empty here.
 */
export function buildLedgerRow(input: LedgerRowInput): LedgerRow {
  const { type, quota } = input;
  if (!quota || quota.status !== 'success') return EMPTY_ROW;
  switch (type) {
    case 'claude':
      return buildClaudeRow(quota as ClaudeQuotaState, input);
    case 'codex':
      return buildCodexRow(quota as CodexQuotaState, input);
    case 'kimi':
      return buildKimiRow(quota as KimiQuotaState, input);
    case 'xai':
      return buildXaiRow(quota as XaiQuotaState, input);
    case 'antigravity':
      return buildAntigravityRow(quota as AntigravityQuotaState, input);
    case 'opencode-go':
      return buildOpencodeGoRow(quota as OpencodeGoQuotaState, input);
    default:
      return EMPTY_ROW;
  }
}
