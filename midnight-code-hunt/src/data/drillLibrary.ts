import type { DrillRecord } from "../model/types";

/*
 * Drill library (intentionally empty).
 *
 * Content rules:
 * - The founder supplies every question, answer, trail, hint, Index entry,
 *   and citation.
 * - Every new record starts with `founder_checked`, `index_checked`, and
 *   `wrongOptionsReviewed` all set to `false`.
 * - Kiro may draft only wrong options, and only when the founder asks. A
 *   record with drafted wrong options keeps `wrongOptionsReviewed: false`.
 * - Any table-sourced value is built with `makeTableValue`, with a `source`
 *   naming the table and `nfpa_checked: false`.
 */
export const DRILL_LIBRARY: readonly DrillRecord[] = [];
