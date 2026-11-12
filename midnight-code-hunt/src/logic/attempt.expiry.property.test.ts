import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arbDrill } from "../../test/support/arbitraries";
import type { DrillRecord } from "../model/types";
import { createAttemptReducer } from "./attempt";
import type { AttemptEvent, AttemptState } from "./attempt";
import { buildNamesIndex } from "./displayName";
import { optionsAt, treeFor } from "./stepEngine";

// Feature: midnight-code-hunt, Property 28: Expiry freezes the attempt
// **Validates: Requirements 7.5, 7.6, 10.5, 10.8**

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});
const reduce = createAttemptReducer(names);

const arbRun = fc.record({
  drill: arbDrill,
  startedAtMs: fc.integer({ min: 0, max: 1_000_000 }),
  picksTaken: fc.array(fc.nat(50), { maxLength: 8 }),
  overshootMs: fc.integer({ min: 0, max: 500_000 }),
  viaCheck: fc.boolean(),
});

function runUntilExpiry(c: {
  drill: DrillRecord;
  startedAtMs: number;
  picksTaken: readonly number[];
  overshootMs: number;
  viaCheck: boolean;
}): { running: Extract<AttemptState, { phase: "running" }>; expired: AttemptState } {
  let state = reduce({ phase: "picker" }, { type: "START", drill: c.drill, nowMs: c.startedAtMs });
  for (const n of c.picksTaken) {
    if (state.phase !== "running") break;
    const options = optionsAt(treeFor(state.drill, state.method), state.picks, state.picks.length);
    if (options === undefined || options.length === 0) break;
    const node = options[n % options.length]!;
    state = reduce(state, { type: "PICK", depth: state.picks.length, value: node.value });
  }
  if (state.phase !== "running") throw new Error("expected running");
  const at = c.startedAtMs + 120_000 + c.overshootMs;
  const event: AttemptEvent = c.viaCheck ? { type: "CHECK", nowMs: at } : { type: "TICK", nowMs: at };
  return { running: state, expired: reduce(state, event) };
}

describe("Property 28: Expiry freezes the attempt", () => {
  it("expires with elapsed 120, unchanged picks, timeUp, and unanswered steps graded unanswered", () => {
    fc.assert(
      fc.property(arbRun, (run) => {
        const { running, expired } = runUntilExpiry(run);
        expect(expired.phase).toBe("expired");
        if (expired.phase !== "expired") return;
        expect(expired.elapsedSeconds).toBe(120);
        expect(expired.picks).toEqual(running.picks);
        expect(expired.drill).toBe(running.drill);
        expect(expired.method).toBe(running.method);
        expect(expired.result.timeUp).toBe(true);
        expect(expired.result.elapsedSeconds).toBe(120);
        for (const row of expired.result.rows) {
          if ((row.kind === "keyword" || row.kind === "step") && row.pickText === undefined) {
            expect(row.verdict).toBe("unanswered");
          }
        }
        if (running.picks.length === 0) {
          for (const row of expired.result.rows) {
            if (row.kind === "keyword" || row.kind === "step") {
              expect(row.verdict).toBe("unanswered");
            }
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it("ignores later PICK, SELECT_METHOD, CHECK, and TICK once expired", () => {
    fc.assert(
      fc.property(
        arbRun,
        fc.string({ maxLength: 10 }),
        fc.nat(5),
        fc.integer({ min: 0, max: 2_000_000 }),
        (run, value, depth, laterMs) => {
          const { expired } = runUntilExpiry(run);
          const events: AttemptEvent[] = [
            { type: "PICK", depth, value },
            { type: "SELECT_METHOD", method: "index" },
            { type: "SELECT_METHOD", method: "toc" },
            { type: "CHECK", nowMs: run.startedAtMs + laterMs },
            { type: "TICK", nowMs: run.startedAtMs + laterMs },
          ];
          for (const event of events) {
            expect(reduce(expired, event)).toBe(expired);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
