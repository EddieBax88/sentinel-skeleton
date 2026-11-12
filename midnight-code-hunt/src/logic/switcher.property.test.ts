import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseSwitcherUrl } from "./switcher";
import { arbUrl } from "../../test/support/arbitraries";

const VALID_PREFIXES = ["https://", "http://", "/"];

// Feature: midnight-code-hunt, Property 29: Switcher URL validation
// **Validates: Requirements 15.2, 15.3**
describe("Property 29: Switcher URL validation", () => {
  it("returns the string unchanged iff length is 1..2048 and the prefix is valid, else null", () => {
    fc.assert(
      fc.property(arbUrl, (raw) => {
        const valid =
          raw.length >= 1 &&
          raw.length <= 2048 &&
          VALID_PREFIXES.some((p) => raw.startsWith(p));
        expect(parseSwitcherUrl(raw)).toBe(valid ? raw : null);
      }),
      { numRuns: 200 },
    );
  });

  it("returns null for arbitrary strings unless they carry a valid prefix and length", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 3000 }), (raw) => {
        const valid =
          raw.length >= 1 &&
          raw.length <= 2048 &&
          VALID_PREFIXES.some((p) => raw.startsWith(p));
        expect(parseSwitcherUrl(raw)).toBe(valid ? raw : null);
      }),
      { numRuns: 200 },
    );
  });

  it("returns null for undefined, empty, and whitespace-only strings", () => {
    expect(parseSwitcherUrl(undefined)).toBeNull();
    expect(parseSwitcherUrl("")).toBeNull();
    fc.assert(
      fc.property(fc.stringMatching(/^[ \t\n\r]{1,50}$/), (ws) => {
        expect(parseSwitcherUrl(ws)).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
