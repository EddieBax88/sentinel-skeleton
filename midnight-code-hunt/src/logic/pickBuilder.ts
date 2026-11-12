import type { TrailLevel, UserPick } from "@sentinel/skeleton-core";
import type { OptionNode } from "../model/types";

/**
 * Resolved path (path[0] is the Keyword node) -> Core picks. Excludes the Keyword node,
 * preserves click order, and adds and omits nothing. Each pick is { level: node.level, value: node.value },
 * with the value copied verbatim.
 * Index Keyword Lookup: the two clicks of the Index step give two picks, first level "index"
 * (entry path), then level "section" or "table" (the number the Index gives); subdivisions
 * follow as further "section" picks.
 */
export function buildGradePicks(path: readonly OptionNode[]): UserPick[] {
  return path.slice(1).map((node) => ({
    // Only path[0] is a keyword node; every later node carries a Core trail level.
    level: node.level as TrailLevel,
    value: node.value,
  }));
}

/** The Keyword pick: the value of the first node on the path. */
export function keywordOf(path: readonly OptionNode[]): string | undefined {
  return path[0]?.value;
}
