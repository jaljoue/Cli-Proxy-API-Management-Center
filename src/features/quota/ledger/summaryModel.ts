/**
 * Provider summary strip: one tile per provider with the fleet-wide picture.
 *
 * With several accounts per provider, the question is not "how is this key"
 * but "how much runway does the whole pool have". Each tile sums the *primary*
 * meter of every loaded credential (the weekly / Fable window), so a pool of
 * five Max accounts reads `409% of 500%` with a segment per account, and the
 * earliest reset among them is the moment the pool starts recovering.
 *
 * Pure — built from `LedgerRow`s, never from raw provider state, so the tile
 * and the rows beneath it can never disagree.
 */

import type { LedgerMeter, LedgerReset, LedgerRow } from './rowModel';
import type { QuotaProviderType } from '../providers/types';

export interface SummarySegment {
  /** Credential file name — links the segment back to its row. */
  name: string;
  /** Remaining percent 0..100; null for unloaded credentials (drawn as empty). */
  remaining: number | null;
}

export interface SummaryTile {
  type: QuotaProviderType;
  credentialCount: number;
  loadedCount: number;
  /** Label of the aggregated meter, taken from the first loaded row. */
  meterLabel: string | null;
  /** Sum of remaining percent across loaded credentials. */
  remainingTotal: number;
  /** `100 × loaded credentials` — the ceiling the total is read against. */
  capacityTotal: number;
  segments: SummarySegment[];
  /** Earliest upcoming reset among the aggregated meters. */
  nextReset: LedgerReset | null;
  nextResetAtMs: number | null;
  /** Secondary meter (e.g. the account-wide 7-day window beside the Fable one). */
  secondaryLabel: string | null;
  secondaryRemainingTotal: number | null;
}

export interface SummaryInput {
  type: QuotaProviderType;
  rows: { name: string; row: LedgerRow; loaded: boolean }[];
  now: number;
}

const primaryOf = (row: LedgerRow): LedgerMeter | undefined =>
  row.meters.find((meter) => meter.primary) ?? row.meters[0];

export function buildSummaryTile(input: SummaryInput): SummaryTile {
  const { type, rows, now } = input;
  const loadedRows = rows.filter((entry) => entry.loaded);

  let remainingTotal = 0;
  let capacityTotal = 0;
  let meterLabel: string | null = null;
  let nextReset: LedgerReset | null = null;
  let nextResetAtMs: number | null = null;
  const segments: SummarySegment[] = [];

  for (const entry of rows) {
    const primary = entry.loaded ? primaryOf(entry.row) : undefined;
    const remaining = primary?.remaining ?? null;
    segments.push({ name: entry.name, remaining });
    if (!primary) continue;
    if (meterLabel === null) meterLabel = primary.label;
    capacityTotal += 100;
    remainingTotal += remaining ?? 0;
    const at = primary.resetAtMs;
    if (at !== null && at > now && (nextResetAtMs === null || at < nextResetAtMs)) {
      nextResetAtMs = at;
      nextReset = primary.reset;
    }
  }

  // A second, non-primary meter that every loaded row shares — Claude's
  // account-wide 7-day window beside the model-scoped one. Summed only when
  // every loaded credential reports it, so the number stays comparable.
  let secondaryLabel: string | null = null;
  let secondaryRemainingTotal: number | null = null;
  if (loadedRows.length > 0) {
    const candidate = loadedRows[0].row.meters.find(
      (meter) => !meter.primary && meter.remaining !== null && (meter.periodHours ?? 0) >= 24
    );
    if (candidate) {
      const matches = loadedRows.map((entry) =>
        entry.row.meters.find((meter) => meter.id === candidate.id && meter.remaining !== null)
      );
      if (matches.every((meter) => meter !== undefined)) {
        secondaryLabel = candidate.label;
        secondaryRemainingTotal = matches.reduce(
          (total, meter) => total + ((meter as LedgerMeter).remaining ?? 0),
          0
        );
      }
    }
  }

  return {
    type,
    credentialCount: rows.length,
    loadedCount: loadedRows.length,
    meterLabel,
    remainingTotal: Math.round(remainingTotal),
    capacityTotal,
    segments,
    nextReset,
    nextResetAtMs,
    secondaryLabel,
    secondaryRemainingTotal:
      secondaryRemainingTotal === null ? null : Math.round(secondaryRemainingTotal),
  };
}
