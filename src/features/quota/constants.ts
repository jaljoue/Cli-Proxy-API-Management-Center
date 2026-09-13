import type { QuotaProviderType } from './providers/types';

/** Tab order also determines provider grouping in the All view. */
export const QUOTA_TAB_ORDER: readonly QuotaProviderType[] = [
  'claude',
  'antigravity',
  'codex',
  'xai',
  'kimi',
  'opencode-go',
];

export type QuotaTabId = 'all' | QuotaProviderType;

/** Use 20 entries per page and cap refresh-all upstream concurrency at 20. */
export const QUOTA_PAGE_SIZE = 20;

/** Default sorting groups by provider; soonest sorts by earliest reset. */
export const QUOTA_SORT_MODES = ['default', 'soonest'] as const;

export type QuotaSortMode = (typeof QUOTA_SORT_MODES)[number];

/** Match useRevealGroup's GROUP_MAX_TOTAL: 360ms for the card stagger. */
export const CARD_ENTRANCE_BUDGET_MS = 360;
