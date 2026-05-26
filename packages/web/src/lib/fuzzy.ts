/**
 * fuzzy.ts — simple subsequence fuzzy-filter with position-weighted scoring.
 *
 * fuzzyFilter(query, items) returns the subset of items whose `name` contains
 * all characters of `query` as a subsequence (case-insensitive), sorted by
 * score (earlier match position → higher score).
 */

export interface FuzzyItem {
  name: string;
  description?: string;
}

/**
 * Score a match: lower is better (penalises later first-match position).
 * Returns -1 if query is not a subsequence of name.
 */
function scoreMatch(query: string, name: string): number {
  const q = query.toLowerCase();
  const n = name.toLowerCase();
  let qi = 0;
  let firstMatch = -1;
  for (let ni = 0; ni < n.length && qi < q.length; ni++) {
    if (n[ni] === q[qi]) {
      if (firstMatch === -1) firstMatch = ni;
      qi++;
    }
  }
  if (qi < q.length) return -1; // not a subsequence
  return firstMatch; // 0 = matched at the very start (best)
}

/**
 * Returns items whose name is a fuzzy (subsequence) match for query,
 * sorted by match score (best match first). If query is empty, returns
 * all items in original order.
 */
export function fuzzyFilter<T extends FuzzyItem>(query: string, items: T[]): T[] {
  if (query.length === 0) return items;
  const scored: Array<{ item: T; score: number }> = [];
  for (const item of items) {
    const score = scoreMatch(query, item.name);
    if (score !== -1) scored.push({ item, score });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.map((s) => s.item);
}
