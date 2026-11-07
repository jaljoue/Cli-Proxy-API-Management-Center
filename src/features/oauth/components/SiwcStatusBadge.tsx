import { useTranslation } from 'react-i18next';
import type { SiwcBindingStatus } from '../siwcBinding';
import styles from './SiwcStatusBadge.module.scss';

/**
 * SIWC binding status pill: a dot and short status text, matching the small monospace metadata.
 * withLabel can omit the SIWC prefix when context is clear, such as inside the SIWC dialog.
 */
export function SiwcStatusBadge({
  status,
  withLabel = true,
}: {
  status: SiwcBindingStatus;
  withLabel?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <span className={styles.badge} data-status={status}>
      <span className={styles.dot} aria-hidden="true" />
      {withLabel && <span className={styles.label}>SIWC</span>}
      <span>{t(`siwc.${status}`)}</span>
    </span>
  );
}
