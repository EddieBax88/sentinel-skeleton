import { gradeTrail } from "@sentinel/skeleton-core";
import { availableMethods, defaultMethod } from "../model/methods";
import type { DrillRecord, MethodId, OptionNode, TableWalk } from "../model/types";
import { resolveDisplay } from "./displayName";
import type { CheckedNamesIndex } from "./displayName";
import { selectGradingInput } from "./grading";
import type { GradeDeps } from "./grading";
import { buildGradePicks } from "./pickBuilder";
import { canCheck, optionsAt, resolvePath, stepLabelAt, treeFor, viewFlow } from "./stepEngine";
import type { FlowView, StepLabel } from "./stepEngine";

/** Result of judging one pick. `offered: false` means the value is not an Option at that click. */
export type PickJudgement =
  | { readonly offered: false }
  | {
      readonly offered: true;
      readonly verdict: "correct" | "incorrect";
      readonly node: OptionNode;
    };

const defaultDeps: GradeDeps = { gradeTrail };

/** Same comparison the Core grader uses for values. */
const norm = (s: string): string => s.trim().toLowerCase();

/**
 * Judges one pick at click position `depth`, given the already accepted picks.
 * Depth 0 uses the keyword verdict of the grading selection. Deeper picks make one
 * Core grading call and are correct only when the first N step results are all correct.
 */
export function judgePick(
  drill: DrillRecord,
  method: MethodId,
  acceptedPicks: readonly string[],
  depth: number,
  value: string,
  deps: GradeDeps = defaultDeps,
): PickJudgement {
  const tree = treeFor(drill, method);
  const options = optionsAt(tree, acceptedPicks, depth);
  if (options === undefined) return { offered: false };
  const wanted = norm(value);
  const node = options.find((o) => norm(o.value) === wanted);
  if (node === undefined) return { offered: false };

  if (depth === 0) {
    const selection = selectGradingInput(drill, method, node.value);
    return { offered: true, verdict: selection.keywordCorrect ? "correct" : "incorrect", node };
  }

  const accepted = resolvePath(tree, acceptedPicks);
  const keyword = accepted?.[0];
  if (accepted === undefined || keyword === undefined) return { offered: false };

  const selection = selectGradingInput(drill, method, keyword.value);
  const input = { trails: selection.drillDef.trails };
  const picks = buildGradePicks([...accepted, node]);
  const grade = deps.gradeTrail(input, picks);
  const n = picks.length;
  const results = grade.stepResults;
  const correct = results.length >= n && results.slice(0, n).every((r) => r.verdict === "correct");
  return { offered: true, verdict: correct ? "correct" : "incorrect", node };
}

export type GuidedFeedback =
  | {
      readonly kind: "correct";
      readonly depth: number;
      readonly value: string;
      readonly why?: string;
    }
  | { readonly kind: "incorrect"; readonly depth: number; readonly value: string };

export type GuidedState =
  | { phase: "idle" }
  | {
      phase: "guiding";
      drill: DrillRecord;
      method: MethodId;
      picks: readonly string[];
      feedback?: GuidedFeedback;
    }
  | { phase: "finished"; drill: DrillRecord; method: MethodId; picks: readonly string[] };

export type GuidedEvent =
  | { type: "START"; drill: DrillRecord }
  | { type: "PICK"; depth: number; value: string }
  | { type: "SELECT_METHOD"; method: MethodId }
  | { type: "FINISH" }
  | { type: "LEAVE" };

