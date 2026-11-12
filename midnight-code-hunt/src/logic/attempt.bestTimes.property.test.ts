import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arbDrill } from "../../test/support/arbitraries";
import type { DrillRecord, MethodId } from "../model/types";
import { bestTimeToSubmit, createAttemptReducer } from "./attempt";
import type { AttemptEvent, AttemptState } from "./attempt";
import { createBestTimesStore } from "./bestTimes";
import { buildNamesIndex } from "./displayName";
import { optionsAt, treeFor } from "./stepEngine";

// Feature: midnight-code-hunt, Property 14: Best times change only for correct, checked attempts
// **Validates: Requirements 7.7, 7.8, 11.14, 12.5**

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});
const reduce = createAttemptReducer(names);
const METHODS: readonly MethodId[] = ["index", "toc"];

type Op =
  | { kind: "pick"; n: number; preferCorrect: boolean }
  | { kind: "switch"; useIndex: boolean }
  | { kind: "tick"; dtMs: number }
  | { kind: "check"; dtMs: number }
  | { kind: "restart"; dtMs: number }
  | { kind: "leave" }
  | { kind: "start"; dtMs: number };

const arbOp: fc.Arbitrary<Op> = fc.oneof(
  { weight: 6, arbitrary: fc.record({ kind: fc.constant("pick" as const), n: fc.nat(50), preferCorrect: fc.boolean() }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant("switch" as const), useIndex: fc.boolean() }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant("tick" as const), dtMs: fc.integer({ min: 0, max: 60_000 }) }) },
  // Large deltas let some checks land after the 120 s limit (expiry).
  { weight: 3, arbitrary: fc.record({ kind: fc.constant("check" as const), dtMs: fc.integer({ min: 0, max: 150_000 }) }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant("restart" as const), dtMs: fc.integer({ min: 0, max: 5_000 }) }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant("leave" as const) }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant("start" as const), dtMs: fc.integer({ min: 0, max: 5_000 }) }) },
);

const arbRun = fc.record({
  drill: arbDrill,
  startMs: fc.integer({ min: 0, max: 1_000_000 }),
  ops: fc.array(arbOp, { maxLength: 40 }),
});

/** Every drill-and-method best currently held by the store. */
function snapshot(store: ReturnType<typeof createBestTimesStore>, drill: DrillRecord) {
  return METHODS.map((m) => store.get(drill.def.id, m));
}

function toEvent(op: Op, state: AttemptState, drill: DrillRecord, nowMs: number): AttemptEvent {
  switch (op.kind) {
    case "pick": {
      if (state.phase !== "running") return { type: "PICK", depth: 0, value: "" };
      const options = optionsAt(treeFor(state.drill, state.method), state.picks, state.picks.length) ?? [];
      const pool = op.preferCorrect ? options.filter((o) => o.role === "correct") : options;
      const usable = pool.length > 0 ? pool : options;
      if (usable.length === 0) return { type: "PICK", depth: state.picks.length, value: "" };
      return { type: "PICK", depth: state.picks.length, value: usable[op.n % usable.length]!.value };
    }
    case "switch":
      return { type: "SELECT_METHOD", method: op.useIndex ? "index" : "toc" };
    case "tick":
      return { type: "TICK", nowMs };
    case "check":
      return { type: "CHECK", nowMs };
    case "restart":
      return { type: "RESTART", nowMs };
    case "leave":
      return { type: "LEAVE" };
    case "start":
      return { type: "START", drill, nowMs };
  }
}

describe("Property 14: Best times change only for correct, checked attempts", () => {
  it("the store changes only on a checked attempt with a correct result", () => {
    fc.assert(
      fc.property(arbRun, (run) => {
        const store = createBestTimesStore(undefined);
        let nowMs = run.startMs;
        let state: AttemptState = reduce({ phase: "picker" }, { type: "START", drill: run.drill, nowMs });

        for (const op of run.ops) {
          if ("dtMs" in op) nowMs += op.dtMs;
          const prev = state;
          state = reduce(state, toEvent(op, state, run.drill, nowMs));

          const submission = bestTimeToSubmit(state);
          // Only a checked, correct state may yield a submission.
          if (submission !== null) {
            expect(state.phase).toBe("checked");
            if (state.phase === "checked") expect(state.result.overall).toBe("correct");
            expect(submission.drillId).toBe(run.drill.def.id);
          }
          if (state.phase !== "checked") expect(submission).toBeNull();

          const before = snapshot(store, run.drill);
          // The screen submits once, when an attempt first becomes checked.
          if (submission !== null && prev.phase !== "checked") {
            const { drillId, method, elapsedSeconds } = submission;
            const prior = store.get(drillId, method);
            store.submit(drillId, method, elapsedSeconds);
            const after = store.get(drillId, method);
            expect(after).toBe(prior === undefined ? elapsedSeconds : Math.min(prior, elapsedSeconds));
          } else {
            // Expiry, LEAVE, incorrect checks, and every other event: no write.
            expect(snapshot(store, run.drill)).toEqual(before);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it("expired, picker, and running states never submit", () => {
    fc.assert(
      fc.property(arbDrill, fc.integer({ min: 0, max: 1_000_000 }), fc.integer({ min: 120_000, max: 500_000 }), (drill, start, late) => {
        const running = reduce({ phase: "picker" }, { type: "START", drill, nowMs: start });
        expect(bestTimeToSubmit({ phase: "picker" })).toBeNull();
        expect(bestTimeToSubmit(running)).toBeNull();
        const expired = reduce(running, { type: "CHECK", nowMs: start + late });
        expect(expired.phase).toBe("expired");
        expect(bestTimeToSubmit(expired)).toBeNull();
        expect(bestTimeToSubmit(reduce(expired, { type: "LEAVE" }))).toBeNull();
      }),
      { numRuns: 200 },
    );
  });
});
