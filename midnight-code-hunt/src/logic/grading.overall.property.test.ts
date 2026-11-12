import type { CodeTrail } from "@sentinel/skeleton-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arbDrill } from "../../test/support/arbitraries";
import { methodOf } from "../model/methods";
import type { MethodId, OptionNode } from "../model/types";
import { buildNamesIndex } from "./displayName";
import { gradeAttempt } from "./grading";

// Feature: midnight-code-hunt, Property 25: Overall result requires a matched same-trail path
// **Validates: Requirements 7.5, 10.9, 10.10, 10.11, 11.7, 11.8, 11.9**

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});

const norm = (s: string): string => s.trim().toLowerCase();

type Step = { level: string; value: string };
const stepsOf = (t: CodeTrail): Step[] =>
  t.legs.flatMap((leg) => leg.map((s) => ({ level: s.level as string, value: s.value })));

const sameSteps = (a: readonly Step[], b: readonly Step[]): boolean =>
  a.length === b.length &&
  a.every((s, i) => s.level === b[i]?.level && norm(s.value) === norm(b[i]?.value ?? ""));

type Source = "trail" | "moved";
type Mutation = "none" | "drop-last" | "extra" | "wrong-value" | "wrong-keyword" | "no-keyword";

const arbCase = fc
  .record({
    drill: arbDrill,
    useIndex: fc.boolean(),
    source: fc.constantFrom<Source>("trail", "moved"),
    mutation: fc.constantFrom<Mutation>(
      "none",
      "none",
      "none",
      "drop-last",
      "extra",
      "wrong-value",
      "wrong-keyword",
      "no-keyword",
    ),
    which: fc.nat(),
    timeUp: fc.boolean(),
    upper: fc.boolean(),
  })
  .map((c) => {
    const method: MethodId = c.useIndex && c.drill.index_checked ? "index" : "toc";
    const methodTrails = c.drill.def.trails.filter((t) => methodOf(t) === method);
    const moved = c.drill.def.movedFrom;
    const base: CodeTrail =
      c.source === "moved" && moved !== undefined && method === "toc"
        ? moved
        : (methodTrails[c.which % methodTrails.length] as CodeTrail);

    let keyword: string | undefined = c.upper ? base.keyword.toUpperCase() : base.keyword;
    let steps = stepsOf(base);
    if (c.mutation === "drop-last") steps = steps.slice(0, -1);
    else if (c.mutation === "extra") steps = [...steps, { level: "section", value: "extra step" }];
    else if (c.mutation === "wrong-value") {
      const last = steps[steps.length - 1] as Step;
      steps = [...steps.slice(0, -1), { level: last.level, value: `${last.value} zzz` }];
    } else if (c.mutation === "wrong-keyword") keyword = "no such keyword anywhere";
    else if (c.mutation === "no-keyword") keyword = undefined;

    const path: OptionNode[] = [];
    if (keyword !== undefined) path.push({ level: "keyword", value: keyword, role: "correct" });
    for (const s of steps) {
      path.push({ level: s.level, value: s.value, role: "correct" } as OptionNode);
    }
    return { drill: c.drill, method, path, keyword, steps, timeUp: c.timeUp };
  });

describe("Property 25: Overall result requires a matched same-trail path", () => {
  it("overall is correct iff the keyword matches and the path matches a same-keyword trail; moved-from matches are incorrect against 2023", () => {
    fc.assert(
      fc.property(arbCase, ({ drill, method, path, keyword, steps, timeUp }) => {
        const result = gradeAttempt(drill, method, path, names, {
          timeUp,
          elapsedSeconds: 5,
        });

        const k = keyword === undefined ? undefined : norm(keyword);
        const sameKeyword = drill.def.trails.filter(
          (t) => methodOf(t) === method && k !== undefined && norm(t.keyword) === k,
        );
        const keywordOk = sameKeyword.length > 0;
        const mainMatch = keywordOk && sameKeyword.some((t) => sameSteps(stepsOf(t), steps));
        const mf = drill.def.movedFrom;
        const movedMatch =
          keywordOk &&
          !mainMatch &&
          method === "toc" &&
          mf !== undefined &&
          k === norm(mf.keyword) &&
          sameSteps(stepsOf(mf), steps);

        expect(result.overall).toBe(mainMatch ? "correct" : "incorrect");
        // In case (b) (keyword incorrect) the Core grades all method trails, so `matched` is
        // not constrained; overall is still incorrect.
        if (keywordOk) expect(result.matched).toBe(mainMatch);
        expect(result.matchedMovedFrom).toBe(movedMatch);
        expect(result.verdictsAgainst).toBe(movedMatch ? "2023" : "2026");
        if (movedMatch) expect(result.overall).toBe("incorrect");

        // editionNote is carried only when matchedMovedFrom.
        if (movedMatch && drill.def.editionNote !== undefined) {
          expect(result.editionNote).toBe(drill.def.editionNote);
        } else {
          expect(result.editionNote).toBeUndefined();
        }

        // Expiry does not change the verdict.
        expect(result.timeUp).toBe(timeUp);
      }),
      { numRuns: 300 },
    );
  });
});
