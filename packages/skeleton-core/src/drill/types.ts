import type { CodeTrail } from "../trail/types.js";
import type { TableValue } from "../table/types.js";

export type CodeTrailDef = {
  /** Non-empty, 1–128 chars. */
  readonly id: string;
  /** Non-empty, 1–128 chars. */
  readonly label: string;
  /** Non-empty list of valid trails. */
  readonly trails: readonly [CodeTrail, ...CodeTrail[]];
  /** Non-empty, 1–500 chars; paraphrased, never quoted NEC text. */
  readonly hint: string;
  /** Optional previous-edition (2023) trail. */
  readonly movedFrom?: CodeTrail;
  /** 1–300 chars; shown by the UI alongside `matchedMovedFrom` feedback. */
  readonly editionNote?: string;
  readonly tableValues?: ReadonlyArray<TableValue>;
};
