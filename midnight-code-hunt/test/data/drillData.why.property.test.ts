// Feature: midnight-code-hunt, Property 37: Why sentences are optional and validated
// Validates: Requirements 20.2, 20.4, 20.6, 22.1
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { validateDrillData } from "../../src/data/validateDrillData";
import { CLEAN_NAMES } from "../fixtures/fictionalNames";
import {
  arbBrokenWhyDrill,
  arbDrill,
  arbDrillWithWhy,
  BROKEN_WHY_RULE,
  type BrokenWhyKind,
} from "../support/arbitraries";

const KINDS: readonly BrokenWhyKind[] = [
  "empty",
  "too-long",
  "two-sentences",
  "wrong-role",
  "moved-role",
];

describe("Property 37: Why sentences are optional and validated", () => {
  it("drills with no why yield no R20.* issues", () => {
    fc.assert(
      fc.property(arbDrill, (d) => {
        const issues = validateDrillData([d], CLEAN_NAMES).filter((i) => i.rule.startsWith("R20."));
        expect(issues).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it("drills with valid why sentences yield no R20.* issues", () => {
    fc.assert(
      fc.property(arbDrillWithWhy, (d) => {
        const issues = validateDrillData([d], CLEAN_NAMES).filter((i) => i.rule.startsWith("R20."));
        expect(issues).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  for (const kind of KINDS) {
    it(`broken why (${kind}) yields ${BROKEN_WHY_RULE[kind]} naming the drill id`, () => {
      fc.assert(
        fc.property(arbBrokenWhyDrill(kind), ({ drill }) => {
          const issues = validateDrillData([drill], CLEAN_NAMES);
          const hit = issues.filter((i) => i.rule === BROKEN_WHY_RULE[kind]);
          expect(hit.length).toBeGreaterThan(0);
          expect(hit.every((i) => i.drillId === drill.def.id)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  }
});
