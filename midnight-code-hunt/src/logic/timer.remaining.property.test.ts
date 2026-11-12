// Feature: midnight-code-hunt, Property 9: Remaining and elapsed time derive from the monotonic difference
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { elapsedSeconds, remainingSeconds } from "./timer";

/**
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.6**
 */
describe("Property 9: remaining and elapsed time", () => {
  const startArb = fc.integer({ min: 0, max: 1_000_000 });
  const deltaArb = fc.integer({ min: 0, max: 300_000 });

  it("remaining equals clamped ceil((120000 - delta) / 1000), elapsed is 120 - remaining", () => {
    fc.assert(
      fc.property(startArb, deltaArb, (start, delta) => {
        const remaining = remainingSeconds(start, start + delta);
        const expected = Math.min(120, Math.max(0, Math.ceil((120000 - delta) / 1000)));
        expect(remaining).toBe(expected);
        expect(remaining).toBeGreaterThanOrEqual(0);
        expect(remaining).toBeLessThanOrEqual(120);
        const elapsed = elapsedSeconds(remaining);
        expect(elapsed).toBe(120 - remaining);
        expect(elapsed).toBeGreaterThanOrEqual(0);
        expect(elapsed).toBeLessThanOrEqual(120);
      }),
      { numRuns: 200 },
    );
  });

  it("never increases as the reading grows", () => {
    fc.assert(
      fc.property(startArb, deltaArb, deltaArb, (start, a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(remainingSeconds(start, start + hi)).toBeLessThanOrEqual(
          remainingSeconds(start, start + lo),
        );
      }),
      { numRuns: 200 },
    );
  });

  it("is 120 at delta 0 and 0 at delta of 120000 or more", () => {
    fc.assert(
      fc.property(startArb, fc.integer({ min: 0, max: 1_000_000 }), (start, extra) => {
        expect(remainingSeconds(start, start)).toBe(120);
        expect(remainingSeconds(start, start + 120000 + extra)).toBe(0);
      }),
      { numRuns: 200 },
    );
  });

  it("one large jump equals many small steps to the same reading", () => {
    fc.assert(
      fc.property(
        startArb,
        fc.array(fc.integer({ min: 0, max: 20_000 }), { maxLength: 30 }),
        (start, steps) => {
          let now = start;
          let stepped = remainingSeconds(start, now);
          for (const s of steps) {
            now += s;
            stepped = remainingSeconds(start, now);
          }
          expect(remainingSeconds(start, now)).toBe(stepped);
          const jump = steps.reduce((x, y) => x + y, 0);
          expect(remainingSeconds(start, start + jump)).toBe(stepped);
        },
      ),
      { numRuns: 200 },
    );
  });
});
