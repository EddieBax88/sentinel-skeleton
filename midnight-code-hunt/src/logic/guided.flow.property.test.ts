import { gradeTrail } from "@sentinel/skeleton-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arbDrill } from "../../test/support/arbitraries";
import type { DrillRecord, OptionNode } from "../model/types";
import { createGuidedReducer, judgePick } from "./guided";
import type { GuidedState } from "./guided";
import { selectGradingInput } from "./grading";
import { buildGradePicks } from "./pickBuilder";
import { canCheck, optionsAt, resolvePath, treeFor } from "./stepEngine";

type Guiding = Extract<GuidedState, { phase: "guiding" }>;

const reduce = createGuidedReducer();

const idle: GuidedState = { phase: "idle" };

/** Starts the drill and accepts up to `seeds.length` correct picks chosen by the seeds. */
function walk(drill: DrillRecord, seeds: readonly number[]): Guiding {
  let state = reduce(idle, { type: "START", drill }) as Guiding;
  for (const seed of seeds) {
    const tree = treeFor(state.drill, state.method);
    if (canCheck(tree, state.picks)) break;
    const depth = state.picks.length;
    const options = optionsAt(tree, state.picks, depth) ?? [];
    const good = options.filter(
      (o) => judgePick(state.drill, state.method, state.picks, depth, o.value).offered &&
        (judgePick(state.drill, state.method, state.picks, depth, o.value) as { verdict: string })
          .verdict === "correct",
    );
    if (good.length === 0) break;
    state = reduce(state, {
      type: "PICK",
      depth,
      value: (good[seed % good.length] as OptionNode).value,
    }) as Guiding;
  }
  return state;
}

function openOptions(state: Guiding, verdict: "correct" | "incorrect"): OptionNode[] {
  const tree = treeFor(state.drill, state.method);
  const depth = state.picks.length;
  const options = optionsAt(tree, state.picks, depth) ?? [];
  return options.filter((o) => {
    const j = judgePick(state.drill, state.method, state.picks, depth, o.value);
    return j.offered && j.verdict === verdict;
  });
}

const arbSeeds = fc.array(fc.nat({ max: 20 }), { maxLength: 8 });

