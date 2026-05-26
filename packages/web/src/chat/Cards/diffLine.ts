/**
 * diffLine.ts — hand-rolled line-diff utility (no external library).
 *
 * Produces a flat list of diff hunks by computing the longest common
 * subsequence (LCS) of the two line arrays and emitting 'del' / 'add' / 'eq'
 * entries for each line.
 *
 * lineNo is 1-based and refers to the line number in the source that produced
 * the entry:
 *   - 'eq'  → line number in `before`
 *   - 'del' → line number in `before`
 *   - 'add' → line number in `after`
 */

export type DiffEntry = { type: "eq" | "add" | "del"; text: string; lineNo: number };

/**
 * Compute LCS lengths table for two string arrays.
 * Returns a 2D array `dp` where dp[i][j] is the LCS length of
 * before[0..i-1] and after[0..j-1].
 */
function lcsTable(before: string[], after: string[]): number[][] {
  const m = before.length;
  const n = after.length;
  // Allocate (m+1) x (n+1) table initialised to 0.
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (before[i - 1] === after[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }
  return dp;
}

/**
 * Compute the line diff between `before` and `after` strings.
 *
 * Returns an array of DiffEntry records in the order they appear in the
 * merged output, suitable for rendering a unified-style diff view.
 */
export function lineDiff(before: string, after: string): DiffEntry[] {
  const bLines = before.split("\n");
  const aLines = after.split("\n");

  const dp = lcsTable(bLines, aLines);
  const result: DiffEntry[] = [];

  // Backtrack through the LCS table to emit diff entries.
  let i = bLines.length;
  let j = aLines.length;
  const stack: DiffEntry[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && bLines[i - 1] === aLines[j - 1]) {
      // Equal line — in LCS.
      stack.push({ type: "eq", text: bLines[i - 1]!, lineNo: i });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      // Line added in `after`.
      stack.push({ type: "add", text: aLines[j - 1]!, lineNo: j });
      j--;
    } else {
      // Line deleted from `before`.
      stack.push({ type: "del", text: bLines[i - 1]!, lineNo: i });
      i--;
    }
  }

  // stack is in reverse order; reverse it for top-to-bottom output.
  stack.reverse();
  for (const entry of stack) {
    result.push(entry);
  }

  return result;
}
