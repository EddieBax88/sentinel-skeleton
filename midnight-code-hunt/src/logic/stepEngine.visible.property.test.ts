import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { MethodId, OptionNode } from "../model/types";
import { arbDrill } from "../../test/support/arbitraries";
import { buildNamesIndex } from "./displayName";
import { applyPick, optionsAt, treeFor, viewFlow } from "./stepEngine";

// Feature: midnight-code-hunt, Property 16: Only the next click is visible after each pick
// **Validates: Requirements 8.1, 8.2, 8.3, 9.4, 9.5**

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
} as unknown as Parameters<typeof buildNamesIndex>[0]);

const arbChoices = fc.array(fc.nat({ max: 50 }), { minLength: 14, maxLength: 14 });

describe("viewFlow: only the next click is visible (Property 16)", () => {
  it("after each pick, shows the answered clicks plus exactly the next click, and nothing further", () => {
    fc.assert(
      fc.property(arbDrill, fc.boolean(), arbChoices, (drill, useIndex, choices) => {
        const method: MethodId = useIndex && drill.trees.index !== undefined ? "index" : "toc";
        const tree = treeFor(drill, method);

        // Build the picks one click at a time through applyPick, checking the view after each.
        let picks: readonly string[] = [];
        const initial = viewFlow(tree, picks, names);
        const initialClicks = initial.steps.flatMap((s) => s.clicks);
        expect(initialClicks).toHaveLength(1);
        expect(initialClicks[0]?.depth).toBe(0);
        expect(initialClicks[0]?.selected).toBeUndefined();

        for (let depth = 0; depth < choices.length; depth++) {
          const options = optionsAt(tree, picks, depth);
          if (options === undefined || options.length === 0) break;
          const node = options[(choices[depth] as number) % options.length] as OptionNode;
          picks = applyPick(tree, picks, depth, node.value);
          expect(picks).toHaveLength(depth + 1);

          const view = viewFlow(tree, picks, names);
          const clicks = view.steps.flatMap((s) => s.clicks);
          const ended = node.next === undefined;

          expect(view.pathEnded).toBe(ended);
          // Answered clicks, plus one unanswered next click only when the path continues.
          expect(clicks).toHaveLength(ended ? picks.length : picks.length + 1);
          clicks.forEach((c, i) => expect(c.depth).toBe(i));

          // Every answered click shows its pick; the next click has no pick yet.
          for (let i = 0; i < picks.length; i++) {
            expect(clicks[i]?.selected).toBe(picks[i]);
          }
          if (!ended) {
            const next = clicks[picks.length];
            expect(next?.selected).toBeUndefined();
            expect(next?.options.every((o) => !o.selected)).toBe(true);
            const expected = optionsAt(tree, picks, picks.length) as readonly OptionNode[];
            expect(next?.options.map((o) => o.value)).toEqual(expected.map((o) => o.value));
          }

          // Steps hold one click each, except an Index step holding the two Index clicks.
          for (const step of view.steps) {
            if (step.label === "index") expect(step.clicks.length).toBeLessThanOrEqual(2);
            else expect(step.clicks).toHaveLength(1);
          }

          if (ended) break;
        }
      }),
      { numRuns: 200 },
    );
  });
});
