import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arbDrill } from "../../test/support/arbitraries";
import { availableMethods } from "../model/methods";
import type { DrillRecord, MethodId } from "../model/types";
import { createGuidedReducer } from "./guided";
import type { GuidedEvent, GuidedState } from "./guided";
import { optionsAt, treeFor } from "./stepEngine";

// Feature: midnight-code-hunt, Property 35: Guided Method choice follows the same rule as Timed, without a timer
// **Validates: Requirements 19.10, 19.1**

const reduce = createGuidedReducer();

/** One step of a random run: pick the n-th offered option at the open click, or switch method. */
const arbOp = fc.oneof(
  fc.record({ kind: fc.constant("pick" as const), n: fc.nat(50) }),
  fc.record({ kind: fc.constant("switch" as const), useIndex: fc.boolean() }),
);

const arbRun = fc.record({
  drill: arbDrill,
  ops: fc.array(arbOp, { maxLength: 12 }),
});

const arbTarget = fc.constantFrom<MethodId>("index", "toc");

function guidingState(c: {
  drill: DrillRecord;
  ops: ReadonlyArray<{ kind: "pick"; n: number } | { kind: "switch"; useIndex: boolean }>;
}): GuidedState {
  let state = reduce({ phase: "idle" }, { type: "START", drill: c.drill });
  for (const op of c.ops) {
    if (state.phase !== "guiding") break;
    let event: GuidedEvent;
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

describe("Property 35: Guided Method choice follows the same rule as Timed, without a timer", () => {
  it("a different offered method clears picks and feedback", () => {
    fc.assert(
      fc.property(arbRun, arbTarget, (run, target) => {
        const before = guidingState(run);
        expect(before.phase).toBe("guiding");
        if (before.phase !== "guiding") return;
        if (target === before.method || !availableMethods(before.drill).includes(target)) return;
        const after = reduce(before, { type: "SELECT_METHOD", method: target });
        expect(after).toEqual({
          phase: "guiding",
          drill: before.drill,
          method: target,
          picks: [],
        });
        expect(after).not.toHaveProperty("feedback");
      }),
      { numRuns: 200 },
    );
  });

  it("selecting the current method leaves the state unchanged", () => {
    fc.assert(
      fc.property(arbRun, (run) => {
        const before = guidingState(run);
        if (before.phase !== "guiding") throw new Error("expected guiding");
        const after = reduce(before, { type: "SELECT_METHOD", method: before.method });
        expect(after).toBe(before);
      }),
      { numRuns: 200 },
    );
  });

  it("selecting a method that is not offered leaves the state unchanged", () => {
    fc.assert(
      fc.property(arbRun, arbTarget, (run, target) => {
        const before = guidingState(run);
        if (before.phase !== "guiding") throw new Error("expected guiding");
        if (availableMethods(before.drill).includes(target)) return;
        const after = reduce(before, { type: "SELECT_METHOD", method: target });
        expect(after).toBe(before);
      }),
      { numRuns: 200 },
    );
  });

  it("the guiding state holds no time field", () => {
    fc.assert(
      fc.property(arbRun, arbTarget, (run, target) => {
        const before = guidingState(run);
        const after = reduce(before, { type: "SELECT_METHOD", method: target });
        for (const s of [before, after]) {
          for (const key of ["startedAtMs", "remaining", "elapsedMs", "deadlineMs", "timer"]) {
            expect(s).not.toHaveProperty(key);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});
