import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { formatTime, parseTime } from './timer';

// Feature: midnight-code-hunt, Property 8: Time format round trip
// **Validates: Requirements 7.10, 11.1**
describe('Property 8: Time format round trip', () => {
  it('parseTime(formatTime(s)) equals s and the text is m:ss', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 120 }), (s) => {
        const text = formatTime(s);
        expect(parseTime(text)).toBe(s);
        expect(text).toMatch(/^\d+:\d{2}$/);
        const [minutes, seconds] = text.split(':');
        expect(minutes).toHaveLength(1);
        expect(Number(seconds)).toBeGreaterThanOrEqual(0);
        expect(Number(seconds)).toBeLessThanOrEqual(59);
      }),
      { numRuns: 100 },
    );
  });
});
