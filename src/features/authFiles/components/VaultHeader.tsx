import { useTranslation } from 'react-i18next';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { IconEye, IconEyeOff, IconRefreshCw, IconUpload } from '@/components/ui/icons';
import { useRevealGroup } from '@/hooks/motion';
import styles from './VaultHeader.module.scss';

export type VaultHeaderProps = {
  totalCount: number;
  activeCount: number;
  problemCount: number;
  loading: boolean;
  refreshing: boolean;
  uploading: boolean;
  disableControls: boolean;
  onUpload: () => void;
  onRefresh: () => void;
  refreshingCredentials?: boolean;
  credentialRefreshDisabled?: boolean;
  onRefreshCredentials?: () => void;
  /** Emails in credential names are masked (screen-share safe); omit to hide the toggle. */
  maskEmails?: boolean;
  onToggleMaskEmails?: () => void;
};

/**
 * Credential vault header: eyebrow (cursor prefix) + title + mono telemetry meta row + action area.
 * The meta row also carries the text equivalent of VaultPulse (the bar itself is aria-hidden).
 */
export function VaultHeader(props: VaultHeaderProps) {
  const {
    totalCount,
    activeCount,
    problemCount,
    loading,
    refreshing,
    uploading,
    disableControls,
    onUpload,
    onRefresh,
    refreshingCredentials = false,
    credentialRefreshDisabled = false,
    onRefreshCredentials,
    maskEmails = true,
    onToggleMaskEmails,
  } = props;
  const { t } = useTranslation();
  const revealRef = useRevealGroup<HTMLElement>();

  return (
    <header className={styles.header} ref={revealRef}>
      <div className={styles.copy}>
        <h1 className={styles.title} data-reveal>
          {t('auth_files.title')}
        </h1>
        <p className={styles.meta} data-reveal>
          <span className={styles.metaTotal}>
            {t('auth_files.meta_total', { count: totalCount })}
          </span>
          <span className={styles.metaDot} aria-hidden="true">
            ·
          </span>
          <span className={activeCount > 0 ? styles.metaActive : styles.metaMuted}>
            {t('auth_files.meta_active', { count: activeCount })}
          </span>
          {problemCount > 0 && (
            <>
              <span className={styles.metaDot} aria-hidden="true">
                ·
              </span>
              <span className={styles.metaProblem}>
                {t('auth_files.meta_problem', { count: problemCount })}
              </span>
            </>
          )}
        </p>
      </div>
      <div className={styles.actions} data-reveal>
        {onToggleMaskEmails && (
          <button
            type="button"
            className={styles.ghostAction}
            onClick={onToggleMaskEmails}
            aria-pressed={!maskEmails}
            title={t('auth_files.mask_hint')}
          >
            {maskEmails ? <IconEye size={14} /> : <IconEyeOff size={14} />}
            {maskEmails ? t('auth_files.show_emails') : t('auth_files.hide_emails')}
          </button>
        )}
        {onRefreshCredentials && (
          <button
            type="button"
            className={styles.ghostAction}
            onClick={onRefreshCredentials}
            disabled={
              disableControls || loading || refreshingCredentials || credentialRefreshDisabled
            }
          >
            {refreshingCredentials ? <LoadingSpinner size={14} /> : <IconRefreshCw size={14} />}
            {t('auth_files.refresh_all_button')}
          </button>
        )}
        <button
          type="button"
          className={styles.ghostAction}
          onClick={onRefresh}
          disabled={loading || refreshing}
        >
          <IconRefreshCw size={14} className={refreshing ? styles.spinning : undefined} />
          {t('common.refresh')}
        </button>
        <button
          type="button"
          className={styles.primaryAction}
          onClick={onUpload}
          disabled={disableControls || uploading}
        >
          {uploading ? <LoadingSpinner size={14} /> : <IconUpload size={15} />}
          {t('auth_files.upload_button')}
        </button>
      </div>
    </header>
  );
}
