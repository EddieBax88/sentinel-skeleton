import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arbDrillWithWhy, arbWhy } from "../../test/support/arbitraries";
import { addWhys } from "../../test/support/buildTree";
import { availableMethods } from "../model/methods";
import type { DrillRecord, MethodId, OptionNode, OptionTree } from "../model/types";
import { createAttemptReducer } from "./attempt";
import type { AttemptEvent, AttemptState } from "./attempt";
import { buildNamesIndex } from "./displayName";
import { gradeAttempt, selectGradingInput } from "./grading";
import { canCheck, optionsAt, resolvePath, treeFor, viewFlow } from "./stepEngine";

// Feature: midnight-code-hunt, Property 38: Why sentences never change Timed
// **Validates: Requirements 18.5, 20.8**

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});
const reduce = createAttemptReducer(names);

/** Copy of a tree with every `why` removed. */
function stripTree(nodes: readonly OptionNode[]): OptionNode[] {
  return nodes.map((n) => {
    const { why: _why, next, ...rest } = n as OptionNode & { why?: string };
    return (next ? { ...rest, next: stripTree(next) } : rest) as OptionNode;
  });
}

function withTrees(drill: DrillRecord, map: (t: OptionTree) => OptionTree): DrillRecord {
  const { index, toc } = drill.trees;
  return {
    ...drill,
    trees: { toc: map(toc), ...(index !== undefined ? { index: map(index) } : {}) },
  } as DrillRecord;
}

const strip = (d: DrillRecord): DrillRecord =>
  withTrees(d, (t) => stripTree(t) as unknown as OptionTree);

/** Every correct node gets `text` (adds missing whys and changes existing ones). */
const setAll = (d: DrillRecord, text: string): DrillRecord =>
  withTrees(strip(d), (t) => addWhys(t, () => text));

/** Follow `walk` through the tree, offering only options that exist. */
function pickValues(drill: DrillRecord, method: MethodId, walk: readonly number[]): string[] {
  const tree = treeFor(drill, method);
  const picks: string[] = [];
  for (const k of walk) {
    const options = optionsAt(tree, picks, picks.length);
    if (options === undefined || options.length === 0) break;
    picks.push((options[k % options.length] as OptionNode).value);
  }
  return picks;
}

/** A state without the drill (which legitimately differs in `why`). */
function withoutDrill(state: AttemptState): unknown {
  if (state.phase === "picker") return state;
  const { drill: _drill, ...rest } = state;
  return rest;
}

const arbCase = fc.record({
  drill: arbDrillWithWhy,
  useIndex: fc.boolean(),
  walk: fc.array(fc.nat(), { minLength: 0, maxLength: 12 }),
  other: fc.array(fc.nat(), { minLength: 0, maxLength: 12 }),
  why: arbWhy,
  tickAt: fc.integer({ min: 0, max: 130_000 }),
  checkAt: fc.integer({ min: 0, max: 130_000 }),
});

describe("Property 38: Why sentences never change Timed", () => {
  it("viewFlow, selectGradingInput, canCheck, gradeAttempt, and the reducer ignore why fields", () => {
    fc.assert(
      fc.property(arbCase, (c) => {
        const method: MethodId =
          c.useIndex && c.drill.trees.index !== undefined ? "index" : "toc";
        const plain = strip(c.drill);
        const variants = [c.drill, setAll(c.drill, c.why), setAll(c.drill, "Changed.")];

        const picks = pickValues(plain, method, c.walk);
        const refTree = treeFor(plain, method);
        const refPath = resolvePath(refTree, picks) ?? [];

        const refFlow = viewFlow(refTree, picks, names);
        const refCan = canCheck(refTree, picks);
        const refSel = selectGradingInput(plain, method, picks[0]);
        const refGrade = gradeAttempt(plain, method, refPath, names, {
          timeUp: false,
          elapsedSeconds: 7,
        });

        const events: AttemptEvent[] = [
          { type: "START", drill: plain, nowMs: 1000 },
          ...picks.map((value, depth): AttemptEvent => ({ type: "PICK", depth, value })),
          { type: "TICK", nowMs: 1000 + c.tickAt },
          { type: "CHECK", nowMs: 1000 + c.checkAt },
          { type: "RESTART", nowMs: 5000 },
        ];
        const otherMethod = availableMethods(plain).find((m) => m !== method);
        if (otherMethod !== undefined) {
          events.splice(1, 0, { type: "SELECT_METHOD", method: otherMethod });
          events.splice(
            2,
            0,
            ...pickValues(plain, otherMethod, c.other).map(
              (value, depth): AttemptEvent => ({ type: "PICK", depth, value }),
            ),
          );
        }

        const run = (drill: DrillRecord): unknown[] => {
          let state: AttemptState = { phase: "picker" };
          const trace: unknown[] = [];
          for (const e of events) {
            const ev = e.type === "START" ? { ...e, drill } : e;
            state = reduce(state, ev);
            trace.push(withoutDrill(state));
          }
          return trace;
        };
        const refTrace = run(plain);

        for (const drill of variants) {
          const tree = treeFor(drill, method);
          expect(viewFlow(tree, picks, names)).toEqual(refFlow);
          expect(canCheck(tree, picks)).toBe(refCan);
          expect(selectGradingInput(drill, method, picks[0])).toEqual(refSel);
          const path = resolvePath(tree, picks) ?? [];
          expect(
            gradeAttempt(drill, method, path, names, { timeUp: false, elapsedSeconds: 7 }),
          ).toEqual(refGrade);
          expect(run(drill)).toEqual(refTrace);
        }
      }),
      { numRuns: 150 },
    );
  });
});
