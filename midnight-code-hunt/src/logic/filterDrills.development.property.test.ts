import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { filterDrills, type BuildMode } from "./filterDrills";
import { arbDrillList } from "../../test/support/arbitraries";

const arbNonProductionMode: fc.Arbitrary<BuildMode> = fc.constantFrom<BuildMode>(
  "development",
  "test",
);

// Feature: midnight-code-hunt, Property 5: Development and test filter keeps everything and flags drafts
// **Validates: Requirements 4.3, 4.4, 4.9**
describe("Property 5: Development and test filter keeps everything and flags drafts", () => {
  it("keeps every record in order and flags draft iff founder_checked is not exactly true", () => {
    fc.assert(
      fc.property(arbDrillList, arbNonProductionMode, (list, mode) => {
        const snapshot = structuredClone(list);

        const result = filterDrills(list, mode);

        expect(result).toHaveLength(list.length);
        result.forEach((entry, i) => {
          expect(entry.drill).toBe(list[i]);
          expect(entry.draft).toBe(list[i].founder_checked !== true);
        });

        // Input is not mutated.
        expect(list).toEqual(snapshot);
      }),
      { numRuns: 100 },
    );
  });

  it("covers both development and test modes", () => {
    for (const mode of ["development", "test"] as const) {
      fc.assert(
        fc.property(arbDrillList, (list) => {
          const result = filterDrills(list, mode);
          expect(result.map((e) => e.drill)).toEqual(list);
          expect(result.map((e) => e.draft)).toEqual(
            list.map((d) => d.founder_checked !== true),
          );
        }),
        { numRuns: 100 },
      );
    }
  });
});
