import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { filterDrills, getBuildMode } from "./filterDrills";
import { arbBuildEnv, arbDrillList } from "../../test/support/arbitraries";

// Feature: midnight-code-hunt, Property 6: Build mode never publishes drafts
// **Validates: Requirements 4.2, 5.10**
describe("Property 6: Build mode never publishes drafts", () => {
  it("PROD true always yields production, whatever MODE is", () => {
    fc.assert(
      fc.property(arbBuildEnv, fc.string(), (env, mode) => {
        expect(getBuildMode({ ...env, PROD: true })).toBe("production");
        expect(getBuildMode({ PROD: true, MODE: mode })).toBe("production");
      }),
      { numRuns: 100 },
    );
  });

  it("filtering in the mode chosen for a PROD build never yields unchecked drills", () => {
    fc.assert(
      fc.property(arbBuildEnv, arbDrillList, (env, list) => {
        const mode = getBuildMode({ ...env, PROD: true });
        const result = filterDrills(list, mode);
        for (const e of result) {
          expect(e.draft).toBe(false);
          expect(e.drill.founder_checked).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
