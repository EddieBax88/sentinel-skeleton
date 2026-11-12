/** Length of one drill attempt, in seconds. */
export const TIME_LIMIT_SECONDS = 120;

/** Injected time source. nowMs must be monotonic (performance.now in production). */
export interface Clock {
  nowMs(): number;
  /** Calls cb every `ms` milliseconds; returns a cancel function. */
  setInterval(cb: () => void, ms: number): () => void;
}

/** Production clock: performance.now() and window.setInterval. */
export const systemClock: Clock = {
  nowMs: () => performance.now(),
  setInterval: (cb, ms) => {
    const id = window.setInterval(cb, ms);
    return () => window.clearInterval(id);
  },
};

/**
 * Whole seconds left, rounded up from the monotonic difference and clamped
 * to 0..limit. Never derived from tick counts.
 */
export function remainingSeconds(
  startMs: number,
  nowMs: number,
  limit: number = TIME_LIMIT_SECONDS,
): number {
  const raw = Math.ceil((limit * 1000 - (nowMs - startMs)) / 1000);
  if (Number.isNaN(raw)) return 0;
  return Math.min(limit, Math.max(0, raw));
}

/** Elapsed whole seconds: limit minus the remaining whole seconds. */
export function elapsedSeconds(
  remaining: number,
  limit: number = TIME_LIMIT_SECONDS,
): number {
  return limit - remaining;
}

/** Formats whole seconds (integer >= 0) as m:ss. */
export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

/** Inverse of formatTime; null when the text is not m:ss. */
export function parseTime(text: string): number | null {
  const match = /^(\d+):([0-5]\d)$/.exec(text);
  if (match === null) return null;
  const total = Number(match[1]) * 60 + Number(match[2]);
  return Number.isSafeInteger(total) ? total : null;
}

export type AnnounceThreshold = 60 | 30 | 10 | 0;

const THRESHOLDS_ASCENDING: readonly AnnounceThreshold[] = [0, 10, 30, 60];

/**
 * Smallest threshold t with prevRemaining > t >= nextRemaining, else null.
 */
export function announcementFor(
  prevRemaining: number,
  nextRemaining: number,
): AnnounceThreshold | null {
  for (const t of THRESHOLDS_ASCENDING) {
    if (prevRemaining > t && t >= nextRemaining) return t;
  }
  return null;
}