describe("Guided reducer flow properties", () => {
  // Feature: midnight-code-hunt, Property 32: A wrong pick changes nothing that was accepted
  // **Validates: Requirements 19.7**
  it("Property 32: a wrong pick changes nothing that was accepted", () => {
    fc.assert(
      fc.property(arbDrill, arbSeeds, fc.nat({ max: 20 }), (drill, seeds, which) => {
        const state = walk(drill, seeds);
        fc.pre(!canCheck(treeFor(state.drill, state.method), state.picks));
        const wrong = openOptions(state, "incorrect");
        fc.pre(wrong.length > 0);
        const option = wrong[which % wrong.length] as OptionNode;
        const depth = state.picks.length;
        const event = { type: "PICK", depth, value: option.value } as const;

        const first = reduce(state, event) as Guiding;
        expect(first.phase).toBe("guiding");
        expect(first.picks).toEqual(state.picks);
        expect(first.method).toBe(state.method);
        expect(first.feedback).toEqual({ kind: "incorrect", depth, value: option.value });
        expect(first.feedback).not.toHaveProperty("why");
        expect(first.picks.length).toBe(depth);

        const second = reduce(first, event);
        expect(second).toEqual(first);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: midnight-code-hunt, Property 33: A correct pick appends one pick and opens the next click
  // **Validates: Requirements 19.6, 19.9, 20.3, 20.6**
  it("Property 33: a correct pick appends one pick and opens the next click", () => {
    fc.assert(
      fc.property(arbDrill, arbSeeds, fc.nat({ max: 20 }), (drill, seeds, which) => {
        const state = walk(drill, seeds);
        const tree = treeFor(state.drill, state.method);
        fc.pre(!canCheck(tree, state.picks));
        const good = openOptions(state, "correct");
        fc.pre(good.length > 0);
        const option = good[which % good.length] as OptionNode;
        const depth = state.picks.length;

        const after = reduce(state, { type: "PICK", depth, value: option.value }) as Guiding;
        expect(after.phase).toBe("guiding");
        expect(after.method).toBe(state.method);
        expect(after.picks).toEqual([...state.picks, option.value]);
        expect(after.feedback?.kind).toBe("correct");
        expect(after.feedback?.depth).toBe(depth);
        expect(after.feedback?.value).toBe(option.value);
        if (option.why !== undefined && option.why !== "") {
          expect((after.feedback as { why?: string }).why).toBe(option.why);
        } else {
          expect(after.feedback).not.toHaveProperty("why");
        }
        expect(canCheck(tree, after.picks)).toBe(option.next === undefined);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: midnight-code-hunt, Property 33: A correct pick appends one pick and opens the next click
  // **Validates: Requirements 19.6, 19.9, 20.3, 20.6**
  it("Property 33: feeding a declared valid trail ends the path with a Core match", () => {
    fc.assert(
      fc.property(arbDrill, (drill) => {
        let state = reduce(idle, { type: "START", drill }) as Guiding;
        const tree = treeFor(drill, state.method);
        for (let guard = 0; guard < 20 && !canCheck(tree, state.picks); guard++) {
          const depth = state.picks.length;
          const options = optionsAt(tree, state.picks, depth) ?? [];
          const next = options.find((o) => o.role === "correct");
          expect(next).toBeDefined();
          state = reduce(state, {
            type: "PICK",
            depth,
            value: (next as OptionNode).value,
          }) as Guiding;
          expect(state.feedback?.kind).toBe("correct");
        }
        expect(canCheck(tree, state.picks)).toBe(true);

        const path = resolvePath(tree, state.picks) as readonly OptionNode[];
        const selection = selectGradingInput(drill, state.method, path[0]?.value);
        const grade = gradeTrail(selection.drillDef, buildGradePicks(path));
        expect(grade.matched).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: midnight-code-hunt, Property 34: Accepted picks are final and finished screens are frozen
  // **Validates: Requirements 19.8, 19.9**
  it("Property 34: picks at another depth, picks after the end, and early FINISH change nothing", () => {
    fc.assert(
      fc.property(arbDrill, arbSeeds, fc.integer({ min: -3, max: 12 }), (drill, seeds, depth) => {
        const state = walk(drill, seeds);
        const tree = treeFor(state.drill, state.method);
        const ended = canCheck(tree, state.picks);
        const anyValue = (optionsAt(tree, state.picks, 0) ?? tree)[0]?.value ?? "x";

        if (depth !== state.picks.length) {
          expect(reduce(state, { type: "PICK", depth, value: anyValue })).toBe(state);
        }
        if (ended) {
          expect(
            reduce(state, { type: "PICK", depth: state.picks.length, value: anyValue }),
          ).toBe(state);
        } else {
          expect(reduce(state, { type: "FINISH" })).toBe(state);
        }
      }),
      { numRuns: 200 },
    );
  });

  // Feature: midnight-code-hunt, Property 34: Accepted picks are final and finished screens are frozen
  // **Validates: Requirements 19.8, 19.9**
  it("Property 34: finished and idle screens ignore PICK, SELECT_METHOD, and FINISH", () => {
    fc.assert(
      fc.property(arbDrill, fc.integer({ min: 0, max: 8 }), (drill, depth) => {
        let state = reduce(idle, { type: "START", drill }) as Guiding;
        const tree = treeFor(drill, state.method);
        for (let guard = 0; guard < 20 && !canCheck(tree, state.picks); guard++) {
          const d = state.picks.length;
          const next = (optionsAt(tree, state.picks, d) ?? []).find((o) => o.role === "correct");
          state = reduce(state, { type: "PICK", depth: d, value: (next as OptionNode).value }) as Guiding;
        }
        const finished = reduce(state, { type: "FINISH" });
        expect(finished.phase).toBe("finished");

        for (const frozen of [finished, idle]) {
          expect(reduce(frozen, { type: "PICK", depth, value: tree[0].value })).toBe(frozen);
          expect(reduce(frozen, { type: "SELECT_METHOD", method: "toc" })).toBe(frozen);
          expect(reduce(frozen, { type: "SELECT_METHOD", method: "index" })).toBe(frozen);
          expect(reduce(frozen, { type: "FINISH" })).toBe(frozen);
        }
      }),
      { numRuns: 100 },
    );
  });
});
