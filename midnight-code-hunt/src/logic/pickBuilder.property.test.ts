import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { NO_PARTS } from "@sentinel/skeleton-core";
import { buildGradePicks, keywordOf } from "./pickBuilder";
import type { OptionNode, OptionTree } from "../model/types";
import { arbDrill } from "../../test/support/arbitraries";

/** Walks the tree from the root, choosing a child by each index (mod length), until the path ends. */
function walk(tree: OptionTree, choices: readonly number[]): OptionNode[] {
  const path: OptionNode[] = [];
  let options: readonly OptionNode[] | undefined = tree;
  let i = 0;
  while (options && options.length > 0) {
    const node: OptionNode = options[(choices[i++] ?? 0) % options.length];
    path.push(node);
    options = node.next;
  }
  return path;
}

const arbPath = fc
  .tuple(arbDrill, fc.boolean(), fc.array(fc.nat(), { minLength: 12, maxLength: 12 }))
  .map(([drill, useIndex, choices]) => {
    const tree = useIndex && drill.trees.index ? drill.trees.index : drill.trees.toc;
    return walk(tree, choices);
  });

// Feature: midnight-code-hunt, Property 20: Picks passed to the Core exclude the Keyword, keep order, and never use NO_PARTS
// **Validates: Requirements 8.5, 8.6, 9.3, 9.7, 10.1**
describe("Property 20: Picks passed to the Core exclude the Keyword, keep order, and never use NO_PARTS", () => {
  it("drops the Keyword node, keeps click order, copies values verbatim, adds nothing", () => {
    fc.assert(
      fc.property(arbPath, (path) => {
        expect(path[0].level).toBe("keyword");
        const picks = buildGradePicks(path);
        expect(picks).toHaveLength(path.length - 1);
        picks.forEach((pick, i) => {
          expect(pick.level).toBe(path[i + 1].level);
          expect(pick.value).toBe(path[i + 1].value);
        });
        expect(picks.some((p) => (p.level as string) === "keyword")).toBe(false);
        expect(keywordOf(path)).toBe(path[0].value);
      }),
      { numRuns: 200 },
    );
  });

  it("never emits NO_PARTS, and a Part pick appears only when the path clicked a Part node", () => {
    fc.assert(
      fc.property(arbPath, (path) => {
        const picks = buildGradePicks(path);
        expect(picks.some((p) => p.value === NO_PARTS)).toBe(false);
        const clickedParts = path.filter((n) => n.level === "part").length;
        expect(picks.filter((p) => p.level === "part")).toHaveLength(clickedParts);
      }),
      { numRuns: 200 },
    );
  });

  it("gives an Index path an index pick first, then a section or table pick", () => {
    fc.assert(
      fc.property(
        arbDrill,
        fc.array(fc.nat(), { minLength: 12, maxLength: 12 }),
        (drill, choices) => {
          fc.pre(drill.trees.index !== undefined);
          const path = walk(drill.trees.index as OptionTree, choices);
          const picks = buildGradePicks(path);
          if (picks.length >= 2) {
            expect(picks[0].level).toBe("index");
            expect(["section", "table"]).toContain(picks[1].level);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
