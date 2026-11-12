import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { DrillRecord, MethodId, OptionNode } from "../model/types";
import { arbDrill } from "../../test/support/arbitraries";
import { applyPick, optionsAt, treeFor } from "./stepEngine";

// Feature: midnight-code-hunt, Property 15: Changing an earlier pick clears every later pick
// **Validates: Requirements 8.10, 6.6**

const norm = (s: string): string => s.trim().toLowerCase();

/** Walks the tree from the root, taking option `choices[d] % length` at each depth until a node has no `next`. */
function walk(drill: DrillRecord, method: MethodId, choices: readonly number[]): string[] {
  const tree = treeFor(drill, method);
  const picks: string[] = [];
  for (let depth = 0; depth < choices.length; depth++) {
    const options = optionsAt(tree, picks, depth);
    if (options === undefined || options.length === 0) break;
    const node = options[(choices[depth] as number) % options.length] as OptionNode;
    picks.push(node.value);
    if (node.next === undefined) break;
  }
  return picks;
}

const arbChoices = fc.array(fc.nat({ max: 50 }), { minLength: 12, maxLength: 12 });

describe("applyPick: changing an earlier pick (Property 15)", () => {
  it("keeps picks before the changed click, sets the new pick, clears every later pick", () => {
    fc.assert(
      fc.property(
        arbDrill,
        fc.boolean(),
        arbChoices,
        fc.nat({ max: 50 }),
        fc.nat({ max: 50 }),
        (drill, useIndex, choices, depthSeed, altSeed) => {
          const method: MethodId = useIndex && drill.trees.index !== undefined ? "index" : "toc";
          const tree = treeFor(drill, method);
          const full = walk(drill, method, choices);
          fc.pre(full.length >= 1);
          const depth = depthSeed % full.length;
          const prefix = full.slice(0, depth);
          const options = optionsAt(tree, prefix, depth) as readonly OptionNode[];
          const alt = options[altSeed % options.length] as OptionNode;

          const result = applyPick(tree, full, depth, alt.value);

          expect(result).toHaveLength(depth + 1);
          expect(result.slice(0, depth)).toEqual(prefix);
          expect(norm(result[depth] as string)).toBe(norm(alt.value));
        },
      ),
      { numRuns: 200 },
    );
  });

  it("changing the first Index click clears the second click and everything after", () => {
    const arbIndexDrill = arbDrill.filter((d) => d.trees.index !== undefined);
    fc.assert(
      fc.property(
        arbIndexDrill,
        arbChoices,
        fc.nat({ max: 50 }),
        (drill, choices, altSeed) => {
          const tree = treeFor(drill, "index");
          const full = walk(drill, "index", choices);
          // Find the first click at the Index level.
          let indexDepth = -1;
          for (let d = 0; d < full.length; d++) {
            const opts = optionsAt(tree, full.slice(0, d), d) as readonly OptionNode[];
            if (opts[0]?.level === "index") {
              indexDepth = d;
              break;
            }
          }
          fc.pre(indexDepth >= 0 && full.length > indexDepth + 1);

          const prefix = full.slice(0, indexDepth);
          const options = optionsAt(tree, prefix, indexDepth) as readonly OptionNode[];
          const alt = options[altSeed % options.length] as OptionNode;

          const result = applyPick(tree, full, indexDepth, alt.value);

          expect(result).toHaveLength(indexDepth + 1);
          expect(result.slice(0, indexDepth)).toEqual(prefix);
          expect(norm(result[indexDepth] as string)).toBe(norm(alt.value));
          // The second Index click is gone.
          expect(result[indexDepth + 1]).toBeUndefined();
        },
      ),
      { numRuns: 200 },
    );
  });

  it("changing the second Index click keeps the first", () => {
    const arbIndexDrill = arbDrill.filter((d) => d.trees.index !== undefined);
    fc.assert(
      fc.property(arbIndexDrill, arbChoices, (drill, choices) => {
        const tree = treeFor(drill, "index");
        const full = walk(drill, "index", choices);
        let indexDepth = -1;
        for (let d = 0; d < full.length; d++) {
          const opts = optionsAt(tree, full.slice(0, d), d) as readonly OptionNode[];
          if (opts[0]?.level === "index") {
            indexDepth = d;
            break;
          }
        }
        fc.pre(indexDepth >= 0 && full.length > indexDepth + 1);
        const second = indexDepth + 1;
        const options = optionsAt(tree, full.slice(0, second), second) as readonly OptionNode[];
        const result = applyPick(tree, full, second, (options[0] as OptionNode).value);
        expect(result).toHaveLength(second + 1);
        expect(result.slice(0, second)).toEqual(full.slice(0, second));
      }),
      { numRuns: 100 },
    );
  });
});
