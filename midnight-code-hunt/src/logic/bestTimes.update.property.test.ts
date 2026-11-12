import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createBestTimesStore, updateBest, type StorageLike } from './bestTimes';

const seconds = fc.integer({ min: 0, max: 120 });
const maybeSaved = fc.option(seconds, { nil: undefined });

function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => void m.set(k, v),
  };
}

// Feature: midnight-code-hunt, Property 11: Best-time update is the minimum and idempotent
// **Validates: Requirements 12.3, 12.4, 12.6, 11.10**
describe('Property 11: Best-time update is the minimum and idempotent', () => {
  it('updateBest returns elapsed when none saved, else min; never above saved; idempotent', () => {
    fc.assert(
      fc.property(maybeSaved, seconds, (prev, elapsed) => {
        const next = updateBest(prev, elapsed);
        expect(next).toBe(prev === undefined ? elapsed : Math.min(prev, elapsed));
        if (prev !== undefined) expect(next).toBeLessThanOrEqual(prev);
        expect(updateBest(next, elapsed)).toBe(next);
      }),
      { numRuns: 100 },
    );
  });

  it('submit flags isNewBest exactly when none saved or elapsed < saved, and stores the minimum', () => {
    fc.assert(
      fc.property(maybeSaved, seconds, (prev, elapsed) => {
        const store = createBestTimesStore(memoryStorage());
        if (prev !== undefined) store.submit('d1', 'index', prev);
        const out = store.submit('d1', 'index', elapsed);
        expect(out.isNewBest).toBe(prev === undefined || elapsed < prev);
        expect(out.best).toBe(updateBest(prev, elapsed));
        expect(store.get('d1', 'index')).toBe(out.best);
        const again = store.submit('d1', 'index', elapsed);
        expect(again.best).toBe(out.best);
        expect(again.isNewBest).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
