/**
 * OpenCode Go quota through CPA v8's native plugin quota API.
 *
 * The opencode-go-cliproxyapi plugin declares the `quota_provider` capability, and the host
 * serves `POST /v8/management/plugins/:pluginId/quota` with `{ "auth_index": "..." }`. The
 * response follows the shared plugin quota shape: an optional `subscription` (present only
 * when the API key has OpenCode Console access) and `groups[].buckets[]`, one bucket per
 * usage window (`5h`, `weekly`, `monthly`) with the remaining fraction and reset instant.
 */

import { apiClient } from './client';
import { isRecord } from '@/utils/helpers';
import type { OpencodeGoQuotaBucketPayload, OpencodeGoQuotaPayload } from '@/types';

/** Fallback when an older credential listing lacks `quota_plugin_id`. */
export const OPENCODE_GO_PLUGIN_ID = 'opencode-go-cliproxyapi';

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const asFraction = (value: unknown): number | null => {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeBucket = (value: unknown): OpencodeGoQuotaBucketPayload | null => {
  if (!isRecord(value)) return null;
  const window = asString(value.window);
  if (!window) return null;
  return {
    window,
    remainingFraction: asFraction(value.remainingFraction ?? value.remaining_fraction),
    resetTime: asString(value.resetTime ?? value.reset_time),
    description: asString(value.description),
  };
};

export const normalizeOpencodeGoQuotaPayload = (value: unknown): OpencodeGoQuotaPayload => {
  const payload = isRecord(value) ? value : {};
  const subscription = isRecord(payload.subscription) ? payload.subscription : null;
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  const buckets = groups.flatMap((group) =>
    isRecord(group) && Array.isArray(group.buckets)
      ? group.buckets
          .map((bucket) => normalizeBucket(bucket))
          .filter((bucket): bucket is OpencodeGoQuotaBucketPayload => bucket !== null)
      : []
  );
  return {
    plan: subscription ? asString(subscription.plan) : null,
    tierName: subscription ? asString(subscription.tierName ?? subscription.tier_name) : null,
    buckets,
  };
};

export const opencodeGoApi = {
  /** Live usage for one credential; the host answers 502 when OpenCode is unreachable. */
  async fetchQuota(pluginId: string, authIndex: string): Promise<OpencodeGoQuotaPayload> {
    const data = await apiClient.post<unknown>(`/plugins/${encodeURIComponent(pluginId)}/quota`, {
      auth_index: authIndex,
    });
    return normalizeOpencodeGoQuotaPayload(data);
  },
};
