import { gradeTrail } from "@sentinel/skeleton-core";
import type {
  CodeTrail,
  DrillDef,
  GradeResult,
  TrailLevel,
  UserPick,
} from "@sentinel/skeleton-core";
import { methodOf } from "../model/methods";
import type { DrillRecord, MethodId, OptionNode, TableWalk } from "../model/types";
import { resolveDisplay } from "./displayName";
import type { CheckedNamesIndex } from "./displayName";
import { buildGradePicks, keywordOf } from "./pickBuilder";

export type Verdict = "correct" | "incorrect" | "unanswered";

export type GradingSelection = {
  /** The single value passed to gradeTrail. */
  readonly drillDef: DrillDef;
  /** Keyword_Pick matches a valid trail keyword of the method. */
  readonly keywordCorrect: boolean;
  /** Same as keywordCorrect; case (a) of Req 10.2. */
  readonly keywordMatched: boolean;
};

const norm = (value: string | undefined): string | undefined =>
  value === undefined ? undefined : value.trim().toLowerCase();

/**
 * Pure. Case (a): the Keyword_Pick matches a trail keyword of the method, so only the trails
 * with that keyword are graded, and movedFrom is passed only for toc with a matching keyword.
 * Case (b): all trails of the method, no movedFrom, keyword incorrect.
 * Throws when the method has no trail.
 */
export function selectGradingInput(
  drill: DrillRecord,
  method: MethodId,
  keywordPick: string | undefined,
): GradingSelection {
  const methodTrails = drill.def.trails.filter((t) => methodOf(t) === method);
  if (methodTrails.length === 0) {
    const error = new Error(`Drill ${drill.def.id} has no trail for method ${method}`);
    error.name = "InvariantError";
    throw error;
  }
  const pick = norm(keywordPick);
  const matching =
    pick === undefined ? [] : methodTrails.filter((t) => norm(t.keyword) === pick);

  if (matching.length > 0) {
    const movedFrom = drill.def.movedFrom;
    const includeMoved =
      method === "toc" && movedFrom !== undefined && norm(movedFrom.keyword) === pick;
    const trails = matching as unknown as DrillDef["trails"];
    const drillDef: DrillDef =
      includeMoved && movedFrom !== undefined ? { trails, movedFrom } : { trails };
    return { drillDef, keywordCorrect: true, keywordMatched: true };
  }

  return {
    drillDef: { trails: methodTrails as unknown as DrillDef["trails"] },
    keywordCorrect: false,
    keywordMatched: false,
  };
}

export type ResultRow =
  | { kind: "keyword"; pickText?: string; verdict: Verdict }
  | {
      kind: "step";
      level: TrailLevel;
      pickText?: string;
      verdict: Verdict;
      synthetic: boolean;
      forkSentence?: string;
    }
  | { kind: "extra"; level: TrailLevel; pickText: string; verdict: "incorrect" }
  | { kind: "row-line"; tableWalk: TableWalk };

export type ResultModel = {
  readonly overall: "correct" | "incorrect";
  readonly rows: readonly ResultRow[];
  readonly matched: boolean;
  readonly matchedMovedFrom: boolean;
  /** "2023" when matchedMovedFrom (Req 10.10). */
  readonly verdictsAgainst: "2026" | "2023";
  readonly timeUp: boolean;
  readonly elapsedSeconds: number;
  readonly answer: string;
  readonly citation: string;
  readonly hint: string;
  /** Only when matchedMovedFrom. */
  readonly editionNote?: string;
};

export type GradeDeps = { readonly gradeTrail: typeof gradeTrail };

const defaultDeps: GradeDeps = { gradeTrail };

type PickedNode = { readonly pick: UserPick; readonly node: OptionNode };

const levelsOf = (trail: CodeTrail): TrailLevel[] =>
  trail.legs.flatMap((leg) => leg.map((step) => step.level));

const sameLevels = (a: readonly TrailLevel[], b: readonly TrailLevel[]): boolean =>
  a.length === b.length && a.every((level, i) => level === b[i]);

