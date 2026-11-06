/**
 * OpenCode Go quota: native plugin quota request, response mapping and provider wiring.
 */

import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import {
  OPENCODE_GO_CONFIG,
  buildOpencodeGoQuotaWindows,
  resolveOpencodeGoPluginId,
} from '@/features/quota/providers/opencodeGo/data';
import {
  getOpencodeGoPlanLabel,
  isOpencodeGoPremiumPlan,
} from '@/features/quota/providers/opencodeGo/presentation';
import { PLUGIN_CONFIG } from '@/features/quota/providers/plugin/data';
import { QUOTA_TAB_ORDER } from '@/features/quota/constants';
import { classifyQuotaFiles } from '@/features/quota/logic';
import { collectQuotaRowInstants, nextRecoveryMs } from '@/features/quota/resetSchedule';
import { buildTimelineLane } from '@/features/quota/quotaTimelineModel';
import {
  QUOTA_PROVIDER_TYPES,
  getAuthFileIcon,
  getTypeLabel,
} from '@/features/authFiles/constants';
import { apiClient, normalizeOpencodeGoQuotaPayload, opencodeGoApi } from '@/services/api';
import { formatQuotaResetTime } from '@/utils/quota';
import type { AuthFileItem } from '@/types';

const t = ((key: string) => key) as TFunction;

const FILE_NAME =
  'opencode-go-key-8719680cf09b11b330404dffd7fa6ed71c5f6840baedc08510a7a68228e91721.json';

/** The exact shape the plugin returns for `POST /plugins/opencode-go-cliproxyapi/quota`. */
const response = {
  subscription: { plan: 'go-plus', tierName: 'Go Plus' },
  groups: [
    {
      displayName: 'OpenCode Go',
      buckets: [
        {
          window: '5h',
          remainingFraction: 1,
          resetTime: '2099-09-13T04:19:18Z',
          description: '5-hour limit',
        },
        {
          window: 'weekly',
          remainingFraction: 0.88,
          resetTime: '2099-09-14T00:00:00Z',
          description: 'Weekly limit',
        },
        {
          window: 'monthly',
          remainingFraction: 0,
          resetTime: '2099-09-18T04:38:28Z',
          description: 'Monthly limit',
        },
      ],
    },
  ],
};
const resets = response.groups[0].buckets.map((bucket) => bucket.resetTime);
const payload = normalizeOpencodeGoQuotaPayload(response);

const file = (extra: Partial<AuthFileItem> = {}): AuthFileItem =>
  ({
    name: FILE_NAME,
    provider: 'opencode-go',
    type: 'opencode-go',
    auth_index: '7',
    authIndex: '7',
    quota_provider: 'opencode-go',
    quotaProvider: 'opencode-go',
    quota_plugin_id: 'opencode-go-cliproxyapi',
    quotaPluginId: 'opencode-go-cliproxyapi',
    supports_quota: true,
    ...extra,
  }) as AuthFileItem;

/** Swap apiClient.post/get for the duration of one test. */
const withApi = async (
  handlers: {
    post?: (url: string, data?: unknown) => unknown;
    get?: (url: string, config?: unknown) => unknown;
  },
  run: () => Promise<void>
) => {
  const originalPost = apiClient.post;
  const originalGet = apiClient.get;
  if (handlers.post) {
    apiClient.post = (async (url: string, data?: unknown) =>
      handlers.post!(url, data)) as typeof apiClient.post;
  }
  if (handlers.get) {
    apiClient.get = (async (url: string, config?: unknown) =>
      handlers.get!(url, config)) as typeof apiClient.get;
  }
  try {
    await run();
  } finally {
    apiClient.post = originalPost;
    apiClient.get = originalGet;
  }
};

