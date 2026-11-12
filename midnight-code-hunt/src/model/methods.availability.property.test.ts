// Feature: midnight-code-hunt, Property 7: Method availability follows index_checked
// Validates: Requirements 6.1, 6.2, 6.3, 6.4
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { arbDrill } from "../../test/support/arbitraries";
import { availableMethods, defaultMethod } from "./methods";
import type { DrillRecord } from "./types";

describe("Property 7: Method availability follows index_checked", () => {
  it("lists index first only when index_checked and an Index tree exist; default is first listed", () => {
    fc.assert(
      fc.property(arbDrill, fc.boolean(), fc.boolean(), (base, checked, withIndex) => {
        // Force all four combinations of index_checked x Index tree presence.
        const trees = withIndex
          ? { toc: base.trees.toc, index: base.trees.index ?? base.trees.toc }
          : { toc: base.trees.toc };
        const drill: DrillRecord = { ...base, index_checked: checked, trees };

        const methods = availableMethods(drill);
        if (checked && withIndex) {
          expect(methods).toEqual(["index", "toc"]);
        } else {
          expect(methods).toEqual(["toc"]);
        }
        expect(defaultMethod(drill)).toBe(methods[0]);
        if (methods.includes("index")) expect(defaultMethod(drill)).toBe("index");
      }),
      { numRuns: 200 },
    );
  });

  it("holds for generated drills as-is", () => {
    fc.assert(
      fc.property(arbDrill, (drill) => {
        const offersIndex = drill.index_checked === true && drill.trees.index !== undefined;
        expect(availableMethods(drill)).toEqual(offersIndex ? ["index", "toc"] : ["toc"]);
      }),
      { numRuns: 100 },
    );
  });
});
