import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arbDrill } from "../../test/support/arbitraries";
import { availableMethods } from "../model/methods";
import type { DrillRecord, MethodId } from "../model/types";
import { createAttemptReducer } from "./attempt";
import type { AttemptEvent, AttemptState } from "./attempt";
import { buildNamesIndex } from "./displayName";
import { optionsAt, treeFor } from "./stepEngine";

// Feature: midnight-code-hunt, Property 27: Method switch keeps the timer and clears picks
// **Validates: Requirements 6.6, 6.7**

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});
const reduce = createAttemptReducer(names);

/** One step of a random run: pick the n-th offered option at the next depth, or switch method. */
const arbOp = fc.oneof(
  fc.record({ kind: fc.constant("pick" as const), n: fc.nat(50) }),
  fc.record({ kind: fc.constant("switch" as const), useIndex: fc.boolean() }),
);

const arbRun = fc.record({
  drill: arbDrill,
  startedAtMs: fc.integer({ min: 0, max: 1_000_000 }),
  ops: fc.array(arbOp, { maxLength: 12 }),
});

const arbTarget = fc.constantFrom<MethodId>("index", "toc");

function runningState(c: {
  drill: DrillRecord;
  startedAtMs: number;
  ops: ReadonlyArray<{ kind: "pick"; n: number } | { kind: "switch"; useIndex: boolean }>;
}): AttemptState {
  let state = reduce({ phase: "picker" }, { type: "START", drill: c.drill, nowMs: c.startedAtMs });
  for (const op of c.ops) {
    if (state.phase !== "running") break;
    let event: AttemptEvent;
    if (op.kind === "pick") {
      const options = optionsAt(treeFor(state.drill, state.method), state.picks, state.picks.length);
      if (options === undefined || options.length === 0) continue;
      const node = options[op.n % options.length]!;
      event = { type: "PICK", depth: state.picks.length, value: node.value };
    } else {
      event = { type: "SELECT_METHOD", method: op.useIndex ? "index" : "toc" };
    }
    state = reduce(state, event);
  }
  return state;
}

describe("Property 27: Method switch keeps the timer and clears picks", () => {
  it("a different offered method clears picks and keeps startedAtMs and remaining", () => {
    fc.assert(
      fc.property(arbRun, arbTarget, (run, target) => {
        const before = runningState(run);
        expect(before.phase).toBe("running");
        if (before.phase !== "running") return;
        if (target === before.method || !availableMethods(before.drill).includes(target)) return;
        const after = reduce(before, { type: "SELECT_METHOD", method: target });
        expect(after).toEqual({ ...before, method: target, picks: [] });
        if (after.phase !== "running") return;
        expect(after.startedAtMs).toBe(before.startedAtMs);
        expect(after.remaining).toBe(before.remaining);
      }),
      { numRuns: 200 },
    );
  });

  it("selecting the current method leaves the state unchanged", () => {
    fc.assert(
      fc.property(arbRun, (run) => {
        const before = runningState(run);
        if (before.phase !== "running") throw new Error("expected running");
        const after = reduce(before, { type: "SELECT_METHOD", method: before.method });
        expect(after).toBe(before);
      }),
      { numRuns: 200 },
    );
  });

  it("selecting a method that is not offered leaves the state unchanged", () => {
    fc.assert(
      fc.property(arbRun, arbTarget, (run, target) => {
        const before = runningState(run);
        if (before.phase !== "running") throw new Error("expected running");
        if (availableMethods(before.drill).includes(target)) return;
        const after = reduce(before, { type: "SELECT_METHOD", method: target });
        expect(after).toBe(before);
      }),
      { numRuns: 200 },
    );
  });
});
