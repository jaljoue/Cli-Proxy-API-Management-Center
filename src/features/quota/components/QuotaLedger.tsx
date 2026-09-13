/**
 * Ledger view: credentials as rows grouped by provider, meters aligned in columns.
 *
 * The card grid answers "how is this key"; with several accounts per provider
 * the ledger answers "how is the pool" — every account's weekly window sits in
 * the same column, so the eye scans down instead of hunting across cards.
 *
 * Behaviour contracts shared with the cards (unchanged): rows mount idle and
 * load only on click, refresh/reset go through the same hooks, and loaded state
 * lives in the quota store so switching views never refetches.
 */

import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconRefreshCw } from '@/components/ui/icons';
import type { ResolvedTheme } from '@/types';
import { resolveQuotaErrorMessage } from '@/utils/quota';
import { useNow } from '@/hooks/useNow';
import {
  getAuthFileIcon,
  getThemeSurfaceIconBackground,
  getTypeLabel,
  isThemeSurfaceIconProvider,
} from '@/features/authFiles/constants';
import { QUOTA_ADAPTERS, type QuotaCardState } from '../providers';
import type { QuotaProviderType } from '../providers/types';
import { isQuotaRefreshDisabled, type QuotaFileEntry } from '../logic';
import {
  buildLedgerRow,
  type LedgerFact,
  type LedgerMeter,
  type LedgerTone,
} from '../ledger/rowModel';
import { meterToneFor } from './ledgerTone';
import bodyStyles from './QuotaBody.module.scss';
import styles from './QuotaLedger.module.scss';

export interface QuotaLedgerProps {
  entries: QuotaFileEntry[];
  quotaFor: (entry: QuotaFileEntry) => QuotaCardState | undefined;
  displayNameFor: (name: string) => string;
  resolvedTheme: ResolvedTheme;
  /** Group rows under a provider heading (default order) or keep them flat (custom sort). */
  grouped: boolean;
  canUseActions: boolean;
  resettingQuotaName: string | null;
  batchLoading: boolean;
  onRefresh: (entry: QuotaFileEntry) => void;
  onReset: (entry: QuotaFileEntry) => void;
  onLoadIdle: (entries: QuotaFileEntry[]) => void;
}

interface LedgerGroup {
  type: QuotaProviderType | null;
  entries: QuotaFileEntry[];
}

const groupEntries = (entries: QuotaFileEntry[], grouped: boolean): LedgerGroup[] => {
  if (!grouped) return [{ type: null, entries }];
  const groups: LedgerGroup[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.type === entry.type) last.entries.push(entry);
    else groups.push({ type: entry.type, entries: [entry] });
  }
  return groups;
};

const planToneClass = (tone: LedgerTone): string => {
  if (tone === 'elite') return bodyStyles.elitePlanValue;
  if (tone === 'premium') return bodyStyles.premiumPlanValue;
  return styles.plan;
};

