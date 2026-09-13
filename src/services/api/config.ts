/**
 * Config APIs
 */

import { apiClient } from './client';
import type { Config } from '@/types';
import { normalizeConfigResponse } from './transformers';

export const configApi = {
  /**
   * Fetch the config (fields are normalized)
   */
  async getConfig(): Promise<Config> {
    const raw = await apiClient.get('/config');
    return normalizeConfigResponse(raw);
  },

  /**
   * Request logging toggle
   */
  updateRequestLog: (enabled: boolean) => apiClient.put('/request-log', { value: enabled }),
};
