import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { makeTableValue } from "./makeTableValue.js";

describe("makeTableValue", () => {
  // Feature: skeleton-core, Property 9: makeTableValue round-trip
  // **Validates: Requirements 5.3, 5.5**
  it("round-trips value and source, with nfpa_checked defaulting to false", () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        fc.string({ minLength: 1 }).filter((s) => s.trim() !== ""),
        (v, s) => {
          const tv = makeTableValue(v, s);
          expect(Object.is(tv.value, v)).toBe(true);
          expect(tv.source).toBe(s);
          expect(tv.nfpa_checked).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("throws on empty source (Req 5.4)", () => {
    expect(() => makeTableValue(1, "")).toThrow();
  });

  it("defaults nfpa_checked to false (Req 5.1)", () => {
    expect(makeTableValue(1, "Table 314.16(A)").nfpa_checked).toBe(false);
  });
});
