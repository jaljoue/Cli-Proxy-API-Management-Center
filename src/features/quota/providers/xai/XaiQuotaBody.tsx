/**
 * xAI quota body: plan chip row (SuperGrok Heavy / paid tier = gold card),
 * weekly/monthly billing level bars, pay-as-you-go balance.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { XaiQuotaState } from '@/types';
import { buildResetDisplay, formatQuotaResetTime, parseIsoToMs } from '@/utils/quota';
import { useNow } from '@/hooks/useNow';
import { QuotaMeter } from '../../components/QuotaMeter';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import { XAI_WEEKLY_ROW_ID, collectQuotaRowInstants, pickUrgentRowId } from '../../resetSchedule';
import type { QuotaBodyProps } from '../../types';
import {
  formatXaiOnDemandAmount,
  formatXaiPercent,
  formatXaiRemainingAmount,
  resolveXaiPlan,
} from './presentation';

export function XaiQuotaBody({ quota, classes }: QuotaBodyProps<XaiQuotaState>) {
  const { t, i18n } = useTranslation();
  // Ahead of the early return below — hooks cannot be conditional.
  const now = useNow();
  const locale = i18n.resolvedLanguage;
  // Only the weekly limit is a quota window; the monthly figure is a billing
  // cycle, so it is never the row that "recovers first".
  const weeklySoon = useMemo(
    () => pickUrgentRowId(collectQuotaRowInstants('xai', quota), now) === XAI_WEEKLY_ROW_ID,
    [quota, now]
  );
  const billing = quota.billing;

  if (!billing) {
    return <div className={classes.quotaMessage}>{t('xai_quota.empty_data')}</div>;
  }

  if (billing.mode === 'paid-health') {
    return (
      <>
        <div className={classes.codexPlan}>
          <span className={classes.codexPlanLabel}>{t('xai_quota.plan_label')}</span>
          <span className={classes.premiumPlanValue}>{t('xai_quota.plan_paid')}</span>
        </div>
        <div className={classes.quotaMessage}>{t('xai_quota.paid_health')}</div>
      </>
    );
  }

  const clampedUsed =
    billing.usedPercent === null ? null : Math.max(0, Math.min(100, billing.usedPercent));
  const remaining = clampedUsed === null ? null : Math.max(0, Math.min(100, 100 - clampedUsed));
  const percentLabel = formatXaiPercent(remaining);
  const amountLabel = formatXaiRemainingAmount(billing);
  const resetLabel = formatQuotaResetTime(billing.billingPeriodEnd);
  // The monthly row is a billing cycle, so it carries no resetAtMs (that field
  // is derived from periodEnd, the weekly quota window). Parse for the
  // countdown; the summary keeps the two periods deliberately distinct.
  const monthlyResetDisplay = buildResetDisplay(
    resetLabel,
    parseIsoToMs(billing.billingPeriodEnd),
    now,
    locale
  );
  const onDemandCap = billing.onDemandCapCents ?? 0;
  const clampedOnDemandUsed =
    billing.onDemandUsedPercent === null
      ? null
      : Math.max(0, Math.min(100, billing.onDemandUsedPercent));
  const onDemandRemaining =
    clampedOnDemandUsed === null ? null : Math.max(0, Math.min(100, 100 - clampedOnDemandUsed));
  const onDemandPercentLabel = formatXaiPercent(onDemandRemaining);
  const onDemandAmountLabel = formatXaiOnDemandAmount(billing);
  const plan = resolveXaiPlan(billing.monthlyLimitCents);
  const weeklyUsed =
    billing.periodType === 'weekly' && billing.usagePercent !== null
      ? Math.max(0, Math.min(100, billing.usagePercent))
      : null;
  const weeklyRemaining = weeklyUsed === null ? null : Math.max(0, Math.min(100, 100 - weeklyUsed));
  const weeklyResetLabel = formatQuotaResetTime(billing.periodEnd);
  const weeklyResetDisplay = buildResetDisplay(
    weeklyResetLabel === '-' ? null : t('xai_quota.reset_at', { time: weeklyResetLabel }),
    billing.resetAtMs,
    now,
    locale
  );
  const hasWeeklyData =
    billing.periodType === 'weekly' &&
    (weeklyUsed !== null || Boolean(billing.periodEnd) || billing.productUsage.length > 0);
  const hasMonthlyData =
    billing.monthlyLimitCents !== null ||
    billing.usedCents !== null ||
    Boolean(billing.billingPeriodEnd);

  return (
    <>
      {plan && (
        <div className={classes.codexPlan}>
          <span className={classes.codexPlanLabel}>{t('xai_quota.plan_label')}</span>
          <span className={plan.premium ? classes.premiumPlanValue : classes.codexPlanValue}>
            {t(`xai_quota.${plan.labelKey}`)}
          </span>
        </div>
      )}
      {hasWeeklyData && (
        <div
          className={classes.quotaRow}
          title={weeklySoon ? t('quota_management.soonest_row_hint') : undefined}
        >
          <div className={classes.quotaRowHeader}>
            <span className={classes.quotaModel}>{t('xai_quota.weekly_limit')}</span>
            <div className={classes.quotaMeta}>
              <span className={classes.quotaPercent}>
                {t('xai_quota.used_percent', {
                  percent: formatXaiPercent(weeklyUsed),
                })}
              </span>
              {weeklyResetDisplay && (
                <QuotaResetLabel display={weeklyResetDisplay} classes={classes} soon={weeklySoon} />
              )}
            </div>
          </div>
          <QuotaMeter percent={weeklyRemaining} classes={classes} index={0} />
        </div>
      )}
      {billing.productUsage.map((item, index) => {
        const used =
          item.usagePercent === null ? null : Math.max(0, Math.min(100, item.usagePercent));
        const remainingPercent = used === null ? null : Math.max(0, Math.min(100, 100 - used));
        return (
          <div key={`product-${item.product}`} className={classes.quotaRow}>
            <div className={classes.quotaRowHeader}>
              <span className={classes.quotaModel}>
                {t('xai_quota.product_usage', { product: item.product })}
              </span>
              <div className={classes.quotaMeta}>
                <span className={classes.quotaPercent}>
                  {t('xai_quota.used_percent', {
                    percent: formatXaiPercent(used),
                  })}
                </span>
              </div>
            </div>
            <QuotaMeter percent={remainingPercent} classes={classes} index={index + 1} />
          </div>
        );
      })}
      {onDemandCap > 0 ? (
        <div className={classes.quotaRow}>
          <div className={classes.quotaRowHeader}>
            <span className={classes.quotaModel}>{t('xai_quota.pay_as_you_go_label')}</span>
            <div className={classes.quotaMeta}>
              <span className={classes.quotaPercent}>{onDemandPercentLabel}</span>
              <span className={classes.quotaAmount}>{onDemandAmountLabel}</span>
            </div>
          </div>
          <QuotaMeter
            percent={onDemandRemaining}
            classes={classes}
            index={billing.productUsage.length + 1}
          />
        </div>
      ) : (
        <div className={classes.codexPlan}>
          <span className={classes.codexPlanLabel}>{t('xai_quota.pay_as_you_go_label')}</span>
          <span className={classes.codexPlanValue}>{t('xai_quota.pay_as_you_go_disabled')}</span>
        </div>
      )}
      {hasMonthlyData && (
        <div className={classes.quotaRow}>
          <div className={classes.quotaRowHeader}>
            <span className={classes.quotaModel}>{t('xai_quota.monthly_credits')}</span>
            <div className={classes.quotaMeta}>
              <span className={classes.quotaPercent}>{percentLabel}</span>
              <span className={classes.quotaAmount}>{amountLabel}</span>
              {monthlyResetDisplay && (
                <QuotaResetLabel display={monthlyResetDisplay} classes={classes} />
              )}
            </div>
          </div>
          <QuotaMeter
            percent={remaining}
            classes={classes}
            index={billing.productUsage.length + 2}
          />
        </div>
      )}
    </>
  );
}
