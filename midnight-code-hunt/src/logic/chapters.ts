import { extractFirstNumber } from "@sentinel/skeleton-core";
import type { OptionNode } from "../model/types";

/** Founder-supplied Chapter labels, word for word, Ch 1 to Ch 9. */
export const CHAPTER_LABELS: readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
] = [
  "Ch 1 General",
  "Ch 2 Plan: circuits, protection, grounding",
  "Ch 3 Build: wiring methods, raceways, cables, boxes",
  "Ch 4 Use: equipment",
  "Ch 5 Special occupancies",
  "Ch 6 Special equipment",
  "Ch 7 Special conditions",
  "Ch 8 Communications",
  "Ch 9 Tables",
];

/**
 * Always returns nine nodes ordered Ch 1..Ch 9. For each chapter number n, the first authored
 * node whose extractFirstNumber(value) === n is used; otherwise a generated wrong node with no
 * `next`. Authored nodes whose number is outside 1-9 are dropped.
 */
export function completeChapterOptions(authored: readonly OptionNode[]): readonly OptionNode[] {
  const byNumber = new Map<number, OptionNode>();
  for (const node of authored) {
    const n = extractFirstNumber(node.value);
    if (n !== null && n >= 1 && n <= 9 && !byNumber.has(n)) byNumber.set(n, node);
  }
  const result: OptionNode[] = [];
  for (let n = 1; n <= 9; n++) {
    result.push(
      byNumber.get(n) ?? { level: "chapter", value: `Chapter ${n}`, role: "wrong" },
    );
  }
  return result;
}
