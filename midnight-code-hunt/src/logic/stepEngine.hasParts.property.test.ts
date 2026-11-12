import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { MethodId, OptionNode, OptionTree } from "../model/types";
import { arbDrill } from "../../test/support/arbitraries";
import { nextStepLevel, resolvePath, treeFor, viewFlow } from "./stepEngine";

// Feature: midnight-code-hunt, Property 18: Branches follow the has-Parts marker
// **Validates: Requirements 9.1, 9.2**

type ArticleAt = { readonly node: OptionNode; readonly picks: readonly string[] };

/** Every Article node in the tree with the picks that reach it. */
function articles(
  options: readonly OptionNode[] | undefined,
  prefix: readonly string[] = [],
): ArticleAt[] {
  const found: ArticleAt[] = [];
  for (const node of options ?? []) {
    const picks = [...prefix, node.value];
    if (node.level === "article") found.push({ node, picks });
    found.push(...articles(node.next, picks));
  }
  return found;
}

const noNames = { byArticle: new Map(), byChapter: new Map() } as never;

describe("has-Parts branching (Property 18)", () => {
  it("nextStepLevel is part iff the Article marker is true, and the step after a picked Article follows it", () => {
    fc.assert(
      fc.property(arbDrill, fc.boolean(), (drill, useIndex) => {
        const method: MethodId = useIndex && drill.trees.index !== undefined ? "index" : "toc";
        const tree: OptionTree = treeFor(drill, method);
        for (const { node, picks } of articles(tree)) {
          if (node.level !== "article") continue;
          if (node.hasParts) expect(nextStepLevel(node)).toBe("part");
          else expect(nextStepLevel(node)).not.toBe("part");

          // Only check the view when the picks resolve to this very Article (sibling values may repeat).
          const path = resolvePath(tree, picks);
          const last = path?.[path.length - 1];
          if (last === undefined || last.level !== "article" || last.value !== node.value) continue;
          if (last.next === undefined) continue;
          const view = viewFlow(tree, picks, noNames);
          const nextStep = view.steps[view.steps.length - 1];
          expect(nextStep?.label === "part").toBe(last.hasParts);
        }
      }),
      { numRuns: 100 },
    );
  });
});
