import {
  QUOTA_SORT_MODES,
  QUOTA_TAB_ORDER,
  type QuotaSortMode,
  type QuotaTabId,
} from './constants';

/** ledger is the default grouped row list; cards is the card grid. */
export const QUOTA_VIEW_MODES = ['ledger', 'cards'] as const;
export type QuotaViewMode = (typeof QUOTA_VIEW_MODES)[number];

/** Persist quota UI preferences in sessionStorage for the current session only. */
export type QuotaUiState = {
  tab?: QuotaTabId;
  sortMode?: QuotaSortMode;
  view?: QuotaViewMode;
  /** Mask emails in credential names by default in every new session. */
  maskEmails?: boolean;
};

const QUOTA_UI_STATE_KEY = 'quotaPage.uiState';

const QUOTA_TAB_ID_SET = new Set<string>(['all', ...QUOTA_TAB_ORDER]);
const QUOTA_SORT_MODE_SET = new Set<string>(QUOTA_SORT_MODES);
const QUOTA_VIEW_MODE_SET = new Set<string>(QUOTA_VIEW_MODES);

export const isQuotaTabId = (value: unknown): value is QuotaTabId =>
  typeof value === 'string' && QUOTA_TAB_ID_SET.has(value);

export const isQuotaSortMode = (value: unknown): value is QuotaSortMode =>
  typeof value === 'string' && QUOTA_SORT_MODE_SET.has(value);

export const isQuotaViewMode = (value: unknown): value is QuotaViewMode =>
  typeof value === 'string' && QUOTA_VIEW_MODE_SET.has(value);

export const readQuotaUiState = (): QuotaUiState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(QUOTA_UI_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuotaUiState;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      tab: isQuotaTabId(parsed.tab) ? parsed.tab : undefined,
      sortMode: isQuotaSortMode(parsed.sortMode) ? parsed.sortMode : undefined,
      view: isQuotaViewMode(parsed.view) ? parsed.view : undefined,
      maskEmails: typeof parsed.maskEmails === 'boolean' ? parsed.maskEmails : undefined,
    };
  } catch {
    return null;
  }
};

/**
 * Merge into whatever is already stored.
 *
 * Callers write one preference at a time — the tab strip knows nothing about
 * the sort control — so a whole-object write would silently drop the other
 * field every time either one changed.
 */
export const writeQuotaUiState = (state: QuotaUiState) => {
  if (typeof window === 'undefined') return;
  try {
    const next = { ...readQuotaUiState(), ...state };
    window.sessionStorage.setItem(QUOTA_UI_STATE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
};
