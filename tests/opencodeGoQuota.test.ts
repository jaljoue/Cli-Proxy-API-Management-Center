/**
 * OpenCode Go quota: window building, key-id resolution and provider wiring.
 */

import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import {
  OPENCODE_GO_CONFIG,
  buildOpencodeGoQuotaWindows,
  resolveOpencodeGoKeyId,
} from '@/features/quota/providers/opencodeGo/data';
import {
  getOpencodeGoPlanLabel,
  isOpencodeGoPremiumPlan,
} from '@/features/quota/providers/opencodeGo/presentation';
import { QUOTA_TAB_ORDER } from '@/features/quota/constants';
import { collectQuotaRowInstants, nextRecoveryMs } from '@/features/quota/resetSchedule';
import { buildTimelineLane } from '@/features/quota/quotaTimelineModel';
import {
  QUOTA_PROVIDER_TYPES,
  getAuthFileIcon,
  getTypeLabel,
} from '@/features/authFiles/constants';
import { apiClient, opencodeGoApi } from '@/services/api';
import { formatQuotaResetTime } from '@/utils/quota';
import type { AuthFileItem } from '@/types';

const t = ((key: string) => key) as TFunction;

const KEY_ID = 'opencode-go-key-8719680cf09b11b330404dffd7fa6ed71c5f6840baedc08510a7a68228e91721';

/** The exact shape the plugin returns for `POST /plugins/opencode-go-cliproxyapi/quota-usage`. */
const usage = {
  rolling: { status: 'ok', percent: 0, resets_at: '2099-09-13T04:19:18.415Z' },
  weekly: { status: 'ok', percent: 12, resets_at: '2099-09-14T00:00:00.415Z' },
  monthly: { status: 'exceeded', percent: 100, resets_at: '2099-09-18T04:38:28.415Z' },
};

describe('opencodeGoApi', () => {
  test('refreshes quota through the plugin quota-usage route', async () => {
    const originalPost = apiClient.post;
    let request: { url: string; data: unknown } | undefined;
    apiClient.post = (async (url: string, data?: unknown) => {
      request = { url, data };
      return { key_id: KEY_ID, usage };
    }) as typeof apiClient.post;

    try {
      const card = await opencodeGoApi.fetchQuota(KEY_ID);
      expect(request).toEqual({
        url: '/plugins/opencode-go-cliproxyapi/quota-usage',
        data: { key_id: KEY_ID },
      });
      expect(card?.usage?.weekly?.percent).toBe(12);
      expect(card?.plan_type).toBeUndefined();
      expect(card?.email).toBeUndefined();
    } finally {
      apiClient.post = originalPost;
    }
  });

  test('reads the plan and subscriber email when the key has Console access', async () => {
    const originalPost = apiClient.post;
    apiClient.post = (async () => ({
      key_id: KEY_ID,
      plan_type: ' go-plus ',
      email: 'subscriber@example.com',
      usage,
    })) as typeof apiClient.post;

    try {
      const card = await opencodeGoApi.fetchQuota(KEY_ID);
      expect(card?.plan_type).toBe('go-plus');
      expect(card?.email).toBe('subscriber@example.com');

      const data = await OPENCODE_GO_CONFIG.fetchQuota(
        { name: `${KEY_ID}.json`, provider: 'opencode-go' } as AuthFileItem,
        t
      );
      const state = OPENCODE_GO_CONFIG.buildSuccessState(data);
      expect(state.planType).toBe('go-plus');
      expect(state.email).toBe('subscriber@example.com');
      expect(state.windows).toHaveLength(3);
    } finally {
      apiClient.post = originalPost;
    }
  });
});

describe('OpenCode Go plan presentation', () => {
  test('labels known plans and keeps unknown ones verbatim', () => {
    expect(getOpencodeGoPlanLabel(t, 'go')).toBe('opencode_go_quota.plan_go');
    expect(getOpencodeGoPlanLabel(t, 'Go-Plus')).toBe('opencode_go_quota.plan_go_plus');
    expect(getOpencodeGoPlanLabel(t, 'go-max')).toBe('go-max');
    expect(getOpencodeGoPlanLabel(t, null)).toBeNull();
  });

  test('only Go Plus gets the premium badge', () => {
    expect(isOpencodeGoPremiumPlan('go-plus')).toBe(true);
    expect(isOpencodeGoPremiumPlan('go')).toBe(false);
    expect(isOpencodeGoPremiumPlan(undefined)).toBe(false);
  });
});

