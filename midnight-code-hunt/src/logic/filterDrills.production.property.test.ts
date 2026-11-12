import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { filterDrills } from "./filterDrills";
import { arbDrillList } from "../../test/support/arbitraries";

// Feature: midnight-code-hunt, Property 3: Production filter keeps only checked drills, in order
// **Validates: Requirements 4.1, 4.2, 4.4, 4.5**
describe("Property 3: Production filter keeps only checked drills, in order", () => {
  it("returns an in-order subsequence of exactly the checked records, without mutating input", () => {
    fc.assert(
      fc.property(arbDrillList, (list) => {
        const snapshot = structuredClone(list);
        const copy = [...list];

        const result = filterDrills(list, "production");

        // Input array and records unchanged.
        expect(list).toHaveLength(copy.length);
        list.forEach((d, i) => expect(d).toBe(copy[i]));
        expect(list).toEqual(snapshot);

        // Every entry is a non-draft, checked record.
        for (const e of result) {
          expect(e.draft).toBe(false);
          expect(e.drill.founder_checked).toBe(true);
        }

        // Subsequence in input order: exactly the checked records, same identity.
        const expected = list.filter((d) => d.founder_checked === true);
        expect(result.map((e) => e.drill)).toHaveLength(expected.length);
        result.forEach((e, i) => expect(e.drill).toBe(expected[i]));

        // No unchecked or missing-flag record appears.
        const unchecked = new Set(list.filter((d) => d.founder_checked !== true));
        for (const e of result) expect(unchecked.has(e.drill)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