function ProviderGlyph({ type, resolvedTheme }: { type: string; resolvedTheme: ResolvedTheme }) {
  const { t } = useTranslation();
  const iconSrc = getAuthFileIcon(type, resolvedTheme);
  const label = getTypeLabel(t, type);
  return (
    <span
      className={styles.glyph}
      title={label}
      style={
        isThemeSurfaceIconProvider(type)
          ? { background: getThemeSurfaceIconBackground(resolvedTheme) }
          : undefined
      }
    >
      {iconSrc ? (
        <img src={iconSrc} alt="" className={styles.glyphImage} />
      ) : (
        <span className={styles.glyphFallback}>{label.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}

function Meter({ meter }: { meter: LedgerMeter }) {
  const { t } = useTranslation();
  const tone = meterToneFor(meter.remaining);
  const percent = meter.remaining === null ? '--' : `${Math.round(meter.remaining)}%`;
  return (
    <div className={styles.meter} data-primary={meter.primary || undefined}>
      <div className={styles.meterHead}>
        <span className={styles.meterLabel} title={meter.label}>
          {meter.label}
        </span>
        <span className={styles.meterValue} data-tone={tone}>
          {meter.detail && <span className={styles.meterDetail}>{meter.detail}</span>}
          {percent}
        </span>
      </div>
      <div className={styles.track} aria-hidden="true">
        <span
          className={styles.fill}
          data-tone={tone}
          style={{ width: `${meter.remaining ?? 0}%` }}
        />
      </div>
      <div className={styles.meterReset}>
        {meter.reset ? (
          <>
            {meter.reset.relative && (
              <span className={meter.reset.soon ? styles.resetSoon : styles.resetRelative}>
                {meter.reset.relative}
              </span>
            )}
            {meter.reset.absolute && (
              <span className={styles.resetAbsolute}>{meter.reset.absolute}</span>
            )}
          </>
        ) : (
          <span className={styles.resetMuted}>{t('quota_management.no_reset_pending')}</span>
        )}
      </div>
    </div>
  );
}

function Fact({ fact }: { fact: LedgerFact }) {
  return (
    <div className={styles.fact}>
      <span className={styles.factLabel}>{fact.label}</span>
      <span className={fact.tone ? planToneClass(fact.tone) : styles.factValue}>{fact.value}</span>
      {fact.lines.map((line, index) => (
        <span
          key={`${fact.id}-${index}`}
          className={fact.soon ? styles.factLineSoon : styles.factLine}
          title={line}
        >
          {line}
        </span>
      ))}
      {fact.error && <span className={styles.factError}>{fact.error}</span>}
    </div>
  );
}

export function QuotaLedger(props: QuotaLedgerProps) {
  const {
    entries,
    quotaFor,
    displayNameFor,
    resolvedTheme,
    grouped,
    canUseActions,
    resettingQuotaName,
    batchLoading,
    onRefresh,
    onReset,
    onLoadIdle,
  } = props;
  const { t, i18n } = useTranslation();
  const now = useNow();
  const locale = i18n.resolvedLanguage;

  const groups = useMemo(() => groupEntries(entries, grouped), [entries, grouped]);
  const idleEntries = useMemo(
    () => entries.filter((entry) => (quotaFor(entry)?.status ?? 'idle') === 'idle'),
    [entries, quotaFor]
  );

  return (
    <div className={styles.ledger}>
      {idleEntries.length > 0 && (
        <div className={styles.loadBanner}>
          <span className={styles.loadHint}>{t('quota_management.ledger_load_hint')}</span>
          <button
            type="button"
            className={styles.loadButton}
            onClick={() => onLoadIdle(idleEntries)}
            disabled={!canUseActions || batchLoading}
          >
            <IconRefreshCw size={13} className={batchLoading ? styles.spinning : undefined} />
            {t('quota_management.ledger_load_all', { count: idleEntries.length })}
          </button>
        </div>
      )}

      {groups.map((group) => {
        const groupKey = group.type ?? 'flat';
        return (
          <section
            key={groupKey}
            className={styles.group}
            aria-label={group.type ? getTypeLabel(t, group.type) : undefined}
          >
            {group.type && (
              <header className={styles.groupHead}>
                <ProviderGlyph type={group.type} resolvedTheme={resolvedTheme} />
                <span className={styles.groupName}>{getTypeLabel(t, group.type)}</span>
                <span className={styles.groupCount}>{group.entries.length}</span>
              </header>
            )}
            <div className={styles.rows}>
              {group.entries.map((entry) => {
                const quota = quotaFor(entry);
                const status = quota?.status ?? 'idle';
                const adapter = QUOTA_ADAPTERS[entry.type];
                const loading = status === 'loading';
                const resetting = resettingQuotaName === entry.file.name;
                const rowCanRefresh = canUseActions && !entry.file.disabled;
                const row = buildLedgerRow({ type: entry.type, quota, t, now, locale });
                const showReset =
                  status === 'success' &&
                  Boolean(adapter.resetQuota) &&
                  quota !== undefined &&
                  Boolean(adapter.canResetQuota?.(quota));
                const errorMessage = resolveQuotaErrorMessage(
                  t,
                  quota?.errorStatus,
                  quota?.error || t('common.unknown_error')
                );
                const displayName = displayNameFor(entry.file.name);

                let body: ReactNode;
                if (status === 'idle') {
                  body = (
                    <button
                      type="button"
                      className={styles.idle}
                      onClick={() => onRefresh(entry)}
                      disabled={!rowCanRefresh}
                    >
                      <IconRefreshCw size={13} aria-hidden="true" />
                      {t('quota_management.ledger_load')}
                    </button>
                  );
                } else if (loading) {
                  body = (
                    <div className={styles.skeleton} aria-busy="true">
                      <span className={styles.srOnly}>{t(`${adapter.i18nPrefix}.loading`)}</span>
                      {[0, 1].map((index) => (
                        <div key={index} className={styles.skeletonMeter} aria-hidden="true">
                          <span className={styles.skeletonLabel} />
                          <span className={styles.skeletonTrack} />
                        </div>
                      ))}
                    </div>
                  );
                } else if (status === 'error') {
                  body = (
                    <div className={styles.error} role="alert">
                      {t(`${adapter.i18nPrefix}.load_failed`, { message: errorMessage })}
                    </div>
                  );
                } else if (row.meters.length === 0) {
                  body = <div className={styles.message}>{row.message}</div>;
                } else {
                  body = (
                    <div className={styles.meters}>
                      {row.meters.map((meter) => (
                        <Meter key={meter.id} meter={meter} />
                      ))}
                    </div>
                  );
                }

                return (
                  <article
                    key={`${entry.type}:${entry.file.name}`}
                    className={styles.row}
                    data-status={status}
                  >
                    <div className={styles.identity}>
                      {!group.type && (
                        <ProviderGlyph type={entry.type} resolvedTheme={resolvedTheme} />
                      )}
                      <div className={styles.identityText}>
                        <span className={styles.name} title={displayName}>
                          {displayName}
                        </span>
                        <span className={styles.subline}>
                          {row.planLabel ? (
                            <span className={planToneClass(row.planTone)}>{row.planLabel}</span>
                          ) : (
                            <span className={styles.plan}>{getTypeLabel(t, entry.type)}</span>
                          )}
                          {row.subline.length > 0 && (
                            <span className={styles.sublinePart}>{row.subline.join(' · ')}</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className={styles.body}>
                      {body}
                      {status === 'success' && row.meters.length > 0 && row.message && (
                        <div className={styles.message}>{row.message}</div>
                      )}
                    </div>

                    <div className={styles.facts}>
                      {status === 'success' &&
                        row.facts.map((fact) => <Fact key={fact.id} fact={fact} />)}
                    </div>

                    <div className={styles.actions}>
                      {status !== 'idle' && (
                        <>
                          {showReset && (
                            <button
                              type="button"
                              className={styles.action}
                              onClick={() => onReset(entry)}
                              disabled={!rowCanRefresh || loading || resetting}
                              title={t('codex_quota.reset_button')}
                            >
                              <IconRefreshCw
                                size={13}
                                className={resetting ? styles.spinning : undefined}
                              />
                              {t('codex_quota.reset_button')}
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.action}
                            onClick={() => onRefresh(entry)}
                            disabled={isQuotaRefreshDisabled(rowCanRefresh, loading, resetting)}
                            title={t('auth_files.quota_refresh_hint')}
                          >
                            <IconRefreshCw
                              size={13}
                              className={loading ? styles.spinning : undefined}
                            />
                            {t('auth_files.quota_refresh_single')}
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