describe('buildOpencodeGoQuotaWindows', () => {
  test('builds rolling / weekly / monthly windows in that order with instants and periods', () => {
    const windows = buildOpencodeGoQuotaWindows(usage, t);
    expect(windows.map((w) => w.id)).toEqual(['rolling', 'weekly', 'monthly']);
    expect(windows.map((w) => w.usedPercent)).toEqual([0, 12, 100]);
    expect(windows.map((w) => w.periodHours)).toEqual([5, 168, 720]);
    expect(windows[1]).toMatchObject({
      labelKey: 'opencode_go_quota.weekly_limit',
      resetLabel: formatQuotaResetTime(usage.weekly.resets_at),
      resetAtMs: Date.parse(usage.weekly.resets_at),
      windowStatus: 'ok',
    });
    expect(windows[2].windowStatus).toBe('exceeded');
  });

  test('skips absent windows and tolerates string percents and camelCase resets', () => {
    const windows = buildOpencodeGoQuotaWindows(
      { weekly: { percent: '37.5', resetsAt: '2099-01-01T00:00:00Z' } },
      t
    );
    expect(windows).toHaveLength(1);
    expect(windows[0].usedPercent).toBe(37.5);
    expect(windows[0].resetAtMs).toBe(Date.parse('2099-01-01T00:00:00Z'));
  });

  test('clamps out-of-range percents and keeps unknown ones null', () => {
    const windows = buildOpencodeGoQuotaWindows(
      { rolling: { percent: 140 }, weekly: { percent: null } },
      t
    );
    expect(windows[0].usedPercent).toBe(100);
    expect(windows[1].usedPercent).toBeNull();
    expect(windows[1].resetAtMs).toBeNull();
    expect(windows[1].resetLabel).toBe('-');
  });
});

describe('resolveOpencodeGoKeyId', () => {
  test('reads the plugin key id from the auth record id or the file name', () => {
    expect(resolveOpencodeGoKeyId({ name: `${KEY_ID}.json`, id: KEY_ID })).toBe(KEY_ID);
    expect(resolveOpencodeGoKeyId({ name: `${KEY_ID}.json` })).toBe(KEY_ID);
    expect(resolveOpencodeGoKeyId({ name: 'claude-a.json', provider: 'claude' })).toBeNull();
  });
});

describe('OPENCODE_GO_CONFIG', () => {
  const file = (extra: Partial<AuthFileItem>): AuthFileItem =>
    ({
      name: `${KEY_ID}.json`,
      provider: 'opencode-go',
      type: 'opencode-go',
      ...extra,
    }) as AuthFileItem;

  test('claims opencode-go files unless disabled', () => {
    expect(OPENCODE_GO_CONFIG.filterFn(file({}))).toBe(true);
    expect(OPENCODE_GO_CONFIG.filterFn(file({ disabled: true }))).toBe(false);
    expect(OPENCODE_GO_CONFIG.filterFn(file({ provider: 'claude', type: 'claude' }))).toBe(false);
  });

  test('is registered as a quota tab, an auth-file quota provider, and has an icon and label', () => {
    expect(QUOTA_TAB_ORDER).toContain('opencode-go');
    expect(QUOTA_PROVIDER_TYPES.has('opencode-go')).toBe(true);
    expect(getAuthFileIcon('opencode-go', 'light')).toBeTruthy();
    expect(getAuthFileIcon('opencode_go', 'dark')).toBeTruthy();
    expect(getTypeLabel(t, 'opencode-go')).toBe('OpenCode Go');
  });

  test('state builders keep the shared status contract', () => {
    expect(OPENCODE_GO_CONFIG.buildLoadingState()).toEqual({ status: 'loading', windows: [] });
    expect(OPENCODE_GO_CONFIG.buildErrorState('boom', 502)).toEqual({
      status: 'error',
      windows: [],
      error: 'boom',
      errorStatus: 502,
    });
    const success = OPENCODE_GO_CONFIG.buildSuccessState({
      windows: buildOpencodeGoQuotaWindows(usage, t),
    });
    expect(success.status).toBe('success');
    expect(success.windows).toHaveLength(3);
    expect(success.planType).toBeNull();
    expect(success.email).toBeNull();
  });
});

describe('OpenCode Go in the shared schedule and timeline', () => {
  const quota = OPENCODE_GO_CONFIG.buildSuccessState({
    windows: buildOpencodeGoQuotaWindows(usage, t),
  });
  const now = Date.parse('2099-09-13T00:00:00Z');

  test('every window is a recovery instant and the rolling one recovers first', () => {
    const instants = collectQuotaRowInstants('opencode-go', quota);
    expect(instants.map((i) => i.rowId)).toEqual(['rolling', 'weekly', 'monthly']);
    expect(nextRecoveryMs('opencode-go', quota, now)).toBe(Date.parse(usage.rolling.resets_at));
  });

  test('the weekly window anchors the fortnight lane and the rolling one the session lane', () => {
    const weekly = buildTimelineLane({
      name: `${KEY_ID}.json`,
      displayName: 'OpenCode Go',
      provider: 'opencode-go',
      quota,
      maxPeriodHours: 14 * 24,
    });
    expect(weekly.anchorMs).toBe(Date.parse(usage.weekly.resets_at));
    expect(weekly.periodHours).toBe(168);
    expect(weekly.remaining).toBe(88);
    expect(weekly.limits.map((l) => l.remaining)).toEqual([100, 88, 0]);

    const session = buildTimelineLane({
      name: `${KEY_ID}.json`,
      displayName: 'OpenCode Go',
      provider: 'opencode-go',
      quota,
      maxPeriodHours: 5,
    });
    expect(session.periodHours).toBe(5);
  });
});
