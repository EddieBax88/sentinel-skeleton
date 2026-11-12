import { useEffect, useRef, useState } from "react";
import { ANNOUNCE } from "../copy/strings";
import { announcementFor, formatTime, remainingSeconds } from "../logic/timer";
import { useAnnouncer, useClock } from "./providers";

/** How often the clock is polled, in milliseconds. */
export const POLL_MS = 250;

/**
 * Polls the injected Clock and returns the whole seconds left. State changes
 * (and so re-renders) only when the whole-second value changes. While active,
 * each change dispatches TICK with the clock reading, and the live region is
 * told only at the 60, 30, 10, and 0 second marks. Inactive stops polling.
 */
export function useCountdown(
  startedAtMs: number,
  active: boolean,
  onTick: (nowMs: number) => void,
): number {
  const clock = useClock();
  const announce = useAnnouncer();
  const [remaining, setRemaining] = useState(() =>
    remainingSeconds(startedAtMs, clock.nowMs()),
  );

  const onTickRef = useRef(onTick);
  const announceRef = useRef(announce);
  useEffect(() => {
    onTickRef.current = onTick;
    announceRef.current = announce;
  });

  useEffect(() => {
    if (!active) return undefined;
    let last = remainingSeconds(startedAtMs, clock.nowMs());
    setRemaining(last);
    const cancel = clock.setInterval(() => {
      const nowMs = clock.nowMs();
      const next = remainingSeconds(startedAtMs, nowMs);
      if (next === last) return;
      const threshold = announcementFor(last, next);
      last = next;
      setRemaining(next);
      onTickRef.current(nowMs);
      if (threshold !== null) announceRef.current(ANNOUNCE.timer(threshold));
    }, POLL_MS);
    return cancel;
  }, [clock, startedAtMs, active]);

  return remaining;
}

export interface TimerDisplayProps {
  /** Clock reading taken when the attempt started. */
  startedAtMs: number;
  /** True while the attempt is running; false stops the countdown. */
  active: boolean;
  /** Receives the clock reading for the TICK event. */
  onTick: (nowMs: number) => void;
}

/** Visible m:ss text; hidden from assistive tech to avoid per-second speech. */
export function TimerDisplay({ startedAtMs, active, onTick }: TimerDisplayProps) {
  const remaining = useCountdown(startedAtMs, active, onTick);
  return (
    <p aria-hidden="true" className="font-mono text-2xl tabular-nums" data-testid="timer">
      {formatTime(remaining)}
    </p>
  );
}
