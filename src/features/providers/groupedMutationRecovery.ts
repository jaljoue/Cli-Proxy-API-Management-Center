export class GroupedPartialMutationError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause ?? 'Grouped mutation failed'));
    this.name = 'GroupedPartialMutationError';
    this.cause = cause;
  }
}

export const isGroupedPartialMutationError = (
  error: unknown
): error is GroupedPartialMutationError => error instanceof GroupedPartialMutationError;

/**
 * Run a mutation that touches several protocol configs. On failure the config is
 * refetched (best effort) so the UI reflects whatever partial state was written,
 * and the original error is preserved as `cause`.
 */
export async function runGroupedMutationWithRecovery<T>(
  action: () => Promise<T>,
  refresh: () => Promise<unknown>
): Promise<T> {
  try {
    return await action();
  } catch (error: unknown) {
    try {
      await refresh();
    } catch {
      // Preserve the original mutation error; refresh is best-effort recovery.
    }
    throw new GroupedPartialMutationError(error);
  }
}
