/**
 * Quota page with provider tabs and shared ledger/card views.
 * Load quota only on user action; cards mount idle.
 * Preserve cacheGeneration session isolation and request-ID deduplication in
 * useQuotaBatchLoader.
 * Prune deleted credentials from provider caches when the file list changes.
 * This page owns the single useHeaderRefresh slot; global refresh reloads the file list.
 * Both views share stores and actions. The default ledger groups rows by provider and shows
 * pooled summaries.
 * Mask credential email addresses by default for screen sharing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFilesApi } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useNow } from '@/hooks/useNow';
import { useRevealGroup } from '@/hooks/motion';
import { useAuthStore, useQuotaStore, useThemeStore } from '@/stores';
import type { AuthFileItem, ResolvedTheme } from '@/types';
import { ProviderTabs } from '@/features/authFiles/components/ProviderTabs';
import { QuotaHeader } from './components/QuotaHeader';
import { QuotaCard } from './components/QuotaCard';
import { QuotaLedger } from './components/QuotaLedger';
import { QuotaSummaryStrip } from './components/QuotaSummaryStrip';
import { QuotaTimeline } from './components/QuotaTimeline';
import {
  CARD_ENTRANCE_BUDGET_MS,
  QUOTA_PAGE_SIZE,
  QUOTA_SORT_MODES,
  QUOTA_TAB_ORDER,
  type QuotaSortMode,
  type QuotaTabId,
} from './constants';
import {
  buildTabCounts,
  classifyQuotaFiles,
  filterEntriesByTab,
  paginate,
  sortQuotaEntries,
  type QuotaFileEntry,
} from './logic';
import { nextRecoveryMs } from './resetSchedule';
import { QUOTA_ADAPTERS, getQuotaSetter, type QuotaCardState } from './providers';
import type { QuotaProviderType } from './providers/types';
import { useQuotaActions } from './hooks/useQuotaActions';
import { useQuotaBatchLoader } from './hooks/useQuotaBatchLoader';
import { buildLedgerRow } from './ledger/rowModel';
import { maskCredentialName, shortenCredentialName } from './ledger/mask';
import { buildSummaryTile, type SummaryTile } from './ledger/summaryModel';
import {
  QUOTA_VIEW_MODES,
  readQuotaUiState,
  writeQuotaUiState,
  type QuotaViewMode,
} from './uiState';
import styles from './QuotaPage.module.scss';

const TAB_IDS: string[] = ['all', ...QUOTA_TAB_ORDER];
const SKELETON_CARD_COUNT = 6;

/**
 * Derive credential names once for cards, ledger rows and timeline lanes.
 * Mask filename emails as `f•••@e•••.dev`, preferring exact replacement using the backend email.
 * Always shorten long hashes in plugin-generated credential names.
 */
const buildDisplayName =
  (maskEmails: boolean, emailByName: ReadonlyMap<string, string>) => (name: string) =>
    shortenCredentialName(maskEmails ? maskCredentialName(name, emailByName.get(name)) : name);

