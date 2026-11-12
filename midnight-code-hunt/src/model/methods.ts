import type { CodeTrail } from "@sentinel/skeleton-core";
import type { DrillRecord, MethodId } from "./types";

/** Index Keyword Lookup is always first. */
export const METHOD_ORDER: readonly MethodId[] = ["index", "toc"];

export const METHOD_LABELS: Readonly<Record<MethodId, string>> = {
  index: "Index Keyword Lookup",
  toc: "Table of Contents Lookup",
};

/**
 * Method from the level of the first step of the first leg.
 * "index" -> index; "chapter", "annex", "article" -> toc.
 */
export function methodOf(trail: CodeTrail): MethodId {
  return trail.legs[0][0].level === "index" ? "index" : "toc";
}

/** Methods offered for a drill, Index Keyword Lookup first. */
export function availableMethods(drill: DrillRecord): readonly MethodId[] {
  if (drill.index_checked === true && drill.trees.index !== undefined) {
    return ["index", "toc"];
  }
  return ["toc"];
}

export function defaultMethod(drill: DrillRecord): MethodId {
  return availableMethods(drill)[0];
}
