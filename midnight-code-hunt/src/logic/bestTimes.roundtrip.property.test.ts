import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createBestTimesStore, type StorageLike } from './bestTimes';

type MethodId = 'index' | 'toc';

function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => void m.set(k, v),
  };
}

// Finite, non-negative seconds (adding 0 normalizes -0 to 0).
const finiteSeconds = fc
  .double({ min: 0, max: 1e9, noNaN: true, noDefaultInfinity: true })
  .map((n) => n + 0);

const entry = fc.record({
  drillId: fc.string({ minLength: 1, maxLength: 20 }),
  method: fc.constantFrom<MethodId>('index', 'toc'),
  seconds: finiteSeconds,
});

const entries = fc.uniqueArray(entry, {
  maxLength: 20,
  selector: (e) => `${e.method}\u0000${e.drillId}`,
});

// Feature: midnight-code-hunt, Property 12: Stored best times round trip
// **Validates: Requirements 12.1, 12.7**
describe('Property 12: Stored best times round trip', () => {
  it('a new store over the same storage reads back an equal map', () => {
    fc.assert(
      fc.property(entries, (list) => {
        const storage = memoryStorage();
        const writer = createBestTimesStore(storage);
        for (const e of list) writer.submit(e.drillId, e.method, e.seconds);

        const reader = createBestTimesStore(storage);
        const expected = new Map(list.map((e) => [`${e.method}\u0000${e.drillId}`, e.seconds]));
        const actual = new Map(
          list.map((e) => [`${e.method}\u0000${e.drillId}`, reader.get(e.drillId, e.method)]),
        );
        expect(actual).toEqual(expected);
        expect(reader.persistent).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
