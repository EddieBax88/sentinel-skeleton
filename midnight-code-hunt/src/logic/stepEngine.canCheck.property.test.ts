import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { MethodId, OptionNode } from "../model/types";
import { arbDrill } from "../../test/support/arbitraries";
import { applyPick, canCheck, treeFor } from "./stepEngine";

// Feature: midnight-code-hunt, Property 17: Check is enabled if and only if the path ends
// **Validates: Requirements 8.8, 8.9, 9.6**

const arbChoices = fc.array(fc.nat({ max: 50 }), { minLength: 12, maxLength: 12 });

/** Builds a valid pick path with applyPick, choosing option `choices[d] % length` at each depth. */
function buildPath(
  tree: ReturnType<typeof treeFor>,
  choices: readonly number[],
  length: number,
): { picks: readonly string[]; nodes: OptionNode[] } {
  let picks: readonly string[] = [];
  const nodes: OptionNode[] = [];
  let options: readonly OptionNode[] | undefined = tree;
  for (let depth = 0; depth < length; depth++) {
    if (options === undefined || options.length === 0) break;
    const offered = options;
    const node = offered[(choices[depth] as number) % offered.length] as OptionNode;
    const next = applyPick(tree, picks, depth, node.value);
    if (next.length !== depth + 1) break;
    picks = next;
    nodes.push(node);
    options = node.next;
  }
  return { picks, nodes };
}

describe("canCheck (Property 17)", () => {
  it("is true iff the path is non-empty and the latest picked node has no next", () => {
    fc.assert(
      fc.property(
        arbDrill,
        fc.boolean(),
        arbChoices,
        fc.nat({ max: 12 }),
        (drill, useIndex, choices, length) => {
          const method: MethodId = useIndex && drill.trees.index !== undefined ? "index" : "toc";
          const tree = treeFor(drill, method);
          const { picks, nodes } = buildPath(tree, choices, length);
          const last = nodes[nodes.length - 1];
          const expected = picks.length > 0 && last !== undefined && last.next === undefined;
          expect(canCheck(tree, picks)).toBe(expected);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("is false for the empty path", () => {
    fc.assert(
      fc.property(arbDrill, fc.boolean(), (drill, useIndex) => {
        const method: MethodId = useIndex && drill.trees.index !== undefined ? "index" : "toc";
        expect(canCheck(treeFor(drill, method), [])).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("is true for a path walked all the way to a node with no next", () => {
    fc.assert(
      fc.property(arbDrill, fc.boolean(), arbChoices, (drill, useIndex, choices) => {
        const method: MethodId = useIndex && drill.trees.index !== undefined ? "index" : "toc";
        const tree = treeFor(drill, method);
        const { picks, nodes } = buildPath(tree, choices, 12);
        const last = nodes[nodes.length - 1];
        fc.pre(last !== undefined && last.next === undefined);
        expect(canCheck(tree, picks)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("in an Index tree, the path after only the first Index click never enables Check", () => {
    const arbIndexDrill = arbDrill.filter((d) => d.trees.index !== undefined);
    fc.assert(
      fc.property(arbIndexDrill, arbChoices, (drill, choices) => {
        const tree = treeFor(drill, "index");
        const { picks, nodes } = buildPath(tree, choices, 12);
        const indexDepth = nodes.findIndex((n) => n.level === "index");
        // Decoy Index entries are leaves (no number to follow), so the path ends there by the
        // general rule; the clause applies to Index entries that still lead to the number.
        fc.pre(indexDepth >= 0 && nodes[indexDepth]?.next !== undefined);
        expect(canCheck(tree, picks.slice(0, indexDepth + 1))).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
