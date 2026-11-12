import { extractFirstNumber } from "@sentinel/skeleton-core";
import type {
  DrillRecord,
  MethodId,
  NodeLevel,
  OptionNode,
  OptionTree,
} from "../model/types";
import { completeChapterOptions } from "./chapters";
import { resolveDisplay } from "./displayName";
import type { CheckedNamesIndex } from "./displayName";

export type FlowState = { readonly method: MethodId; readonly picks: readonly string[] };

export type OptionView = {
  readonly value: string;
  readonly text: string;
  readonly selected: boolean;
};

/** One click: the options offered at one depth of the tree and the pick made there, if any. */
export type ClickView = {
  readonly depth: number; // 0 = Keyword; the index into `picks`
  readonly level: NodeLevel;
  readonly options: readonly OptionView[];
  readonly selected?: string;
};

/** Labels the interface shows as step headings (Req 8.1, 9.1). */
export type StepLabel = "keyword" | "index" | "chapter" | "article" | "part" | "section" | "table";

/**
 * One labeled step. Every step holds exactly one click, except the Index step of Index Keyword
 * Lookup: a single step with a single heading holding two clicks (the entry path, then the number
 * the Index gives).
 */
export type StepView = {
  readonly label: StepLabel;
  readonly clicks: readonly ClickView[];
};

export type FlowView = {
  readonly steps: readonly StepView[];
  readonly pathEnded: boolean;
  readonly showRowNote: boolean;
};

/** Same comparison the Core grader uses for values. */
const norm = (s: string): string => s.trim().toLowerCase();

export function treeFor(drill: DrillRecord, method: MethodId): OptionTree {
  if (method === "toc") return drill.trees.toc;
  const tree = drill.trees.index;
  if (tree === undefined) {
    throw new Error(`Drill ${drill.def.id} has no Index tree`);
  }
  return tree;
}

/** The options a node leads to; the chapter level is always completed to nine. */
function childrenOf(node: OptionNode): readonly OptionNode[] | undefined {
  const next = node.next;
  if (next === undefined) return undefined;
  return next[0].level === "chapter" ? completeChapterOptions(next) : next;
}

/** Nodes offered at `depth` given picks[0..depth-1]; chapter level is completed to nine. */
export function optionsAt(
  tree: OptionTree,
  picks: readonly string[],
  depth: number,
): readonly OptionNode[] | undefined {
  if (!Number.isInteger(depth) || depth < 0 || picks.length < depth) return undefined;
  let options: readonly OptionNode[] | undefined = tree;
  for (let d = 0; d < depth; d++) {
    if (options === undefined) return undefined;
    const pick = norm(picks[d] as string);
    const node: OptionNode | undefined = options.find((o) => norm(o.value) === pick);
    if (node === undefined) return undefined;
    options = childrenOf(node);
  }
  return options;
}

/** Resolves picks to nodes by normalized value; undefined if any pick is not an offered option. */
export function resolvePath(
  tree: OptionTree,
  picks: readonly string[],
): readonly OptionNode[] | undefined {
  const path: OptionNode[] = [];
  let options: readonly OptionNode[] | undefined = tree;
  for (const raw of picks) {
    if (options === undefined) return undefined;
    const pick = norm(raw);
    const node: OptionNode | undefined = options.find((o) => norm(o.value) === pick);
    if (node === undefined) return undefined;
    path.push(node);
    options = childrenOf(node);
  }
  return path;
}

/** Level of the next click after `node` (Req 9.2): an Article node uses its has-Parts marker. */
export function nextStepLevel(node: OptionNode): NodeLevel | undefined {
  if (node.level === "article" && node.hasParts) return "part";
  return node.next?.[0].level;
}

function labelOfLevel(level: NodeLevel): StepLabel {
  switch (level) {
    case "keyword":
    case "index":
    case "chapter":
    case "article":
    case "part":
    case "section":
    case "table":
      return level;
    default:
      return "section"; // notes, annex: no dedicated heading yet (Req 2.17)
  }
}

/** Label of the step that owns the click at `depth`; the two Index clicks share the label "index". */
export function stepLabelAt(path: readonly OptionNode[], depth: number): StepLabel {
  if (depth <= 0) return "keyword";
  const previous = path[depth - 1];
  if (previous !== undefined && previous.level === "index") return "index";
  const node = path[depth];
  if (node !== undefined) return labelOfLevel(node.level);
  if (previous !== undefined) {
    const level = nextStepLevel(previous);
    if (level !== undefined) return labelOfLevel(level);
  }
  return "section";
}

/**
 * Req 8.10: keep picks[0..depth-1], then the new pick; everything after is cleared. If `value`
 * is not offered at `depth`, returns `picks` unchanged.
 */
export function applyPick(
  tree: OptionTree,
  picks: readonly string[],
  depth: number,
  value: string,
): readonly string[] {
  const options = optionsAt(tree, picks, depth);
  if (options === undefined) return picks;
  const wanted = norm(value);
  const node = options.find((o) => norm(o.value) === wanted);
  if (node === undefined) return picks;
  return [...picks.slice(0, depth), node.value];
}

/** Req 8.8, 8.9: true iff at least one pick exists and the latest picked node has no `next`. */
export function canCheck(tree: OptionTree, picks: readonly string[]): boolean {
  if (picks.length === 0) return false;
  const path = resolvePath(tree, picks);
  if (path === undefined) return false;
  const last = path[path.length - 1];
  return last !== undefined && last.next === undefined;
}

function isChapterNine(node: OptionNode): boolean {
  return node.level === "chapter" && extractFirstNumber(node.value) === 9;
}

/** Groups clicks into labeled steps: the first "index" click and its follow-up click form one Index step. */
export function viewFlow(
  tree: OptionTree,
  picks: readonly string[],
  names: CheckedNamesIndex,
): FlowView {
  // Keep only the leading picks that resolve; anything after an unresolved pick is dropped.
  let valid = picks;
  let path = resolvePath(tree, valid);
  while (path === undefined && valid.length > 0) {
    valid = valid.slice(0, -1);
    path = resolvePath(tree, valid);
  }
  const nodes = path ?? [];

  const last = nodes[nodes.length - 1];
  const pathEnded = last !== undefined && last.next === undefined;

  const clickCount = pathEnded ? nodes.length : nodes.length + 1;
  const clicks: ClickView[] = [];
  for (let depth = 0; depth < clickCount; depth++) {
    const options = optionsAt(tree, valid, depth);
    if (options === undefined || options.length === 0) break;
    const picked = nodes[depth];
    clicks.push({
      depth,
      level: (options[0] as OptionNode).level,
      options: options.map((o) => ({
        value: o.value,
        text: resolveDisplay(o, names).text,
        selected: picked !== undefined && o.value === picked.value,
      })),
      ...(picked !== undefined ? { selected: picked.value } : {}),
    });
  }

  const steps: StepView[] = [];
  for (let i = 0; i < clicks.length; i++) {
    const click = clicks[i] as ClickView;
    if (click.level === "index" && i + 1 < clicks.length) {
      steps.push({ label: "index", clicks: [click, clicks[i + 1] as ClickView] });
      i++;
    } else {
      steps.push({ label: stepLabelAt(nodes, click.depth), clicks: [click] });
    }
  }

  const showRowNote =
    pathEnded && last !== undefined && last.level === "table" && nodes.some(isChapterNine);

  return { steps, pathEnded, showRowNote };
}