describe('opencodeGoApi', () => {
  test('posts the auth index to the native plugin quota route', async () => {
    let request: { url: string; data: unknown } | undefined;
    await withApi(
      {
        post: (url, data) => {
          request = { url, data };
          return response;
        },
      },
      async () => {
        const result = await opencodeGoApi.fetchQuota('opencode-go-cliproxyapi', '7');
        expect(request).toEqual({
          url: '/plugins/opencode-go-cliproxyapi/quota',
          data: { auth_index: '7' },
        });
        expect(result.plan).toBe('go-plus');
        expect(result.tierName).toBe('Go Plus');
        expect(result.buckets.map((bucket) => bucket.window)).toEqual(['5h', 'weekly', 'monthly']);
      }
    );
  });

  test('normalizes a response without subscription or groups', () => {
    expect(normalizeOpencodeGoQuotaPayload({ groups: response.groups })).toMatchObject({
      plan: null,
      tierName: null,
    });
    expect(normalizeOpencodeGoQuotaPayload(null)).toEqual({
      plan: null,
      tierName: null,
      buckets: [],
    });
    expect(
      normalizeOpencodeGoQuotaPayload({
        groups: [{ buckets: [{ remainingFraction: 1 }, 'junk', { window: 'weekly' }] }],
      }).buckets
    ).toEqual([{ window: 'weekly', remainingFraction: null, resetTime: null, description: null }]);
  });
});

describe('OPENCODE_GO_CONFIG.fetchQuota', () => {
  test('uses quota_plugin_id and auth_index and maps plan and windows', async () => {
    let url: string | undefined;
    let body: unknown;
    await withApi(
      {
        post: (requestUrl, data) => {
          url = requestUrl;
          body = data;
          return response;
        },
      },
      async () => {
        const data = await OPENCODE_GO_CONFIG.fetchQuota(
          file({ quotaPluginId: 'custom-opencode', authIndex: '42', auth_index: '42' }),
          t
        );
        expect(url).toBe('/plugins/custom-opencode/quota');
        expect(body).toEqual({ auth_index: '42' });
        const state = OPENCODE_GO_CONFIG.buildSuccessState(data);
        expect(state.planType).toBe('go-plus');
        expect(state.planLabel).toBe('Go Plus');
        expect(state.email).toBeNull();
        expect(state.windows.map((w) => w.id)).toEqual(['rolling', 'weekly', 'monthly']);
      }
    );
  });

  test('falls back to the opencode-go-cliproxyapi plugin id', async () => {
    let url: string | undefined;
    await withApi(
      {
        post: (requestUrl) => {
          url = requestUrl;
          return { groups: [] };
        },
      },
      async () => {
        const data = await OPENCODE_GO_CONFIG.fetchQuota(
          file({ quotaPluginId: undefined, quota_plugin_id: undefined }),
          t
        );
        expect(url).toBe('/plugins/opencode-go-cliproxyapi/quota');
        const state = OPENCODE_GO_CONFIG.buildSuccessState(data);
        expect(state.windows).toEqual([]);
        expect(state.planType).toBeNull();
        expect(state.planLabel).toBeNull();
      }
    );
  });

  test('without Console access the plan stays empty but windows still render', async () => {
    await withApi({ post: () => ({ groups: response.groups }) }, async () => {
      const state = OPENCODE_GO_CONFIG.buildSuccessState(
        await OPENCODE_GO_CONFIG.fetchQuota(file(), t)
      );
      expect(state.planType).toBeNull();
      expect(state.windows).toHaveLength(3);
    });
  });

  test('refuses credentials without an auth index before calling the API', async () => {
    let called = false;
    await withApi(
      {
        post: () => {
          called = true;
          return response;
        },
      },
      async () => {
        await expect(
          OPENCODE_GO_CONFIG.fetchQuota(file({ authIndex: undefined, auth_index: undefined }), t)
        ).rejects.toThrow('opencode_go_quota.missing_auth_index');
        expect(called).toBe(false);
      }
    );
  });

  test('resolveOpencodeGoPluginId prefers the listing and falls back to the known id', () => {
    expect(resolveOpencodeGoPluginId(file())).toBe('opencode-go-cliproxyapi');
    expect(resolveOpencodeGoPluginId(file({ quotaPluginId: ' other ' }))).toBe('other');
    expect(resolveOpencodeGoPluginId({ name: 'x.json', provider: 'opencode-go' })).toBe(
      'opencode-go-cliproxyapi'
    );
  });
});

