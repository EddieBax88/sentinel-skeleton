import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ANNOUNCE } from "../copy/strings";
import type { Clock } from "../logic/timer";
import { createFakeClock } from "../../test/support/fakeClock";
import { TimerDisplay } from "./TimerDisplay";
import { AnnouncerContext, ClockContext } from "./providers";

function setup(opts: { clock?: Clock; active?: boolean } = {}) {
  const fake = createFakeClock(5000);
  const clock = opts.clock ?? fake;
  const announce = vi.fn<(message: string) => void>();
  const onTick = vi.fn<(nowMs: number) => void>();
  const startedAtMs = clock.nowMs();
  const ui = (active: boolean) => (
    <ClockContext.Provider value={clock}>
      <AnnouncerContext.Provider value={announce}>
        <TimerDisplay startedAtMs={startedAtMs} active={active} onTick={onTick} />
      </AnnouncerContext.Provider>
    </ClockContext.Provider>
  );
  const view = render(ui(opts.active ?? true));
  const advance = (ms: number) => act(() => fake.advance(ms));
  const text = () => screen.getByTestId("timer").textContent;
  return { fake, announce, onTick, view, ui, advance, text };
}

describe("TimerDisplay", () => {
  it("starts at 2:00 and is hidden from assistive tech", () => {
    const { text } = setup();
    expect(text()).toBe("2:00");
    expect(screen.getByTestId("timer")).toHaveAttribute("aria-hidden", "true");
  });

  it("changes after each 1000 ms advance and not before", () => {
    const { advance, text } = setup();
    advance(750);
    expect(text()).toBe("2:00");
    advance(250);
    expect(text()).toBe("1:59");
    advance(1000);
    expect(text()).toBe("1:58");
  });

  it("dispatches onTick only on whole-second changes, with the clock reading", () => {
    const { advance, onTick } = setup();
    advance(1000);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(onTick).toHaveBeenLastCalledWith(6000);
  });

  it("shows m:ss at 61, 60, 9, and 0 seconds", () => {
    const { advance, text } = setup();
    advance(59_000);
    expect(text()).toBe("1:01");
    advance(1000);
    expect(text()).toBe("1:00");
    advance(51_000);
    expect(text()).toBe("0:09");
    advance(9000);
    expect(text()).toBe("0:00");
  });

  it("announces only at 60, 30, 10, and 0 seconds left", () => {
    const { advance, announce } = setup();
    for (let i = 0; i < 120; i++) advance(1000);
    expect(announce.mock.calls.map((c) => c[0])).toEqual([
      ANNOUNCE.timer(60),
      ANNOUNCE.timer(30),
      ANNOUNCE.timer(10),
      ANNOUNCE.timer(0),
    ]);
  });

  it("stays at 0:00 after expiry without further announcements", () => {
    const { advance, announce, text } = setup();
    advance(120_000);
    expect(text()).toBe("0:00");
    const calls = announce.mock.calls.length;
    advance(10_000);
    expect(text()).toBe("0:00");
    expect(announce).toHaveBeenCalledTimes(calls);
  });

  it("recomputes from the clock after a hidden-tab jump and announces one threshold", () => {
    const fake = createFakeClock(5000);
    let skew = 0;
    const clock: Clock = {
      nowMs: () => fake.nowMs() + skew,
      setInterval: (cb, ms) => fake.setInterval(cb, ms),
    };
    const { announce, text } = setup({ clock });
    skew = 100_000; // timers were throttled; the clock moved on
    act(() => fake.advance(250));
    expect(text()).toBe("0:20");
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(ANNOUNCE.timer(30));
  });

  it("stops polling and ticking when no longer active", () => {
    const { advance, onTick, announce, ui, view, text } = setup();
    advance(2000);
    expect(text()).toBe("1:58");
    const ticks = onTick.mock.calls.length;
    view.rerender(ui(false));
    advance(70_000);
    expect(text()).toBe("1:58");
    expect(onTick).toHaveBeenCalledTimes(ticks);
    expect(announce).not.toHaveBeenCalled();
  });
});
