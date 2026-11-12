import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { extractFirstNumber } from "@sentinel/skeleton-core";
import type { OptionNode, OptionTree } from "../model/types";
import { arbDrill, arbTrail } from "../../test/support/arbitraries";
import { treeFromTrails } from "../../test/support/buildTree";
import { buildNamesIndex } from "./displayName";
import { resolvePath, viewFlow } from "./stepEngine";

// Feature: midnight-code-hunt, Property 19: Chapter 9 table branch shows a Row line but never a Row pick
// **Validates: Requirements 8.13, 9.1, 9.10**

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});

/** Every prefix path (as pick values) reachable in the tree, depth-first. */
function allPicks(tree: OptionTree): string[][] {
  const out: string[][] = [[]];
  const visit = (nodes: readonly OptionNode[], prefix: string[]): void => {
    for (const n of nodes) {
      const picks = [...prefix, n.value];
      out.push(picks);
      if (n.next !== undefined) visit(n.next, picks);
    }
  };
  visit(tree, []);
  return out;
}

const isChapterNine = (n: OptionNode): boolean =>
  n.level === "chapter" && extractFirstNumber(n.value) === 9;

function expectNoRow(tree: OptionTree, picks: readonly string[]): boolean {
  const view = viewFlow(tree, picks, names);
  for (const step of view.steps) {
    expect(step.label as string).not.toBe("row");
    for (const click of step.clicks) {
      expect(click.level as string).not.toBe("row");
      for (const o of click.options) expect(o.value.toLowerCase()).not.toMatch(/^row\b/);
    }
  }
  return view.showRowNote;
}

describe("viewFlow: Chapter 9 Row line (Property 19)", () => {
  it("sets showRowNote exactly for Chapter 9 paths ending at a table, and never offers a Row pick", () => {
    fc.assert(
      fc.property(arbDrill, (drill) => {
        for (const tree of [drill.trees.toc, drill.trees.index]) {
          if (tree === undefined) continue;
          for (const picks of allPicks(tree)) {
            const path = resolvePath(tree, picks);
            expect(path).toBeDefined();
            const nodes = path as readonly OptionNode[];
            const last = nodes[nodes.length - 1];
            const expected =
              last !== undefined &&
              last.next === undefined &&
              last.level === "table" &&
              nodes.some(isChapterNine);
            expect(expectNoRow(tree, picks)).toBe(expected);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("shows the Row line at the end of every Chapter 9 table trail and not before it", () => {
    fc.assert(
      fc.property(fc.array(arbTrail("chapter9-table"), { minLength: 1, maxLength: 2 }), (trails) => {
        const tree = treeFromTrails(trails, undefined, []);
        for (const trail of trails) {
          const leg = trail.legs[0];
          const full = [trail.keyword, ...leg.map((s) => s.value)];
          expect(expectNoRow(tree, full)).toBe(true);
          for (let k = 0; k < full.length; k++) {
            expect(expectNoRow(tree, full.slice(0, k))).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