describe('OPENCODE_GO_CONFIG.enrichQuota', () => {
  const data = { windows: [], planType: 'go', planLabel: 'Go', email: null };

  test('reads the email the plugin saved into the auth file', async () => {
    let request: { url: string; config: unknown } | undefined;
    await withApi(
      {
        get: (url, config) => {
          request = { url, config };
          return { files: [{ ...file(), email: 'subscriber@example.com' }] };
        },
      },
      async () => {
        const enriched = await OPENCODE_GO_CONFIG.enrichQuota!(file(), data, t);
        expect(request).toEqual({
          url: '/credentials',
          config: { params: { name: FILE_NAME, auth_index: '7' } },
        });
        expect(enriched.email).toBe('subscriber@example.com');
        expect(OPENCODE_GO_CONFIG.buildSuccessState(enriched).email).toBe('subscriber@example.com');
      }
    );
  });

  test('skips the lookup when the listing already has the email', async () => {
    let called = false;
    await withApi(
      {
        get: () => {
          called = true;
          return { files: [] };
        },
      },
      async () => {
        const enriched = await OPENCODE_GO_CONFIG.enrichQuota!(
          file({ email: 'known@example.com' }),
          data,
          t
        );
        expect(enriched).toBe(data);
        expect(called).toBe(false);
      }
    );
  });
});

describe('buildOpencodeGoQuotaWindows', () => {
  test('maps 5h / weekly / monthly buckets to used percent, instants and periods', () => {
    const windows = buildOpencodeGoQuotaWindows(payload.buckets, t);
    expect(windows.map((w) => w.id)).toEqual(['rolling', 'weekly', 'monthly']);
    expect(windows.map((w) => w.usedPercent)).toEqual([0, 12, 100]);
    expect(windows.map((w) => w.periodHours)).toEqual([5, 168, 720]);
    expect(windows[1]).toMatchObject({
      labelKey: 'opencode_go_quota.weekly_limit',
      resetLabel: formatQuotaResetTime(resets[1]),
      resetAtMs: Date.parse(resets[1]),
    });
  });

  test('sorts by window, not by response order, and ignores unknown windows', () => {
    const windows = buildOpencodeGoQuotaWindows(
      normalizeOpencodeGoQuotaPayload({
        groups: [
          {
            buckets: [
              { window: 'monthly', remainingFraction: 0.5 },
              { window: 'daily', remainingFraction: 0.1 },
              { window: 'Week', remainingFraction: 0.25 },
            ],
          },
        ],
      }).buckets,
      t
    );
    expect(windows.map((w) => w.id)).toEqual(['weekly', 'monthly']);
    expect(windows.map((w) => w.usedPercent)).toEqual([75, 50]);
  });

  test('leaves out windows OpenCode does not report', () => {
    const windows = buildOpencodeGoQuotaWindows(
      payload.buckets.filter((bucket) => bucket.window === 'weekly'),
      t
    );
    expect(windows.map((w) => w.id)).toEqual(['weekly']);
  });

  test('clamps out-of-range fractions and keeps unknown ones null', () => {
    const windows = buildOpencodeGoQuotaWindows(
      [
        { window: '5h', remainingFraction: -0.4, resetTime: null, description: null },
        { window: 'weekly', remainingFraction: null, resetTime: null, description: null },
      ],
      t
    );
    expect(windows[0].usedPercent).toBe(100);
    expect(windows[1].usedPercent).toBeNull();
    expect(windows[1].resetAtMs).toBeNull();
    expect(windows[1].resetLabel).toBe('-');
  });
});

