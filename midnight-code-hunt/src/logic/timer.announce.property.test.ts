import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { announcementFor } from './timer';

const THRESHOLDS = [60, 30, 10, 0];

// Strictly decreasing sequence from 120 down to 0, with a random subset of 1..119 between.
const decreasingSequence = fc
  .subarray(Array.from({ length: 119 }, (_, i) => i + 1))
  .map((inner) => [120, ...[...inner].sort((a, b) => b - a), 0]);

// Feature: midnight-code-hunt, Property 10: Announcements fire only at the thresholds
// **Validates: Requirements 14.7**
describe('Property 10: Announcements fire only at the thresholds', () => {
  it('non-null results are thresholds, and a skipped threshold yields the smallest one crossed', () => {
    fc.assert(
      fc.property(decreasingSequence, (seq) => {
        for (let i = 0; i < seq.length - 1; i++) {
          const prev = seq[i];
          const next = seq[i + 1];
          const result = announcementFor(prev, next);
          const crossed = THRESHOLDS.filter((t) => prev > t && t >= next);
          if (result !== null) {
            expect(THRESHOLDS).toContain(result);
          }
          expect(result).toBe(crossed.length === 0 ? null : Math.min(...crossed));
        }
      }),
      { numRuns: 100 },
    );
  });

  it('visiting every second announces each threshold exactly once', () => {
    const results: number[] = [];
    for (let r = 120; r > 0; r--) {
      const a = announcementFor(r, r - 1);
      if (a !== null) results.push(a);
    }
    expect(results).toEqual([60, 30, 10, 0]);
  });

  it('never announces at any non-threshold second when every second is visited', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 120 }), (prev) => {
        const next = prev - 1;
        const result = announcementFor(prev, next);
        if (THRESHOLDS.includes(next)) expect(result).toBe(next);
        else expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
