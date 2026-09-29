/**
 * OpenCode Go quota body: plan chip row (Go Plus = gold card) + rolling / weekly / monthly
 * meter rows.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { OpencodeGoQuotaState } from '@/types';
import { buildResetDisplay } from '@/utils/quota';
import { useNow } from '@/hooks/useNow';
import { QuotaMeter } from '../../components/QuotaMeter';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import { collectQuotaRowInstants, pickUrgentRowId } from '../../resetSchedule';
import type { QuotaBodyProps } from '../../types';
import { getOpencodeGoPlanLabel, isOpencodeGoPremiumPlan } from './presentation';

export function OpencodeGoQuotaBody({ quota, classes }: QuotaBodyProps<OpencodeGoQuotaState>) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const soonestRowId = useMemo(
    () => pickUrgentRowId(collectQuotaRowInstants('opencode-go', quota), now),
    [quota, now]
  );
  const windows = quota.windows ?? [];
  const planLabel = getOpencodeGoPlanLabel(t, quota.planType);

  return (
    <>
      {planLabel && (
        <div className={classes.codexPlan}>
          <span className={classes.codexPlanLabel}>{t('opencode_go_quota.plan_label')}</span>
          <span
            className={
              isOpencodeGoPremiumPlan(quota.planType)
                ? classes.premiumPlanValue
                : classes.codexPlanValue
            }
          >
            {planLabel}
          </span>
        </div>
      )}
      {windows.length === 0 ? (
        <div className={classes.quotaMessage}>{t('opencode_go_quota.empty_windows')}</div>
      ) : (
        windows.map((window, index) => {
          const used = window.usedPercent;
          const remaining = used === null ? null : Math.max(0, Math.min(100, 100 - used));
          const percentLabel = remaining === null ? '--' : `${Math.round(remaining)}%`;
          const windowLabel = window.labelKey ? t(window.labelKey) : window.label;
          const resetDisplay = buildResetDisplay(
            window.resetLabel,
            window.resetAtMs,
            now,
            i18n.resolvedLanguage
          );
          const soon = window.id === soonestRowId;

          return (
            <div
              key={window.id}
              className={classes.quotaRow}
              title={soon ? t('quota_management.soonest_row_hint') : undefined}
            >
              <div className={classes.quotaRowHeader}>
                <span className={classes.quotaModel}>{windowLabel}</span>
                <div className={classes.quotaMeta}>
                  <span className={classes.quotaPercent}>{percentLabel}</span>
                  {resetDisplay && (
                    <QuotaResetLabel display={resetDisplay} classes={classes} soon={soon} />
                  )}
                </div>
              </div>
              <QuotaMeter percent={remaining} classes={classes} index={index} />
            </div>
          );
        })
      )}
    </>
  );
}
