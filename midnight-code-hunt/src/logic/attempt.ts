import { availableMethods, defaultMethod } from "../model/methods";
import type { DrillRecord, MethodId, OptionNode } from "../model/types";
import { gradeAttempt } from "./grading";
import type { GradeDeps, ResultModel } from "./grading";
import type { CheckedNamesIndex } from "./displayName";
import { applyPick, canCheck, resolvePath, treeFor } from "./stepEngine";
import { TIME_LIMIT_SECONDS, elapsedSeconds, remainingSeconds } from "./timer";

export type AttemptState =
  | { phase: "picker" }
  | {
      phase: "running";
      drill: DrillRecord;
      method: MethodId;
      picks: readonly string[];
      startedAtMs: number;
      remaining: number;
    }
  | {
      phase: "checked";
      drill: DrillRecord;
      method: MethodId;
      picks: readonly string[];
      elapsedSeconds: number;
      result: ResultModel;
    }
  | {
      phase: "expired";
      drill: DrillRecord;
      method: MethodId;
      picks: readonly string[];
      elapsedSeconds: 120;
      result: ResultModel;
    };

export type AttemptEvent =
  | { type: "START"; drill: DrillRecord; nowMs: number }
  | { type: "PICK"; depth: number; value: string }
  | { type: "SELECT_METHOD"; method: MethodId }
  | { type: "TICK"; nowMs: number }
  | { type: "CHECK"; nowMs: number }
  | { type: "RESTART"; nowMs: number }
  | { type: "LEAVE" };

type RunningState = Extract<AttemptState, { phase: "running" }>;

/** Resolves picks to nodes; picks that do not resolve yield an empty path. */
function pathOf(drill: DrillRecord, method: MethodId, picks: readonly string[]): OptionNode[] {
  const path = resolvePath(treeFor(drill, method), picks);
  return path === undefined ? [] : [...path];
}

function begin(drill: DrillRecord, method: MethodId, nowMs: number): RunningState {
  return {
    phase: "running",
    drill,
    method,
    picks: [],
    startedAtMs: nowMs,
    remaining: TIME_LIMIT_SECONDS,
  };
}

export function createAttemptReducer(
  names: CheckedNamesIndex,
  deps?: GradeDeps,
): (state: AttemptState, event: AttemptEvent) => AttemptState {
  const grade = (
    state: RunningState,
    outcome: { timeUp: boolean; elapsedSeconds: number },
  ): ResultModel =>
    gradeAttempt(
      state.drill,
      state.method,
      pathOf(state.drill, state.method, state.picks),
      names,
      outcome,
      deps,
    );

  const expire = (state: RunningState): AttemptState => ({
    phase: "expired",
    drill: state.drill,
    method: state.method,
    picks: state.picks,
    elapsedSeconds: TIME_LIMIT_SECONDS,
    result: grade(state, { timeUp: true, elapsedSeconds: TIME_LIMIT_SECONDS }),
  });

  return (state, event) => {
    switch (event.type) {
      case "START":
        if (state.phase !== "picker") return state;
        return begin(event.drill, defaultMethod(event.drill), event.nowMs);

      case "RESTART":
        if (state.phase !== "checked" && state.phase !== "expired") return state;
        return begin(state.drill, state.method, event.nowMs);

      case "LEAVE":
        return state.phase === "picker" ? state : { phase: "picker" };

      case "PICK": {
        if (state.phase !== "running") return state;
        const picks = applyPick(
          treeFor(state.drill, state.method),
          state.picks,
          event.depth,
          event.value,
        );
        return picks === state.picks ? state : { ...state, picks };
      }

      case "SELECT_METHOD": {
        if (state.phase !== "running") return state;
        if (event.method === state.method) return state;
        if (!availableMethods(state.drill).includes(event.method)) return state;
        return { ...state, method: event.method, picks: [] };
      }

      case "TICK": {
        if (state.phase !== "running") return state;
        const remaining = remainingSeconds(state.startedAtMs, event.nowMs);
        if (remaining === 0) return expire(state);
        return remaining === state.remaining ? state : { ...state, remaining };
      }

      case "CHECK": {
        if (state.phase !== "running") return state;
        const remaining = remainingSeconds(state.startedAtMs, event.nowMs);
        if (remaining === 0) return expire(state);
        if (!canCheck(treeFor(state.drill, state.method), state.picks)) return state;
        const elapsed = elapsedSeconds(remaining);
        return {
          phase: "checked",
          drill: state.drill,
          method: state.method,
          picks: state.picks,
          elapsedSeconds: elapsed,
          result: grade(state, { timeUp: false, elapsedSeconds: elapsed }),
        };
      }

      default:
        return state;
    }
  };
}

/**
 * The best-time submission for a state: only a checked attempt with a correct
 * overall result qualifies. Expired, running, picker, and incorrect give null.
 */
export function bestTimeToSubmit(
  state: AttemptState,
): { drillId: string; method: MethodId; elapsedSeconds: number } | null {
  if (state.phase !== "checked" || state.result.overall !== "correct") return null;
  return {
    drillId: state.drill.def.id,
    method: state.method,
    elapsedSeconds: state.elapsedSeconds,
  };
}
