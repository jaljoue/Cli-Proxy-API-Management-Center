/**
 * Determine full-width rows in a two-column grid: explicit wide rows and otherwise unpaired rows.
 * A row is unpaired at a row start if it is last or followed by a full-width row. Pure for testing.
 * SettingList uses this to decide which child rows receive wide.
 */
export function resolveRowSpans(wide: readonly boolean[]): boolean[] {
  let column = 0;
  return wide.map((isWide, index) => {
    if (isWide) {
      column = 0;
      return true;
    }
    const orphan = column === 0 && (index === wide.length - 1 || wide[index + 1]);
    column = orphan ? 0 : 1 - column;
    return orphan;
  });
}
