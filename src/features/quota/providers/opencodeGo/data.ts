/**
 * OpenCode Go quota data layer: rolling / weekly / monthly windows.
 * React-free / SCSS-free -- consumed directly by tests/opencodeGoQuota.test.ts.
 *
 * Data comes from CPA v8's native plugin quota API (`POST /plugins/:pluginId/quota` with the
 * credential's `auth_index`), served by the opencode-go-cliproxyapi plugin. The plugin holds
 * the API key; the frontend never sees it.
 */

import type { TFunction } from 'i18next';
import type {
  AuthFileItem,
  OpencodeGoQuotaBucketPayload,
  OpencodeGoQuotaState,
  OpencodeGoQuotaWindow,
} from '@/types';
import { OPENCODE_GO_PLUGIN_ID, authFilesApi, opencodeGoApi } from '@/services/api';
import { normalizeAuthIndex } from '@/utils/authIndex';
import {
  formatQuotaResetTime,
  isDisabledAuthFile,
  isOpencodeGoFile,
  normalizeStringValue,
  resolveResetMs,
} from '@/utils/quota';
import type { QuotaProviderData } from '../types';

export type OpencodeGoQuotaData = {
  windows: OpencodeGoQuotaWindow[];
  planType?: string | null;
  planLabel?: string | null;
  email?: string | null;
};

/** Window order on the card: shortest first, matching every other provider. */
export const OPENCODE_GO_WINDOW_KEYS = [
  {
    key: 'rolling',
    aliases: ['5h', 'five-hour', 'five_hour', 'rolling'],
    labelKey: 'opencode_go_quota.rolling_limit',
    periodHours: 5,
  },
  {
    key: 'weekly',
    aliases: ['weekly', 'week'],
    labelKey: 'opencode_go_quota.weekly_limit',
    periodHours: 24 * 7,
  },
  {
    key: 'monthly',
    aliases: ['monthly', 'month'],
    labelKey: 'opencode_go_quota.monthly_limit',
    periodHours: 24 * 30,
  },
] as const;

/** The host's credential listing names the quota plugin; older listings may omit it. */
export const resolveOpencodeGoPluginId = (file: AuthFileItem): string =>
  normalizeStringValue(file.quotaPluginId ?? file['quota_plugin_id']) ?? OPENCODE_GO_PLUGIN_ID;

/**
 * Map plugin buckets onto the fixed rolling / weekly / monthly rows. Windows the plugin does
 * not report are left out; unknown windows are ignored. The first bucket per window wins.
 */
export const buildOpencodeGoQuotaWindows = (
  buckets: readonly OpencodeGoQuotaBucketPayload[],
  t: TFunction
): OpencodeGoQuotaWindow[] => {
  const windows: OpencodeGoQuotaWindow[] = [];
  for (const { key, aliases, labelKey, periodHours } of OPENCODE_GO_WINDOW_KEYS) {
    const bucket = buckets.find((candidate) =>
      (aliases as readonly string[]).includes(candidate.window.trim().toLowerCase())
    );
    if (!bucket) continue;
    const fraction = bucket.remainingFraction;
    const usedPercent = fraction === null ? null : Math.max(0, Math.min(100, (1 - fraction) * 100));
    const resetTime = bucket.resetTime ?? undefined;
    windows.push({
      id: key,
      label: t(labelKey),
      labelKey,
      usedPercent,
      resetLabel: formatQuotaResetTime(resetTime),
      resetAtMs: resolveResetMs([resetTime]),
      periodHours,
    });
  }
  return windows;
};

export const fetchOpencodeGoQuota = async (
  file: AuthFileItem,
  t: TFunction
): Promise<OpencodeGoQuotaData> => {
  const authIndex = normalizeAuthIndex(file.authIndex ?? file['auth_index']);
  if (!authIndex) {
    throw new Error(t('opencode_go_quota.missing_auth_index'));
  }
  const payload = await opencodeGoApi.fetchQuota(resolveOpencodeGoPluginId(file), authIndex);
  return {
    windows: buildOpencodeGoQuotaWindows(payload.buckets, t),
    planType: payload.plan,
    planLabel: payload.tierName,
    email: null,
  };
};

/**
 * The quota response carries no email: the plugin writes it into the auth file during the
 * fetch. Read that one file back so the account name shows without a full list reload.
 */
export const enrichOpencodeGoQuota = async (
  file: AuthFileItem,
  data: OpencodeGoQuotaData
): Promise<OpencodeGoQuotaData> => {
  if (normalizeStringValue(file.email)) return data;
  const authIndex = normalizeAuthIndex(file.authIndex ?? file['auth_index']) ?? undefined;
  const { files } = await authFilesApi.list({ name: file.name, authIndex });
  const match =
    files.find((candidate) => candidate.name === file.name) ??
    (files.length === 1 ? files[0] : undefined);
  const email = normalizeStringValue(match?.email);
  return email ? { ...data, email } : data;
};

export const OPENCODE_GO_CONFIG: QuotaProviderData<OpencodeGoQuotaState, OpencodeGoQuotaData> = {
  type: 'opencode-go',
  i18nPrefix: 'opencode_go_quota',
  filterFn: (file) => isOpencodeGoFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchOpencodeGoQuota,
  enrichQuota: enrichOpencodeGoQuota,
  storeSelector: (state) => state.opencodeGoQuota,
  storeSetter: 'setOpencodeGoQuota',
  buildLoadingState: () => ({ status: 'loading', windows: [] }),
  buildSuccessState: (data) => ({
    status: 'success',
    windows: data.windows,
    planType: data.planType ?? null,
    planLabel: data.planLabel ?? null,
    email: data.email ?? null,
  }),
  buildErrorState: (message, status) => ({
    status: 'error',
    windows: [],
    error: message,
    errorStatus: status,
  }),
};