/** Pairs each Core row with the pick (and its node) made for it, plus the leftover picks. */
function pairRows(
  rowLevels: readonly TrailLevel[],
  picked: readonly PickedNode[],
  candidates: readonly CodeTrail[],
): {
  readonly paired: readonly { readonly synthetic: boolean; readonly item?: PickedNode }[];
  readonly extras: readonly PickedNode[];
} {
  const withoutPart = picked.filter((p) => p.pick.level !== "part");

  // Positional pairing with no synthetic row.
  const exact = candidates.find((t) => sameLevels(levelsOf(t), rowLevels));
  if (exact !== undefined) {
    const list = levelsOf(exact).includes("part") ? picked : withoutPart;
    return {
      paired: rowLevels.map((_, i) => ({ synthetic: false, item: list[i] })),
      extras: list.slice(rowLevels.length),
    };
  }

  // One inserted synthetic part row.
  for (const trail of candidates) {
    const levels = levelsOf(trail);
    if (levels.includes("part")) continue;
    if (rowLevels.length !== levels.length + 1) continue;
    const at = rowLevels.findIndex((level, i) => level === "part" && sameLevels(
      [...rowLevels.slice(0, i), ...rowLevels.slice(i + 1)],
      levels,
    ));
    if (at < 0) continue;
    const misfire = picked.find((p) => p.pick.level === "part");
    let next = 0;
    const paired = rowLevels.map((_, i) => {
      if (i === at) return { synthetic: true, item: misfire };
      return { synthetic: false, item: withoutPart[next++] };
    });
    return { paired, extras: withoutPart.slice(levels.length) };
  }

  // Fallback: positional.
  return {
    paired: rowLevels.map((_, i) => ({ synthetic: false, item: picked[i] })),
    extras: picked.slice(rowLevels.length),
  };
}

export function gradeAttempt(
  drill: DrillRecord,
  method: MethodId,
  path: readonly OptionNode[],
  names: CheckedNamesIndex,
  outcome: { readonly timeUp: boolean; readonly elapsedSeconds: number },
  deps: GradeDeps = defaultDeps,
): ResultModel {
  const keywordPick = keywordOf(path);
  const selection = selectGradingInput(drill, method, keywordPick);
  const picks = buildGradePicks(path);
  const grade: GradeResult = deps.gradeTrail(selection.drillDef, picks);

  const show = (node: OptionNode): string => resolveDisplay(node, names).text;

  const rows: ResultRow[] = [];
  const keywordNode = path[0];
  const keywordRow: ResultRow = {
    kind: "keyword",
    verdict:
      keywordNode === undefined ? "unanswered" : selection.keywordCorrect ? "correct" : "incorrect",
  };
  if (keywordNode !== undefined) keywordRow.pickText = show(keywordNode);
  rows.push(keywordRow);

  const picked: PickedNode[] = picks.map((pick, i) => ({
    pick,
    node: path[i + 1] as OptionNode,
  }));
  const candidates: CodeTrail[] = [...selection.drillDef.trails];
  if (selection.drillDef.movedFrom !== undefined) candidates.push(selection.drillDef.movedFrom);

  const { paired, extras } = pairRows(
    grade.stepResults.map((r) => r.level),
    picked,
    candidates,
  );

  grade.stepResults.forEach((result, i) => {
    const entry = paired[i];
    const row: ResultRow = {
      kind: "step",
      level: result.level,
      verdict: result.verdict,
      synthetic: entry?.synthetic ?? false,
    };
    if (entry?.item !== undefined) row.pickText = show(entry.item.node);
    const fork =
      result.level === "chapter"
        ? drill.chapterForkSentence
        : result.level === "article"
          ? drill.articleForkSentence
          : undefined;
    if (fork !== undefined) row.forkSentence = fork;
    rows.push(row);
  });

  for (const extra of extras) {
    rows.push({
      kind: "extra",
      level: extra.pick.level,
      pickText: show(extra.node),
      verdict: "incorrect",
    });
  }

  if (drill.tableWalk !== undefined) {
    rows.push({ kind: "row-line", tableWalk: drill.tableWalk });
  }

  const overall: "correct" | "incorrect" =
    selection.keywordCorrect && grade.matched && !grade.matchedMovedFrom ? "correct" : "incorrect";

  const model: ResultModel = {
    overall,
    rows,
    matched: grade.matched,
    matchedMovedFrom: grade.matchedMovedFrom,
    verdictsAgainst: grade.matchedMovedFrom ? "2023" : "2026",
    timeUp: outcome.timeUp,
    elapsedSeconds: outcome.elapsedSeconds,
    answer: drill.answer,
    citation: drill.citation,
    hint: drill.def.hint,
  };
  if (grade.matchedMovedFrom && drill.def.editionNote !== undefined) {
    return { ...model, editionNote: drill.def.editionNote };
  }
  return model;
}
