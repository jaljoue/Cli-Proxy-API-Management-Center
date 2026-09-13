/**
 * Auth file related types
 * Based on src/modules/auth-files.js from the original project
 */

import type { RecentRequestBucket } from '@/utils/recentRequests';

export type AuthFileType =
  | 'qwen'
  | 'kimi'
  | 'gemini'
  | 'aistudio'
  | 'claude'
  | 'codex'
  | 'antigravity'
  | 'xai'
  | 'iflow'
  | 'vertex'
  | 'empty'
  | 'unknown';

export interface AuthFileItem {
  name: string;
  type?: AuthFileType | string;
  provider?: string;
  /**
   * Credential account email (both backend auth_files branches fill it: the disk scan reads the
   * JSON email field, the registry reads Metadata/Attributes). The card's main row leads with it.
   * Note: the backend also sends account/account_type, but for api-key credentials, account is
   * the API key itself (AccountInfo() -> return "api_key", apiKey); **never use it for display or search**.
   */
  email?: string;
  /** GCP / Vertex project ID; identity fallback when the account email is missing. */
  projectId?: string;
  size?: number;
  authIndex?: string | number | null;
  runtimeOnly?: boolean | string;
  disabled?: boolean;
  unavailable?: boolean;
  status?: string;
  statusMessage?: string;
  lastRefresh?: string | number;
  modified?: number;
  priority?: number;
  weight?: number;
  note?: string;
  success?: unknown;
  failed?: unknown;
  /** Normalized cumulative success/failure counts (filled at the API boundary from the raw success/failed fields). */
  successCount?: number;
  failureCount?: number;
  recent_requests?: RecentRequestBucket[];
  recentRequests?: RecentRequestBucket[];
  [key: string]: unknown;
}

export interface AuthFilesResponse {
  files: AuthFileItem[];
  total?: number;
}
