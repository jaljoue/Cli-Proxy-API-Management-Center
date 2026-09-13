/**
 * Provider summary strip: one tile per provider with the pooled picture.
 *
 * Reads `409% of 500%` — the sum of every account's primary window against the
 * pool's ceiling — with one segment per credential, and the earliest reset in
 * the pool. Clicking a tile narrows the ledger to that provider.
 */

import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { ResolvedTheme } from '@/types';
import {
  getAuthFileIcon,
  getThemeSurfaceIconBackground,
  getTypeLabel,
  isThemeSurfaceIconProvider,
} from '@/features/authFiles/constants';
import type { SummaryTile } from '../ledger/summaryModel';
import { meterToneFor } from './ledgerTone';
import styles from './QuotaSummaryStrip.module.scss';

export interface QuotaSummaryStripProps {
  tiles: SummaryTile[];
  resolvedTheme: ResolvedTheme;
  activeType: string;
  displayNameFor: (name: string) => string;
  onSelect: (type: string) => void;
}

export function QuotaSummaryStrip({
  tiles,
  resolvedTheme,
  activeType,
  displayNameFor,
  onSelect,
}: QuotaSummaryStripProps) {
  const { t } = useTranslation();
  if (tiles.length === 0) return null;

  return (
    <div className={styles.strip}>
      {tiles.map((tile) => {
        const label = getTypeLabel(t, tile.type);
        const iconSrc = getAuthFileIcon(tile.type, resolvedTheme);
        const ratio =
          tile.capacityTotal > 0 ? (tile.remainingTotal / tile.capacityTotal) * 100 : null;
        const tone = meterToneFor(ratio);
        const active = activeType === tile.type;
        const valueLabel = tile.loadedCount === 0 ? '--' : `${tile.remainingTotal}%`;
        const ceiling = Math.max(100, tile.capacityTotal || tile.credentialCount * 100);

        return (
          <button
            key={tile.type}
            type="button"
            className={`${styles.tile} ${active ? styles.tileActive : ''}`}
            aria-pressed={active}
            title={t('quota_management.summary_filter', { provider: label })}
            onClick={() => onSelect(active ? 'all' : tile.type)}
          >
            <div className={styles.head}>
              <span
                className={styles.iconWrap}
                style={
                  isThemeSurfaceIconProvider(tile.type)
                    ? { background: getThemeSurfaceIconBackground(resolvedTheme) }
                    : undefined
                }
              >
                {iconSrc ? (
                  <img src={iconSrc} alt="" className={styles.icon} />
                ) : (
                  <span className={styles.iconFallback}>{label.slice(0, 1).toUpperCase()}</span>
                )}
              </span>
              <span className={styles.name}>{label}</span>
              <span className={styles.count}>
                {t('quota_management.summary_credentials', { count: tile.credentialCount })}
              </span>
            </div>

            <div className={styles.meterLabel}>{tile.meterLabel ?? '—'}</div>
            <div className={styles.value} data-tone={tone}>
              <span className={styles.valueMain}>{valueLabel}</span>
              <span className={styles.valueCeiling}>
                {t('quota_management.summary_of', { total: ceiling })}
              </span>
            </div>

            <div
              className={styles.segments}
              style={{ '--segment-count': tile.segments.length } as CSSProperties}
              aria-hidden="true"
            >
              {tile.segments.map((segment) => (
                <span
                  key={segment.name}
                  className={styles.segment}
                  title={displayNameFor(segment.name)}
                >
                  <span
                    className={styles.segmentFill}
                    data-tone={meterToneFor(segment.remaining)}
                    style={{ width: `${segment.remaining ?? 0}%` }}
                  />
                </span>
              ))}
            </div>

            <div className={styles.reset}>
              {tile.nextReset ? (
                <>
                  {tile.nextReset.relative && (
                    <span
                      className={
                        tile.nextReset.soon ? styles.resetRelativeSoon : styles.resetRelative
                      }
                    >
                      {tile.nextReset.relative}
                    </span>
                  )}
                  {tile.nextReset.absolute && (
                    <span className={styles.resetAbsolute}>{tile.nextReset.absolute}</span>
                  )}
                </>
              ) : tile.loadedCount === 0 ? (
                <span className={styles.resetMuted}>
                  {t('quota_management.summary_not_loaded')}
                </span>
              ) : (
                <span className={styles.resetMuted}>{t('quota_management.no_reset_pending')}</span>
              )}
              {tile.loadedCount > 0 && tile.loadedCount < tile.credentialCount && (
                <span className={styles.partial}>
                  {t('quota_management.summary_partial', {
                    loaded: tile.loadedCount,
                    count: tile.credentialCount,
                  })}
                </span>
              )}
            </div>

            {tile.secondaryLabel && tile.secondaryRemainingTotal !== null && (
              <div className={styles.secondary}>
                <span className={styles.secondaryLabel}>{tile.secondaryLabel}</span>
                <span className={styles.secondaryValue}>{tile.secondaryRemainingTotal}%</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