export function QuotaPage() {
  const { t, i18n } = useTranslation();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const resolvedTheme: ResolvedTheme = useThemeStore((state) => state.resolvedTheme);

  const [files, setFiles] = useState<AuthFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<QuotaTabId>(() => readQuotaUiState()?.tab ?? 'all');
  const [sortMode, setSortMode] = useState<QuotaSortMode>(
    () => readQuotaUiState()?.sortMode ?? 'default'
  );
  const [page, setPage] = useState(1);
  const [view, setView] = useState<QuotaViewMode>(() => readQuotaUiState()?.view ?? 'ledger');
  // Mask emails by default in each new session; showing them requires an explicit action.
  const [maskEmails, setMaskEmails] = useState<boolean>(
    () => readQuotaUiState()?.maskEmails ?? true
  );
  // Stagger title, metadata, actions and tabs at 70ms intervals.
  const revealRef = useRevealGroup<HTMLDivElement>();
  const emailByName = useMemo(() => {
    const map = new Map<string, string>();
    files.forEach((file) => {
      if (typeof file.email === 'string' && file.email.trim()) map.set(file.name, file.email);
    });
    return map;
  }, [files]);
  const displayNameFor = useMemo(
    () => buildDisplayName(maskEmails, emailByName),
    [maskEmails, emailByName]
  );

  const disableControls = connectionStatus !== 'connected';

  /* File list. */

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authFilesApi.list();
      setFiles(data?.files || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('notification.refresh_failed');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useHeaderRefresh(loadFiles);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  /*
   * Read quota caches before classification and sorting because soonest-reset sorting needs
   * them.
   */

  const antigravityQuota = useQuotaStore((state) => state.antigravityQuota);
  const claudeQuota = useQuotaStore((state) => state.claudeQuota);
  const codexQuota = useQuotaStore((state) => state.codexQuota);
  const kimiQuota = useQuotaStore((state) => state.kimiQuota);
  const xaiQuota = useQuotaStore((state) => state.xaiQuota);
  const opencodeGoQuota = useQuotaStore((state) => state.opencodeGoQuota);

  const quotaByType = useMemo<Record<QuotaProviderType, Record<string, QuotaCardState>>>(
    () =>
      ({
        antigravity: antigravityQuota,
        claude: claudeQuota,
        codex: codexQuota,
        kimi: kimiQuota,
        xai: xaiQuota,
        'opencode-go': opencodeGoQuota,
      }) as unknown as Record<QuotaProviderType, Record<string, QuotaCardState>>,
    [antigravityQuota, claudeQuota, codexQuota, kimiQuota, xaiQuota, opencodeGoQuota]
  );

  const getQuota = useCallback(
    (entry: QuotaFileEntry): QuotaCardState | undefined => quotaByType[entry.type][entry.file.name],
    [quotaByType]
  );

  /* Classification, filtering, sorting and pagination. */

  // Subscribe to the minute clock only for soonest-reset sorting. Otherwise pageItems changes
  // identity each minute and needlessly retriggers the refresh-all loading-completion effect
  // below.
  const tick = useNow(sortMode !== 'default');
  const sortNow = sortMode === 'default' ? 0 : tick;

  const entries = useMemo(() => classifyQuotaFiles(files), [files]);
  const tabCounts = useMemo(() => buildTabCounts(entries), [entries]);
  const filteredEntries = useMemo(() => filterEntriesByTab(entries, tab), [entries, tab]);

  const resolveNextRecovery = useCallback(
    (entry: QuotaFileEntry) => nextRecoveryMs(entry.type, getQuota(entry), sortNow),
    [getQuota, sortNow]
  );
  // Sort before pagination so soonest-reset order applies across all pages.
  const sortedEntries = useMemo(
    () => sortQuotaEntries(filteredEntries, sortMode, resolveNextRecovery),
    [filteredEntries, sortMode, resolveNextRecovery]
  );

  const { pageItems, currentPage, totalPages } = useMemo(
    () => paginate(sortedEntries, page, QUOTA_PAGE_SIZE),
    [sortedEntries, page]
  );

  const handleTabChange = useCallback((next: string) => {
    setTab(next as QuotaTabId);
    setPage(1);
    writeQuotaUiState({ tab: next as QuotaTabId });
  }, []);

  const handleSortModeChange = useCallback((next: string) => {
    setSortMode(next as QuotaSortMode);
    setPage(1);
    writeQuotaUiState({ sortMode: next as QuotaSortMode });
  }, []);

  const handleViewChange = useCallback((next: string) => {
    setView(next as QuotaViewMode);
    writeQuotaUiState({ view: next as QuotaViewMode });
  }, []);

  const handleToggleMaskEmails = useCallback(() => {
    setMaskEmails((current) => {
      writeQuotaUiState({ maskEmails: !current });
      return !current;
    });
  }, []);

  const sortOptions = useMemo(
    () =>
      QUOTA_SORT_MODES.map((mode) => ({ value: mode, label: t(`quota_management.sort_${mode}`) })),
    [t]
  );

  const viewOptions = useMemo(
    () =>
      QUOTA_VIEW_MODES.map((mode) => ({ value: mode, label: t(`quota_management.view_${mode}`) })),
    [t]
  );

  const { loadedCount, attentionCount } = useMemo(() => {
    let loaded = 0;
    let attention = 0;
    entries.forEach((entry) => {
      const status = quotaByType[entry.type][entry.file.name]?.status;
      if (status === 'success') loaded += 1;
      else if (status === 'error') attention += 1;
    });
    return { loadedCount: loaded, attentionCount: attention };
  }, [entries, quotaByType]);

  /*
   * Pool provider summaries across all credentials, regardless of tabs or pagination. Subscribe
   * to the minute clock only when loaded data needs countdown updates.
   */

  const summaryNow = useNow(loadedCount > 0);
  const summaryTiles = useMemo<SummaryTile[]>(() => {
    const byType = new Map<QuotaProviderType, QuotaFileEntry[]>();
    entries.forEach((entry) => {
      const list = byType.get(entry.type) ?? [];
      list.push(entry);
      byType.set(entry.type, list);
    });
    return QUOTA_TAB_ORDER.filter((type) => byType.has(type)).map((type) =>
      buildSummaryTile({
        type,
        now: summaryNow,
        rows: (byType.get(type) ?? []).map((entry) => {
          const quota = getQuota(entry);
          return {
            name: entry.file.name,
            loaded: quota?.status === 'success',
            row: buildLedgerRow({
              type,
              quota,
              t,
              now: summaryNow,
              locale: i18n.resolvedLanguage,
            }),
          };
        }),
      })
    );
  }, [entries, getQuota, i18n.resolvedLanguage, summaryNow, t]);

  // After the file list settles, prune each provider cache to credentials that still exist.
  useEffect(() => {
    if (loading) return;
    const survivorsByType = new Map<QuotaProviderType, Set<string>>(
      QUOTA_TAB_ORDER.map((type) => [type, new Set<string>()])
    );
    entries.forEach((entry) => survivorsByType.get(entry.type)?.add(entry.file.name));

    QUOTA_TAB_ORDER.forEach((type) => {
      const survivors = survivorsByType.get(type) ?? new Set<string>();
      const setQuota = getQuotaSetter(QUOTA_ADAPTERS[type]);
      setQuota((prev) => {
        const staleKeys = Object.keys(prev).filter((name) => !survivors.has(name));
        if (staleKeys.length === 0) return prev;
        const next = { ...prev };
        staleKeys.forEach((name) => delete next[name]);
        return next;
      });
    });
  }, [entries, loading]);

  /* Loading and actions. */

  const { batchLoading, loadQuota } = useQuotaBatchLoader();
  const { resettingQuotaName, refreshQuota, resetQuota } = useQuotaActions(disableControls);

  const pendingRefreshRef = useRef(false);
  const prevLoadingRef = useRef(loading);

  // Refresh all reloads the file list first, then fetches the current page's quota when loading
  // finishes.
  const handleRefreshAll = useCallback(() => {
    if (disableControls) return;
    pendingRefreshRef.current = true;
    void loadFiles();
  }, [disableControls, loadFiles]);

  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = loading;

    if (!pendingRefreshRef.current) return;
    if (loading || !wasLoading) return;

    pendingRefreshRef.current = false;
    void loadQuota(pageItems);
  }, [loading, loadQuota, pageItems]);

  const canUseActions = !disableControls && !loading;

  /*
   * Animate only the first card batch. QuotaCard captures its delay in useState at mount.
   * Set cardsAnimated afterward so cards mounted by tab changes, pagination or refresh receive
   * null and do not replay.
   */

  const [cardsAnimated, setCardsAnimated] = useState(false);
  const enableCardEntrance = !cardsAnimated && !loading && pageItems.length > 0;
  useEffect(() => {
    if (enableCardEntrance) {
      setCardsAnimated(true);
    }
  }, [enableCardEntrance]);
  const cardEntranceDelay = (index: number): number | null => {
    if (!enableCardEntrance) return null;
    if (pageItems.length <= 1) return 0;
    return Math.round((index / (pageItems.length - 1)) * CARD_ENTRANCE_BUDGET_MS);
  };

  /* Rendering. */

  const isEmpty = !loading && filteredEntries.length === 0;

  return (
    <div className={styles.page} ref={revealRef}>
      <QuotaHeader
        totalCount={entries.length}
        loadedCount={loadedCount}
        attentionCount={attentionCount}
        refreshing={loading || batchLoading}
        disableControls={disableControls}
        maskEmails={maskEmails}
        onToggleMaskEmails={handleToggleMaskEmails}
        onRefreshAll={handleRefreshAll}
      />

      <section className={styles.workbench}>
        {!loading && summaryTiles.length > 0 && (
          <QuotaSummaryStrip
            tiles={summaryTiles}
            resolvedTheme={resolvedTheme}
            activeType={tab}
            displayNameFor={displayNameFor}
            onSelect={handleTabChange}
          />
        )}

        {/*
         * Reveal tabs and sorting together. useRevealGroup staggers each data-reveal descendant, so keep
         * sorting inside the same node.
         */}
        <div className={styles.tabsRow} data-reveal>
          <ProviderTabs
            types={TAB_IDS}
            counts={tabCounts}
            active={tab}
            resolvedTheme={resolvedTheme}
            onChange={handleTabChange}
          />
          <div className={styles.controls}>
            <div className={styles.sort}>
              <Select
                value={sortMode}
                options={sortOptions}
                onChange={handleSortModeChange}
                ariaLabel={t('quota_management.sort_label')}
                size="sm"
              />
            </div>
            <div className={styles.sort}>
              <Select
                value={view}
                options={viewOptions}
                onChange={handleViewChange}
                ariaLabel={t('quota_management.view_label')}
                size="sm"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className={styles.grid} aria-hidden="true">
            {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
              <Skeleton key={index} height={168} rounded={14} />
            ))}
          </div>
        ) : isEmpty ? (
          <EmptyState
            title={
              tab === 'all'
                ? t('quota_management.empty_title')
                : t(`${QUOTA_ADAPTERS[tab].i18nPrefix}.empty_title`)
            }
            description={
              tab === 'all'
                ? t('quota_management.empty_desc')
                : t(`${QUOTA_ADAPTERS[tab].i18nPrefix}.empty_desc`)
            }
            action={
              tab === 'all' ? undefined : (
                <Button variant="secondary" size="sm" onClick={() => handleTabChange('all')}>
                  {t('auth_files.filter_all')}
                </Button>
              )
            }
          />
        ) : view === 'ledger' ? (
          <QuotaLedger
            entries={pageItems}
            quotaFor={getQuota}
            displayNameFor={displayNameFor}
            resolvedTheme={resolvedTheme}
            grouped={sortMode === 'default'}
            canUseActions={canUseActions}
            resettingQuotaName={resettingQuotaName}
            batchLoading={batchLoading}
            onRefresh={(entry) => void refreshQuota(entry.file, QUOTA_ADAPTERS[entry.type])}
            onReset={(entry) => resetQuota(entry.file, QUOTA_ADAPTERS[entry.type])}
            onLoadIdle={(idle) => void loadQuota(idle)}
          />
        ) : (
          <div className={styles.grid}>
            {pageItems.map((entry, index) => (
              <QuotaCard
                key={`${entry.type}:${entry.file.name}`}
                entry={entry}
                quota={getQuota(entry)}
                displayName={displayNameFor(entry.file.name)}
                resolvedTheme={resolvedTheme}
                canRefresh={canUseActions && !entry.file.disabled}
                resetting={resettingQuotaName === entry.file.name}
                entranceDelayMs={cardEntranceDelay(index)}
                onRefresh={() => void refreshQuota(entry.file, QUOTA_ADAPTERS[entry.type])}
                onReset={() => resetQuota(entry.file, QUOTA_ADAPTERS[entry.type])}
              />
            ))}
          </div>
        )}

        {!loading && filteredEntries.length > QUOTA_PAGE_SIZE && (
          <div className={styles.pagination}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              {t('auth_files.pagination_prev')}
            </Button>
            <div className={styles.pageInfo}>
              {t('auth_files.pagination_info', {
                current: currentPage,
                total: totalPages,
                count: filteredEntries.length,
              })}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
            >
              {t('auth_files.pagination_next')}
            </Button>
          </div>
        )}

        {/* Limit timeline comparisons to the current page to bound the number of lanes. */}
        <QuotaTimeline
          entries={pageItems}
          quotaFor={getQuota}
          displayNameFor={displayNameFor}
          resolvedTheme={resolvedTheme}
        />
      </section>
    </div>
  );
}
