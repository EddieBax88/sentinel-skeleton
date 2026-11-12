import type { Clock } from "../../src/logic/timer";

export interface FakeClock extends Clock {
  /**
   * Moves nowMs forward by ms and synchronously fires every interval that
   * comes due, in time order. While a callback runs, nowMs reads the moment
   * that interval was due.
   */
  advance(ms: number): void;
}

interface Entry {
  cb: () => void;
  every: number;
  nextDue: number;
  active: boolean;
}

/** Deterministic Clock for tests; never waits in real time. */
export function createFakeClock(startMs = 0): FakeClock {
  let now = startMs;
  const entries: Entry[] = [];

  return {
    nowMs: () => now,

    setInterval(cb, ms) {
      const every = Math.max(1, ms);
      const entry: Entry = { cb, every, nextDue: now + every, active: true };
      entries.push(entry);
      return () => {
        entry.active = false;
        const i = entries.indexOf(entry);
        if (i >= 0) entries.splice(i, 1);
      };
    },

    advance(ms) {
      if (!(ms >= 0)) throw new RangeError("advance(ms) requires ms >= 0");
      const target = now + ms;
      for (;;) {
        let next: Entry | undefined;
        for (const e of entries) {
          if (e.active && e.nextDue <= target && (!next || e.nextDue < next.nextDue)) {
            next = e;
          }
        }
        if (!next) break;
        now = next.nextDue;
        next.nextDue += next.every;
        next.cb();
      }
      now = target;
    },
  };
}
