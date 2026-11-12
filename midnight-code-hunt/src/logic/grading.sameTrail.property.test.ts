import type { CodeTrail } from "@sentinel/skeleton-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arbDrill, arbTrail } from "../../test/support/arbitraries";
import { twoKeywordDrill } from "../../test/fixtures/fixtureDrills";
import type { DrillRecord, OptionNode } from "../model/types";
import { buildNamesIndex } from "./displayName";
import { gradeAttempt } from "./grading";

// Feature: midnight-code-hunt, Property 23: Keyword and remaining picks must come from the same trail
// **Validates: Requirements 10.11, 10.13**

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});
const outcome = { timeUp: false, elapsedSeconds: 1 };

/** Keyword node first, then every step of the trail in click order. */
function pathFor(keyword: string, trail: CodeTrail): OptionNode[] {
  const steps: OptionNode[] = trail.legs.flatMap((leg) =>
    leg.map((s) => ({ level: s.level, value: s.value, role: "correct" as const }) as OptionNode),
  );
  return [{ level: "keyword", value: keyword, role: "correct" }, ...steps];
}

const legsKey = (t: CodeTrail): string => JSON.stringify(t.legs);

type Pair = { drill: DrillRecord; a: CodeTrail; b: CodeTrail };

/** Drills with two valid toc trails, different keywords and different routes. */
const arbPair: fc.Arbitrary<Pair> = fc.oneof(
  fc.constant<Pair>({
    drill: twoKeywordDrill,
    a: twoKeywordDrill.def.trails[0] as CodeTrail,
    b: twoKeywordDrill.def.trails[1] as CodeTrail,
  }),
  fc
    .record({
      base: arbDrill,
      a: arbTrail("main-chapter"),
      b: arbTrail("main-chapter"),
    })
    .filter(
      ({ a, b }) =>
        a.keyword.trim().toLowerCase() !== b.keyword.trim().toLowerCase() &&
        legsKey(a) !== legsKey(b),
    )
    .map(({ base, a, b }): Pair => {
      const { movedFrom: _movedFrom, editionNote: _editionNote, ...defRest } = base.def;
      const drill = {
        ...base,
        def: { ...defRest, trails: [a, b] },
      } as unknown as DrillRecord;
      return { drill, a, b };
    }),
);

describe("Property 23: Keyword and remaining picks must come from the same trail", () => {
  it("keyword of one trail with the remaining picks of the other is not correct overall", () => {
    fc.assert(
      fc.property(arbPair, fc.boolean(), ({ drill, a, b }, swap) => {
        const [kwTrail, pickTrail] = swap ? [b, a] : [a, b];
        const result = gradeAttempt(
          drill,
          "toc",
          pathFor(kwTrail.keyword, pickTrail),
          names,
          outcome,
        );
        expect(result.overall).toBe("incorrect");
        expect(result.matched).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  it("each matching keyword and remaining-picks pair is correct", () => {
    fc.assert(
      fc.property(arbPair, fc.boolean(), ({ drill, a, b }, pickB) => {
        const trail = pickB ? b : a;
        const result = gradeAttempt(drill, "toc", pathFor(trail.keyword, trail), names, outcome);
        expect(result.overall).toBe("correct");
        expect(result.matched).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
