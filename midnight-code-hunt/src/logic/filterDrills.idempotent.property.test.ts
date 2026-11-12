import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { filterDrills } from "./filterDrills";
import { arbDrillList } from "../../test/support/arbitraries";

// Feature: midnight-code-hunt, Property 4: Production filter is idempotent
// **Validates: Requirements 4.6**
describe("Property 4: Production filter is idempotent", () => {
  it("filtering the drills of a production result again returns an equal result", () => {
    fc.assert(
      fc.property(arbDrillList, (list) => {
        const once = filterDrills(list, "production");
        const twice = filterDrills(
          once.map((entry) => entry.drill),
          "production",
        );
        expect(twice).toEqual(once);
      }),
      { numRuns: 100 },
    );
  });
});
