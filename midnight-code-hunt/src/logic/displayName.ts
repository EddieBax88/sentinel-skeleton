import { extractFirstNumber } from "@sentinel/skeleton-core";
import type { OptionNode } from "../model/types";
import { CHAPTER_LABELS } from "./chapters";

export type Edition = 2023 | 2026;

export type CheckedNameEntry = {
  readonly key: string; // 1-80 chars, unique within its file
  readonly shortDescription: string; // 1-80 chars, [a-z0-9 ,-] only
  readonly printed?: string; // 1-200 chars, word for word, only meaningful when checked
  readonly checked: boolean;
};

export type CheckedNamesFile = {
  readonly edition: Edition;
  readonly entries: readonly CheckedNameEntry[];
};

export type CheckedNamesIndex = Readonly<Record<Edition, ReadonlyMap<string, CheckedNameEntry>>>;

export function buildNamesIndex(files: {
  readonly y2023: CheckedNamesFile;
  readonly y2026: CheckedNamesFile;
}): CheckedNamesIndex {
  const toMap = (file: CheckedNamesFile): ReadonlyMap<string, CheckedNameEntry> => {
    const map = new Map<string, CheckedNameEntry>();
    for (const entry of file.entries) {
      if (!map.has(entry.key)) map.set(entry.key, entry);
    }
    return map;
  };
  return { 2023: toMap(files.y2023), 2026: toMap(files.y2026) };
}

export type DisplayResolution = {
  readonly text: string;
  readonly source: "chapter-label" | "printed" | "short-description" | "raw";
  /** Set when node.nameKey has no entry in the edition's file (Req 3.8). */
  readonly unresolvedKey?: string;
  /** Set when checked is true but printed wording is missing (Req 3.4). */
  readonly inconsistent?: boolean;
};

/** Edition of a node: role "moved" -> 2023, otherwise 2026 (Req 3.5). */
export function editionOf(node: OptionNode): Edition {
  return node.role === "moved" ? 2023 : 2026;
}

export function resolveDisplay(node: OptionNode, names: CheckedNamesIndex): DisplayResolution {
  if (node.level === "chapter") {
    const n = extractFirstNumber(node.value);
    if (n !== null && Number.isInteger(n) && n >= 1 && n <= 9) {
      return { text: CHAPTER_LABELS[n - 1] as string, source: "chapter-label" };
    }
  }
  if (node.nameKey === undefined) {
    return { text: node.value, source: "raw" };
  }
  const entry = names[editionOf(node)].get(node.nameKey);
  if (entry === undefined) {
    return { text: node.value, source: "raw", unresolvedKey: node.nameKey };
  }
  const fallback =
    node.designator !== undefined && node.designator !== ""
      ? node.designator + " " + entry.shortDescription
      : entry.shortDescription;
  if (entry.checked) {
    if (entry.printed !== undefined) {
      return { text: entry.printed, source: "printed" };
    }
    return { text: fallback, source: "short-description", inconsistent: true };
  }
  return { text: fallback, source: "short-description" };
}
