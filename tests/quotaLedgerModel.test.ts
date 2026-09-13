/**
 * Ledger row / summary projection and credential-name masking.
 */

import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import {
  containsEmail,
  maskCredentialName,
  maskEmail,
  shortenCredentialName,
} from '@/features/quota/ledger/mask';
import { buildLedgerReset, buildLedgerRow } from '@/features/quota/ledger/rowModel';
import { buildSummaryTile } from '@/features/quota/ledger/summaryModel';
import { DAY_MS, HOUR_MS } from '@/utils/time/durations';
import type { ClaudeQuotaState, CodexQuotaState, XaiQuotaState } from '@/types';

const t = ((key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key) as unknown as TFunction;

const NOW = new Date(2026, 8, 12, 12).getTime();

describe('credential name masking', () => {
  test('masks the email inside a codex file name but keeps hash and plan suffix', () => {
    expect(maskCredentialName('codex-ae5d455f-first.last@example.dev-pro.json')).toBe(
      'codex-ae5d455f-f•••@e•••.dev-pro.json'
    );
  });

  test('covers a hyphenated local part exactly when the backend email is known', () => {
    expect(
      maskCredentialName('codex-ae5d455f-first-last@example.dev-pro.json', 'first-last@example.dev')
    ).toBe('codex-ae5d455f-f•••@e•••.dev-pro.json');
    expect(maskCredentialName('Claude-First.Last@Example.com.json', 'first.last@example.com')).toBe(
      'Claude-f•••@e•••.com.json'
    );
    // A known email that isn't in the name changes nothing.
    expect(maskCredentialName('kimi-account.json', 'x@y.io')).toBe('kimi-account.json');
  });

  test('handles bare emails, subdomains and names without an email', () => {
    expect(maskEmail('someone@mail.example.co.uk')).toBe('s•••@m•••.uk');
    expect(maskCredentialName('claude-someone@example.com.json')).toBe('claude-s•••@e•••.com.json');
    expect(maskCredentialName('kimi-account.json')).toBe('kimi-account.json');
    expect(containsEmail('kimi-account.json')).toBe(false);
    expect(containsEmail('codex-a@b.com-team.json')).toBe(true);
  });

  test('folds long hex digests and leaves short ones alone', () => {
    const digest = '8719680cf09b11b330404dffd7fa6ed71c5f6840baedc08510a7a68228e91721';
    expect(shortenCredentialName(`opencode-go-key-${digest}.json`)).toBe(
      'opencode-go-key-8719680cf09b….json'
    );
    expect(shortenCredentialName('codex-ae5d455f-x@y.io.json')).toBe('codex-ae5d455f-x@y.io.json');
  });
});

describe('buildLedgerReset', () => {
  test('pairs a countdown with the absolute label and flags the final hour', () => {
    const reset = buildLedgerReset('09-12 13:30', NOW + 30 * 60_000, NOW, 'en', true);
    expect(reset).toEqual({ relative: 'in 30 minutes', absolute: '09-12 13:30', soon: true });
  });

  test('returns null with nothing to show and keeps a baked label without an instant', () => {
    expect(buildLedgerReset('-', null, NOW)).toBeNull();
    expect(buildLedgerReset('later', null, NOW)).toEqual({
      relative: null,
      absolute: 'later',
      soon: false,
    });
  });
});

describe('buildLedgerRow', () => {
  test('claude: leads with the Fable window and exposes extra usage as a fact', () => {
    const quota: ClaudeQuotaState = {
      status: 'success',
      planType: 'plan_max',
      extraUsage: { is_enabled: true, monthly_limit: 5000, used_credits: 1234, utilization: 25 },
      windows: [
        {
          id: 'five-hour',
          label: '5h',
          usedPercent: 0,
          resetLabel: '-',
          resetAtMs: null,
          periodHours: 5,
        },
        {
          id: 'seven-day',
          label: '7d',
          usedPercent: 21,
          resetLabel: 'x',
          resetAtMs: NOW + 4 * DAY_MS,
          periodHours: 168,
        },
        {
          id: 'seven-day-fable',
          label: 'Fable',
          usedPercent: 42,
          resetLabel: 'y',
          resetAtMs: NOW + 4 * DAY_MS,
          periodHours: 168,
        },
      ],
    };
    const row = buildLedgerRow({ type: 'claude', quota, t, now: NOW, locale: 'en' });
    expect(row.planLabel).toBe('claude_quota.plan_max');
    expect(row.meters.map((m) => m.id)).toEqual(['seven-day-fable', 'five-hour', 'seven-day']);
    expect(row.meters[0]).toMatchObject({ primary: true, remaining: 58 });
    expect(row.meters[0].reset?.relative).toBe('in 4 days');
    expect(row.meters[1].remaining).toBe(100);
    expect(row.facts).toEqual([
      {
        id: 'extra-usage',
        label: 'claude_quota.extra_usage_label',
        value: '$12.34 / $50.00',
        lines: [],
      },
    ]);
  });

  test('codex: weekly leads, renewal in the subline, manual resets as a fact with expiries', () => {
    const quota: CodexQuotaState = {
      status: 'success',
      planType: 'pro',
      subscriptionActiveUntil: new Date(NOW + 21 * DAY_MS).toISOString(),
      rateLimitResetCreditsAvailableCount: 2,
      rateLimitResetCredits: [
        {
          id: 'c1',
          status: 'available',
          grantedAt: '',
          expiresAt: new Date(NOW + 22 * DAY_MS).toISOString(),
        },
      ],
      windows: [
        {
          id: 'five-hour',
          label: '5h',
          usedPercent: 10,
          resetLabel: 'a',
          resetAtMs: NOW + 2 * HOUR_MS,
          periodHours: 5,
        },
        {
          id: 'weekly',
          label: 'Weekly',
          usedPercent: 83,
          resetLabel: 'b',
          resetAtMs: NOW + 2 * DAY_MS,
          periodHours: 168,
        },
      ],
    };
    const row = buildLedgerRow({ type: 'codex', quota, t, now: NOW, locale: 'en' });
    expect(row.planLabel).toBe('codex_quota.plan_pro');
    expect(row.planTone).toBe('elite');
    expect(row.meters.map((m) => m.id)).toEqual(['weekly', 'five-hour']);
    expect(row.meters[0].remaining).toBe(17);
    expect(row.subline[0]).toContain('quota_management.renews_at');
    expect(row.subline[1]).toBe('in 21 days');
    expect(row.facts[0]).toMatchObject({
      id: 'manual-resets',
      value: 'quota_management.count_available:{"count":2}',
    });
    expect(row.facts[0].lines[0]).toContain('in 22 days');
  });

  test('xai: weekly meter always present, monthly credits as a fact, paid health as a message', () => {
    const quota: XaiQuotaState = {
      status: 'success',
      billing: {
        mode: 'billing',
        periodType: 'weekly',
        usagePercent: 100,
        productUsage: [],
        monthlyLimitCents: 0,
        usedCents: 0,
        includedUsedCents: 0,
        onDemandCapCents: null,
        onDemandUsedCents: null,
        onDemandUsedPercent: null,
        usedPercent: null,
        resetAtMs: NOW + 5 * DAY_MS,
        periodHours: 168,
        billingPeriodEnd: new Date(NOW + 20 * DAY_MS).toISOString(),
      },
    };
    const row = buildLedgerRow({ type: 'xai', quota, t, now: NOW, locale: 'en' });
    expect(row.meters[0]).toMatchObject({ id: 'weekly', primary: true, remaining: 0 });
    expect(row.facts[0].id).toBe('monthly-credits');
    expect(row.facts[0].value).toBe('$0.00 / $0.00');
    expect(row.facts[0].lines[0]).toContain('xai_quota.pay_as_you_go_disabled');

    const paid = buildLedgerRow({
      type: 'xai',
      quota: { status: 'success', billing: { ...quota.billing!, mode: 'paid-health' } },
      t,
      now: NOW,
    });
    expect(paid.meters).toEqual([]);
    expect(paid.message).toBe('xai_quota.paid_health');
    expect(paid.planTone).toBe('premium');
  });

  test('unloaded, loading and errored states project to an empty row', () => {
    for (const quota of [undefined, { status: 'loading' as const }, { status: 'error' as const }]) {
      const row = buildLedgerRow({ type: 'claude', quota, t, now: NOW });
      expect(row.meters).toEqual([]);
      expect(row.planLabel).toBeNull();
    }
  });
});

describe('buildSummaryTile', () => {
  const claudeRow = (used: number, resetAtMs: number | null) =>
    buildLedgerRow({
      type: 'claude',
      quota: {
        status: 'success',
        windows: [
          {
            id: 'seven-day',
            label: '7d',
            usedPercent: used,
            resetLabel: 'x',
            resetAtMs,
            periodHours: 168,
          },
          {
            id: 'seven-day-fable',
            label: 'Fable',
            usedPercent: used,
            resetLabel: 'y',
            resetAtMs,
            periodHours: 168,
          },
        ],
      } satisfies ClaudeQuotaState,
      t,
      now: NOW,
      locale: 'en',
    });

  test('sums the primary meter across loaded accounts and picks the earliest reset', () => {
    const tile = buildSummaryTile({
      type: 'claude',
      now: NOW,
      rows: [
        { name: 'a.json', loaded: true, row: claudeRow(0, NOW + 4 * DAY_MS) },
        { name: 'b.json', loaded: true, row: claudeRow(42, NOW + DAY_MS) },
        {
          name: 'c.json',
          loaded: false,
          row: buildLedgerRow({ type: 'claude', quota: undefined, t, now: NOW }),
        },
      ],
    });
    expect(tile.credentialCount).toBe(3);
    expect(tile.loadedCount).toBe(2);
    expect(tile.meterLabel).toBe('Fable');
    expect(tile.remainingTotal).toBe(158);
    expect(tile.capacityTotal).toBe(200);
    expect(tile.segments.map((s) => s.remaining)).toEqual([100, 58, null]);
    expect(tile.nextResetAtMs).toBe(NOW + DAY_MS);
    expect(tile.nextReset?.relative).toBe('in 1 day');
    expect(tile.secondaryLabel).toBe('7d');
    expect(tile.secondaryRemainingTotal).toBe(158);
  });

  test('an unloaded pool has no meter label, no capacity and no reset', () => {
    const tile = buildSummaryTile({
      type: 'codex',
      now: NOW,
      rows: [
        {
          name: 'a.json',
          loaded: false,
          row: buildLedgerRow({ type: 'codex', quota: undefined, t, now: NOW }),
        },
      ],
    });
    expect(tile).toMatchObject({
      loadedCount: 0,
      meterLabel: null,
      remainingTotal: 0,
      capacityTotal: 0,
      nextReset: null,
      secondaryLabel: null,
    });
  });
});
