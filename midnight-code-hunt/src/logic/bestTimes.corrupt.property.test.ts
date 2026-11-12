import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  bestKey,
  createBestTimesStore,
  parseStoredSeconds,
  updateBest,
  type StorageLike,
} from './bestTimes';
import { arbStorage } from '../../test/support/arbitraries';

const seconds = fc.integer({ min: 0, max: 120 });

const corruptText = fc.oneof(
  fc.string({ maxLength: 40 }),
  fc.constantFrom('NaN', '-1', '-0.5', '{}', '[]', 'null', 'true', '"7"', '1e999', '', 'abc', '[5]'),
  fc.double({ noNaN: false }).map((d) => String(d)),
  fc.double({ noNaN: false }).map((d) => JSON.stringify(d)),
);

function oracle(raw: string): number | undefined {
  try {
    const v: unknown = JSON.parse(raw);
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

// Feature: midnight-code-hunt, Property 13: Corrupt or failing storage never breaks the store
// **Validates: Requirements 12.8, 12.9**
describe('Property 13: Corrupt or failing storage never breaks the store', () => {
  it('parseStoredSeconds returns a number only for JSON finite numbers >= 0', () => {
    fc.assert(
      fc.property(corruptText, (raw) => {
        const out = parseStoredSeconds(raw);
        expect(out).toBe(oracle(raw));
        if (out !== undefined) {
          expect(Number.isFinite(out)).toBe(true);
          expect(out).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 100 },
    );
    expect(parseStoredSeconds(null)).toBeUndefined();
  });

  it('a corrupt pair reads as no best time and other pairs are unaffected', () => {
    fc.assert(
      fc.property(corruptText, seconds, (raw, good) => {
        const items = new Map<string, string>([
          [bestKey('bad', 'index'), raw],
          [bestKey('ok', 'index'), JSON.stringify(good)],
        ]);
        const storage: StorageLike = {
          getItem: (k) => items.get(k) ?? null,
          setItem: (k, v) => void items.set(k, v),
        };
        const store = createBestTimesStore(storage);
        expect(store.get('ok', 'index')).toBe(good);
        expect(store.get('bad', 'index')).toBe(oracle(raw));
        expect(store.get('bad', 'toc')).toBeUndefined();
        expect(store.get('ok', 'index')).toBe(good);
        expect(store.persistent).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('get and submit never throw on any storage; results stay correct in memory; persistent is false after a throw', () => {
    fc.assert(
      fc.property(arbStorage, seconds, seconds, (storage, first, second) => {
        const key = bestKey('d1', 'toc');
        let prev: number | undefined;
        try {
          const raw = storage.getItem(key);
          prev = raw === null ? undefined : oracle(raw);
        } catch {
          prev = undefined;
        }

        const store = createBestTimesStore(storage);
        expect(() => store.get('d1', 'toc')).not.toThrow();
        expect(store.get('d1', 'toc')).toBe(prev);

        const out1 = store.submit('d1', 'toc', first);
        expect(out1.best).toBe(updateBest(prev, first));
        expect(out1.isNewBest).toBe(prev === undefined || first < prev);
        expect(store.get('d1', 'toc')).toBe(out1.best);

        const out2 = store.submit('d1', 'toc', second);
        expect(out2.best).toBe(Math.min(out1.best, second));
        expect(store.get('d1', 'toc')).toBe(out2.best);

        if (storage.kind === 'throws-on-read') {
          expect(store.persistent).toBe(false);
        } else if (storage.kind === 'throws-on-write') {
          // First submit writes only when it is a new best; with no prior value it must.
          if (out1.isNewBest || out2.isNewBest) expect(store.persistent).toBe(false);
        } else {
          expect(store.persistent).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('a missing storage behaves as in-memory only and is not persistent', () => {
    const store = createBestTimesStore(undefined);
    expect(store.persistent).toBe(false);
    expect(store.submit('d', 'index', 40).best).toBe(40);
    expect(store.get('d', 'index')).toBe(40);
  });
});