export function createGuidedReducer(
  deps?: GradeDeps,
): (state: GuidedState, event: GuidedEvent) => GuidedState {
  return (state, event) => {
    switch (event.type) {
      case "START":
        return {
          phase: "guiding",
          drill: event.drill,
          method: defaultMethod(event.drill),
          picks: [],
        };

      case "PICK": {
        if (state.phase !== "guiding") return state;
        const tree = treeFor(state.drill, state.method);
        if (event.depth !== state.picks.length) return state;
        if (canCheck(tree, state.picks)) return state;
        const judged = judgePick(
          state.drill,
          state.method,
          state.picks,
          event.depth,
          event.value,
          deps,
        );
        if (!judged.offered) return state;
        const { node } = judged;
        if (judged.verdict === "incorrect") {
          return {
            phase: "guiding",
            drill: state.drill,
            method: state.method,
            picks: state.picks,
            feedback: { kind: "incorrect", depth: event.depth, value: node.value },
          };
        }
        return {
          phase: "guiding",
          drill: state.drill,
          method: state.method,
          picks: [...state.picks, node.value],
          feedback: {
            kind: "correct",
            depth: event.depth,
            value: node.value,
            ...(node.why !== undefined && node.why !== "" ? { why: node.why } : {}),
          },
        };
      }

      case "SELECT_METHOD": {
        if (state.phase !== "guiding") return state;
        if (!availableMethods(state.drill).includes(event.method)) return state;
        if (event.method === state.method) return state;
        return {
          phase: "guiding",
          drill: state.drill,
          method: event.method,
          picks: [],
        };
      }

      case "FINISH": {
        if (state.phase !== "guiding") return state;
        if (!canCheck(treeFor(state.drill, state.method), state.picks)) return state;
        return {
          phase: "finished",
          drill: state.drill,
          method: state.method,
          picks: state.picks,
        };
      }

      case "LEAVE":
        return state.phase === "idle" ? state : { phase: "idle" };

      default:
        return state;
    }
  };
}

export type GuidedView = {
  /** Answered clicks plus one open click unless the path ended. */
  readonly flow: FlowView;
  /** whys[i] is the why of the node picked at click i, undefined when absent. */
  readonly whys: readonly (string | undefined)[];
  /** The wrong pick at the open click, when the feedback is incorrect. */
  readonly triedValue?: string;
  readonly feedback?: GuidedFeedback;
  readonly pathEnded: boolean;
};

export function viewGuided(
  state: Extract<GuidedState, { phase: "guiding" }>,
  names: CheckedNamesIndex,
): GuidedView {
  const tree = treeFor(state.drill, state.method);
  const flow = viewFlow(tree, state.picks, names);
  const path = resolvePath(tree, state.picks) ?? [];
  const whys = path.map((node) => node.why);
  const feedback = state.feedback;
  const view: GuidedView = {
    flow,
    whys,
    pathEnded: canCheck(tree, state.picks),
    ...(feedback !== undefined ? { feedback } : {}),
    ...(feedback !== undefined &&
    feedback.kind === "incorrect" &&
    feedback.depth === state.picks.length
      ? { triedValue: feedback.value }
      : {}),
  };
  return view;
}

export type PathRow =
  | { readonly kind: "keyword"; readonly pickText: string; readonly why?: string }
  | {
      readonly kind: "step";
      readonly label: StepLabel;
      readonly level: string;
      readonly pickText: string;
      readonly why?: string;
    }
  | { readonly kind: "row-line"; readonly tableWalk: TableWalk };

const whyProp = (node: OptionNode): { why?: string } =>
  node.why !== undefined && node.why !== "" ? { why: node.why } : {};

/**
 * Keyword row, one row per accepted pick in click order, then the Row line when the drill has a
 * table walk. The why of each row is copied from the resolved node only when the node has one.
 */
export function guidedPathRows(
  drill: DrillRecord,
  method: MethodId,
  picks: readonly string[],
  names: CheckedNamesIndex,
): readonly PathRow[] {
  const path = resolvePath(treeFor(drill, method), picks) ?? [];
  const rows: PathRow[] = [];
  path.forEach((node, i) => {
    const pickText = resolveDisplay(node, names).text;
    if (i === 0) {
      rows.push({ kind: "keyword", pickText, ...whyProp(node) });
    } else {
      rows.push({
        kind: "step",
        label: stepLabelAt(path, i),
        level: node.level,
        pickText,
        ...whyProp(node),
      });
    }
  });
  if (drill.tableWalk !== undefined) {
    rows.push({ kind: "row-line", tableWalk: drill.tableWalk });
  }
  return rows;
}
