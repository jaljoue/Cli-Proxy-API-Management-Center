import { QUOTA_PROGRESS_HIGH_THRESHOLD, QUOTA_PROGRESS_MEDIUM_THRESHOLD } from './QuotaMeter';

export type MeterTone = 'high' | 'medium' | 'low' | 'none';

/** Same three-step colouring as QuotaMeter, exposed as a data attribute value. */
export const meterToneFor = (remaining: number | null): MeterTone => {
  if (remaining === null || !Number.isFinite(remaining)) return 'none';
  if (remaining >= QUOTA_PROGRESS_HIGH_THRESHOLD) return 'high';
  if (remaining >= QUOTA_PROGRESS_MEDIUM_THRESHOLD) return 'medium';
  return 'low';
};
