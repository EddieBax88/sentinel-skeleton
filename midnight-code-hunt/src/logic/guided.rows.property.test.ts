import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { DrillRecord, MethodId, OptionNode, OptionTree } from "../model/types";
import { arbDrillWithWhy } from "../../test/support/arbitraries";
import { buildNamesIndex } from "./displayName";
import { guidedPathRows } from "./guided";
import { resolvePath } from "./stepEngine";

// Feature: midnight-code-hunt, Property 36: Guided end rows equal the accepted path
// **Validates: Requirements 21.3, 20.11**

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});

const CHAPTER_FORK = "Zzchapterfork marker sentence.";
const ARTICLE_FORK = "Zzarticlefork marker sentence.";

const arbForkedDrill: fc.Arbitrary<DrillRecord> = arbDrillWithWhy.map((d) => ({
  ...d,
  chapterForkSentence: CHAPTER_FORK,
  articleForkSentence: ARTICLE_FORK,
}));

/** Every pick list that follows only correct Options from the Keyword to a path end. */
function correctPaths(tree: OptionTree): string[][] {
  const out: string[][] = [];
  const visit = (nodes: readonly OptionNode[], prefix: string[]): void => {
    for (const n of nodes) {
      if (n.role !== "correct") continue;
      const picks = [...prefix, n.value];
      if (n.next === undefined) out.push(picks);
      else visit(n.next, picks);
    }
  };
  visit(tree, []);
  return out;
}

describe("guidedPathRows (Property 36)", () => {
  it("copies each row's why from its Option, omits empty whys, and never shows fork text", () => {
    let sawWhy = false;
    fc.assert(
      fc.property(arbForkedDrill, (drill) => {
        const methods: [MethodId, OptionTree | undefined][] = [
          ["toc", drill.trees.toc],
          ["index", drill.trees.index],
        ];
        for (const [method, tree] of methods) {
          if (tree === undefined) continue;
          for (const picks of correctPaths(tree)) {
            const path = resolvePath(tree, picks) as readonly OptionNode[];
            const rows = guidedPathRows(drill, method, picks, names);
            const pathRows = rows.filter((r) => r.kind !== "row-line");
            expect(pathRows).toHaveLength(path.length);
            pathRows.forEach((row, i) => {
              const why = path[i]?.why;
              if (why !== undefined && why !== "") {
                sawWhy = true;
                expect(row.why).toBe(why);
              } else {
                expect(row.why).toBeUndefined();
                expect("why" in row).toBe(false);
              }
              if ("why" in row) expect(row.why).not.toBe("");
            });
            for (const row of rows) {
              if (row.kind === "row-line") expect("why" in row).toBe(false);
            }
            const text = JSON.stringify(rows);
            expect(text).not.toContain(CHAPTER_FORK);
            expect(text).not.toContain(ARTICLE_FORK);
          }
        }
      }),
      { numRuns: 100 },
    );
    expect(sawWhy).toBe(true);
  });
});
