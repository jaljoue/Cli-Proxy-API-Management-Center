/**
 * OpenCode Go quota, served by the opencode-go-cliproxyapi plugin's management route.
 *
 * The plugin registers `POST /v0/management/plugins/opencode-go-cliproxyapi/quota-usage`:
 * an empty body lists the configured credentials (no upstream call), a body with
 * `key_id` fetches that credential's usage from OpenCode. The key id is the
 * sha256 of the API key, which is also the credential's auth-file basename.
 */

import { apiClient } from './client';
import { isRecord } from '@/utils/helpers';
import type { OpencodeGoQuotaCardPayload, OpencodeGoUsagePayload } from '@/types';

export const OPENCODE_GO_PLUGIN_ID = 'opencode-go-cliproxyapi';
export const OPENCODE_GO_KEY_ID_PREFIX = 'opencode-go-key-';

const QUOTA_PATH = `/plugins/${OPENCODE_GO_PLUGIN_ID}/quota-usage`;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const normalizeUsage = (value: unknown): OpencodeGoUsagePayload | null => {
  if (!isRecord(value)) return null;
  const pick = (window: unknown) =>
    isRecord(window)
      ? {
          status: asString(window.status) ?? null,
          percent: (window.percent as number | string | null | undefined) ?? null,
          resets_at: asString(window.resets_at ?? window.resetsAt) ?? null,
        }
      : null;
  return {
    rolling: pick(value.rolling),
    weekly: pick(value.weekly),
    monthly: pick(value.monthly),
  };
};

const normalizeCard = (value: unknown): OpencodeGoQuotaCardPayload | null => {
  if (!isRecord(value)) return null;
  const keyId = asString(value.key_id ?? value.keyId);
  if (!keyId) return null;
  return {
    key_id: keyId,
    label: asString(value.label),
    usage: normalizeUsage(value.usage),
  };
};

export const opencodeGoApi = {
  /** Configured credentials, without contacting OpenCode. */
  async listQuotaCards(): Promise<OpencodeGoQuotaCardPayload[]> {
    const data = await apiClient.post<Record<string, unknown>>(QUOTA_PATH, {});
    const cards = isRecord(data) && Array.isArray(data.cards) ? data.cards : [];
    return cards
      .map((card) => normalizeCard(card))
      .filter((card): card is OpencodeGoQuotaCardPayload => card !== null);
  },

  /** Live usage for one credential; the plugin answers 502 when OpenCode is unreachable. */
  async fetchQuota(keyId: string): Promise<OpencodeGoQuotaCardPayload | null> {
    const data = await apiClient.post<Record<string, unknown>>(QUOTA_PATH, { key_id: keyId });
    return normalizeCard(data);
  },
};
