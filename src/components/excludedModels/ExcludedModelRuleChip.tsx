import type { ReactNode } from 'react';
import { IconX } from '@/components/ui/icons';
import styles from './ExcludedModelRuleChip.module.scss';

/**
 * Exclusion chip -- three variants distinguished by **origin**, replacing two near-duplicate
 * hand-written markups (`.excludedModelChip` in `AuthFileDetailsSheet.module.scss` and
 * `.customRuleChip` in `AuthFilesOAuthExcludedEditPage.module.scss`).
 *
 * - `exact`    solid, primary tinted: a model the user explicitly checked; removable directly.
 * - `wildcard` dashed: a model derived from a wildcard rule. No ✕ -- removing it means editing
 *              that rule, and offering a ✕ would promise something it cannot do.
 * - `unknown`  dashed, muted: an exact rule absent from the catalog (e.g. a retired model id);
 *              removable.
 */
export type ExcludedModelChipVariant = 'exact' | 'wildcard' | 'unknown';

export interface ExcludedModelRuleChipProps {
  label: string;
  variant?: ExcludedModelChipVariant;
  /** Secondary note, e.g. the rule this chip derives from. */
  detail?: string;
  /** Omit to render no ✕. */
  onRemove?: () => void;
  removeAriaLabel?: string;
  disabled?: boolean;
  title?: string;
}

/** Wrapping container for chips. Exported separately so consumers need not each write flex-wrap. */
export function ExcludedModelChipRow({ children }: { children: ReactNode }) {
  return <div className={styles.chipRow}>{children}</div>;
}

export function ExcludedModelRuleChip({
  label,
  variant = 'exact',
  detail,
  onRemove,
  removeAriaLabel,
  disabled = false,
  title,
}: ExcludedModelRuleChipProps) {
  return (
    <span
      className={`${styles.chip} ${styles[variant]}`}
      title={title ?? (detail ? `${label} — ${detail}` : label)}
    >
      <span className={styles.label}>{label}</span>
      {detail ? <span className={styles.detail}>{detail}</span> : null}
      {onRemove ? (
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          disabled={disabled}
          aria-label={removeAriaLabel ?? label}
        >
          <IconX size={12} />
        </button>
      ) : null}
    </span>
  );
}