describe('OpenCode Go plan presentation', () => {
  test('labels known plans and keeps unknown ones verbatim', () => {
    expect(getOpencodeGoPlanLabel(t, 'go')).toBe('opencode_go_quota.plan_go');
    expect(getOpencodeGoPlanLabel(t, 'Go-Plus')).toBe('opencode_go_quota.plan_go_plus');
    expect(getOpencodeGoPlanLabel(t, 'go-max')).toBe('go-max');
    expect(getOpencodeGoPlanLabel(t, null)).toBeNull();
  });

  test('unknown plans prefer the plugin tierName over the raw id', () => {
    expect(getOpencodeGoPlanLabel(t, 'go-max', 'Go Max')).toBe('Go Max');
    expect(getOpencodeGoPlanLabel(t, 'go-plus', 'Whatever')).toBe('opencode_go_quota.plan_go_plus');
    expect(getOpencodeGoPlanLabel(t, null, 'Go Max')).toBeNull();
  });

  test('only Go Plus gets the premium badge', () => {
    expect(isOpencodeGoPremiumPlan('go-plus')).toBe(true);
    expect(isOpencodeGoPremiumPlan('go')).toBe(false);
    expect(isOpencodeGoPremiumPlan(undefined)).toBe(false);
  });
});

describe('OPENCODE_GO_CONFIG', () => {
  test('claims opencode-go files unless disabled', () => {
    expect(OPENCODE_GO_CONFIG.filterFn(file())).toBe(true);
    expect(OPENCODE_GO_CONFIG.filterFn(file({ disabled: true }))).toBe(false);
    expect(OPENCODE_GO_CONFIG.filterFn(file({ provider: 'claude', type: 'claude' }))).toBe(false);
  });

  test('the generic plugin adapter does not also claim opencode-go files', () => {
    expect(PLUGIN_CONFIG.filterFn(file())).toBe(false);
    const entries = classifyQuotaFiles([file()]);
    expect(entries.map((entry) => entry.type)).toEqual(['opencode-go']);
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
      windows: buildOpencodeGoQuotaWindows(payload.buckets, t),
    });
    expect(success.status).toBe('success');
    expect(success.windows).toHaveLength(3);
    expect(success.planType).toBeNull();
    expect(success.planLabel).toBeNull();
    expect(success.email).toBeNull();
  });
});

describe('OpenCode Go in the shared schedule and timeline', () => {
  const quota = OPENCODE_GO_CONFIG.buildSuccessState({
    windows: buildOpencodeGoQuotaWindows(payload.buckets, t),
  });
  const now = Date.parse('2099-09-13T00:00:00Z');

  test('every window is a recovery instant and the rolling one recovers first', () => {
    const instants = collectQuotaRowInstants('opencode-go', quota);
    expect(instants.map((i) => i.rowId)).toEqual(['rolling', 'weekly', 'monthly']);
    expect(nextRecoveryMs('opencode-go', quota, now)).toBe(Date.parse(resets[0]));
  });

  test('the weekly window anchors the fortnight lane and the rolling one the session lane', () => {
    const weekly = buildTimelineLane({
      name: FILE_NAME,
      displayName: 'OpenCode Go',
      provider: 'opencode-go',
      quota,
      maxPeriodHours: 14 * 24,
    });
    expect(weekly.anchorMs).toBe(Date.parse(resets[1]));
    expect(weekly.periodHours).toBe(168);
    expect(weekly.remaining).toBe(88);
    expect(weekly.limits.map((l) => l.remaining)).toEqual([100, 88, 0]);

    const session = buildTimelineLane({
      name: FILE_NAME,
      displayName: 'OpenCode Go',
      provider: 'opencode-go',
      quota,
      maxPeriodHours: 5,
    });
    expect(session.periodHours).toBe(5);
  });
});
