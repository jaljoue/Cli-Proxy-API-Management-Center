/**
 * OpenCode Go quota data layer: rolling / weekly / monthly windows.
 * React-free / SCSS-free -- consumed directly by tests/opencodeGoQuota.test.ts.
 *
 * Data comes from the opencode-go-cliproxyapi plugin's management route, not a direct
 * /api-call to upstream: the plugin holds the API key; the frontend only exchanges the
 * key's sha256 (which is also the auth file name) for usage.
 */

import type { TFunction } from 'i18next';
import type {
  AuthFileItem,
  OpencodeGoQuotaState,
  OpencodeGoQuotaWindow,
  OpencodeGoUsagePayload,
} from '@/types';
import { OPENCODE_GO_KEY_ID_PREFIX, opencodeGoApi } from '@/services/api';
import {
  formatQuotaResetTime,
  isDisabledAuthFile,
  isOpencodeGoFile,
  normalizeNumberValue,
  normalizeStringValue,
  resolveResetMs,
} from '@/utils/quota';
import type { QuotaProviderData } from '../types';

export type OpencodeGoQuotaData = {
  windows: OpencodeGoQuotaWindow[];
  planType?: string | null;
  email?: string | null;
};

/** Window order on the card: shortest first, matching every other provider. */
export const OPENCODE_GO_WINDOW_KEYS = [
  { key: 'rolling', labelKey: 'opencode_go_quota.rolling_limit', periodHours: 5 },
  { key: 'weekly', labelKey: 'opencode_go_quota.weekly_limit', periodHours: 24 * 7 },
  { key: 'monthly', labelKey: 'opencode_go_quota.monthly_limit', periodHours: 24 * 30 },
] as const;

/**
 * The plugin's quota key id is the sha256 of the API key, and the auth record
 * it materializes is named `<key id>.json` — so the file name is the lookup key.
 */
export const resolveOpencodeGoKeyId = (file: AuthFileItem): string | null => {
  const candidates = [file.id, file.key_id, file.keyId, file.name];
  for (const candidate of candidates) {
    const value = normalizeStringValue(candidate);
    if (!value) continue;
    const stripped = value.toLowerCase().endsWith('.json') ? value.slice(0, -5) : value;
    if (stripped.startsWith(OPENCODE_GO_KEY_ID_PREFIX)) return stripped;
  }
  return null;
};

export const buildOpencodeGoQuotaWindows = (
  payload: OpencodeGoUsagePayload,
  t: TFunction
): OpencodeGoQuotaWindow[] => {
  const windows: OpencodeGoQuotaWindow[] = [];
  for (const { key, labelKey, periodHours } of OPENCODE_GO_WINDOW_KEYS) {
    const window = payload[key];
    if (!window || typeof window !== 'object') continue;
    const usedPercent = normalizeNumberValue(window.percent);
    const resetsAt = normalizeStringValue(window.resets_at ?? window.resetsAt) ?? undefined;
    windows.push({
      id: key,
      label: t(labelKey),
      labelKey,
      usedPercent: usedPercent === null ? null : Math.max(0, Math.min(100, usedPercent)),
      resetLabel: formatQuotaResetTime(resetsAt),
      resetAtMs: resolveResetMs([resetsAt]),
      periodHours,
      windowStatus: normalizeStringValue(window.status),
    });
  }
  return windows;
};

const fetchOpencodeGoQuota = async (
  file: AuthFileItem,
  t: TFunction
): Promise<OpencodeGoQuotaData> => {
  const keyId = resolveOpencodeGoKeyId(file);
  if (!keyId) {
    throw new Error(t('opencode_go_quota.missing_key_id'));
  }
  const card = await opencodeGoApi.fetchQuota(keyId);
  if (!card?.usage) {
    throw new Error(t('opencode_go_quota.empty_windows'));
  }
  return {
    windows: buildOpencodeGoQuotaWindows(card.usage, t),
    planType: card.plan_type ?? null,
    email: card.email ?? null,
  };
};

export const OPENCODE_GO_CONFIG: QuotaProviderData<OpencodeGoQuotaState, OpencodeGoQuotaData> = {
  type: 'opencode-go',
  i18nPrefix: 'opencode_go_quota',
  filterFn: (file) => isOpencodeGoFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchOpencodeGoQuota,
  storeSelector: (state) => state.opencodeGoQuota,
  storeSetter: 'setOpencodeGoQuota',
  buildLoadingState: () => ({ status: 'loading', windows: [] }),
  buildSuccessState: (data) => ({
    status: 'success',
    windows: data.windows,
    planType: data.planType ?? null,
    email: data.email ?? null,
  }),
  buildErrorState: (message, status) => ({
    status: 'error',
    windows: [],
    error: message,
    errorStatus: status,
  }),
};
