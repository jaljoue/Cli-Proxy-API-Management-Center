import { describe, expect, mock, test } from 'bun:test';
import {
  isGroupedPartialMutationError,
  runGroupedMutationWithRecovery,
} from '../src/features/providers/groupedMutationRecovery';

describe('grouped mutation recovery', () => {
  test('refreshes after a failed multi-endpoint mutation and preserves the original failure', async () => {
    const originalError = new Error('Claude update failed');
    const refresh = mock(async () => {});

    let caught: unknown;
    try {
      await runGroupedMutationWithRecovery(async () => {
        throw originalError;
      }, refresh);
    } catch (error) {
      caught = error;
    }

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(isGroupedPartialMutationError(caught)).toBe(true);
    expect((caught as Error & { cause?: unknown }).cause).toBe(originalError);
  });

  test('does not let a refresh failure replace the original mutation failure', async () => {
    const originalError = new Error('OpenAI update failed');

    await expect(
      runGroupedMutationWithRecovery(
        async () => {
          throw originalError;
        },
        async () => {
          throw new Error('refresh failed');
        }
      )
    ).rejects.toMatchObject({ cause: originalError });
  });
});
