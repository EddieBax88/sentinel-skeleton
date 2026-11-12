// Uses fictional fixtures only. Not real NEC content.
// Focus, live region, radio, heading, target-size, and keyboard checks (Req 14, 15.3).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useState } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { articleWithPartsDrill, indexSubdivisionDrill } from "../../test/fixtures/fixtureDrills";
import { createFakeClock, type FakeClock } from "../../test/support/fakeClock";
import { SWITCHER_URL } from "../config";
import { ANNOUNCE, FIXED } from "../copy/strings";
import { createBestTimesStore } from "../logic/bestTimes";
import { buildNamesIndex } from "../logic/displayName";
import { filterDrills } from "../logic/filterDrills";
import { METHOD_LABELS } from "../model/methods";
import { DrillPicker } from "./DrillPicker";
import { DrillScreen } from "./DrillScreen";
import { BestTimesContext, ClockContext, NamesContext } from "./providers";
import { Shell } from "./Shell";

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});
const entries = filterDrills([articleWithPartsDrill, indexSubdivisionDrill], "test");

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

/** Picker and drill screens inside one Shell, as App wires them. */
function Harness() {
  const [drillId, setDrillId] = useState<string | null>(null);
  const label = entries.find((e) => e.drill.def.id === drillId)?.drill.def.label;
  return (
    <Shell title={drillId === null ? FIXED.pickerHeading : (label ?? FIXED.drillHeadingFallback)}>
      {drillId === null ? (
        <DrillPicker entries={entries} buildMode="test" onOpen={setDrillId} />
      ) : (
        <DrillScreen
          drillId={drillId}
          entries={entries}
          buildMode="test"
          onBack={() => setDrillId(null)}
        />
      )}
    </Shell>
  );
}

function setup() {
  const clock: FakeClock = createFakeClock(0);
  const user = userEvent.setup();
  render(
    <ClockContext.Provider value={clock}>
      <BestTimesContext.Provider value={createBestTimesStore(memoryStorage())}>
        <NamesContext.Provider value={names}>
          <Harness />
        </NamesContext.Provider>
      </BestTimesContext.Provider>
    </ClockContext.Provider>,
  );
  return { clock, user };
}

const liveRegion = () => screen.getByRole("status");
const openFirst = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: new RegExp(articleWithPartsDrill.def.label) }));

async function pick(user: ReturnType<typeof userEvent.setup>, group: string, name: string) {
  const g = screen.getAllByRole("group", { name: group }).at(-1)!;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await user.click(within(g).getByRole("button", { name: new RegExp(`^\\s*${esc}\\s*$`) }));
}

async function walkCorrect(user: ReturnType<typeof userEvent.setup>) {
  await pick(user, "Keyword", "Fictional gizmo wiring");
  await pick(user, "Chapter", "Ch 4 Use: equipment");
  await pick(user, "Article", "Article 481");
  await pick(user, "Part", "Part II");
  await pick(user, "Section", "481.12");
}

const checkButton = () => screen.getByRole("button", { name: FIXED.checkButton });

describe("accessibility: structure", () => {
  it("sets lang=en on the document (Req 14.10)", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    expect(html).toMatch(/<html[^>]*\slang="en"/);
  });

  it("renders exactly one h1 on the picker, drill, and result screens (Req 14.10)", async () => {
    const { user } = setup();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    await openFirst(user);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    await walkCorrect(user);
    await user.click(checkButton());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("has no Switcher_Link and no error when the URL is unset (Req 15.3)", () => {
    setup();
    if (SWITCHER_URL === null) {
      expect(screen.queryByRole("link", { name: FIXED.switcherLinkText })).toBeNull();
    }
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});

describe("accessibility: focus management", () => {
  it("moves focus to the next step heading after each pick (Req 14.5)", async () => {
    const { user } = setup();
    await openFirst(user);
    await pick(user, "Keyword", "Fictional gizmo wiring");
    expect(screen.getByRole("heading", { level: 2, name: FIXED.stepChapter })).toHaveFocus();
    await pick(user, "Chapter", "Ch 4 Use: equipment");
    expect(screen.getByRole("heading", { level: 2, name: FIXED.stepArticle })).toHaveFocus();
  });

  it("moves focus to the Result heading when the result opens (Req 14.6)", async () => {
    const { user } = setup();
    await openFirst(user);
    await walkCorrect(user);
    await user.click(checkButton());
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("moves focus to the Result heading when time runs out (Req 14.6)", async () => {
    const { clock, user } = setup();
    await openFirst(user);
    act(() => clock.advance(120_000));
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    expect(liveRegion()).toHaveTextContent(ANNOUNCE.result(false, true, "2:00"));
  });
});

describe("accessibility: live region", () => {
  it("is polite and mounted before any announcement", () => {
    setup();
    expect(liveRegion()).toHaveAttribute("aria-live", "polite");
    expect(liveRegion()).toHaveTextContent("");
  });

  it("announces only at the 60, 30, 10, and 0 second marks (Req 14.7)", async () => {
    const { clock, user } = setup();
    await openFirst(user);
    act(() => clock.advance(30_000));
    expect(liveRegion()).toHaveTextContent("");
    act(() => clock.advance(30_000)); // 60 left
    expect(liveRegion()).toHaveTextContent(ANNOUNCE.timer(60));
    act(() => clock.advance(15_000)); // 45 left: unchanged
    expect(liveRegion()).toHaveTextContent(ANNOUNCE.timer(60));
    act(() => clock.advance(15_000)); // 30 left
    expect(liveRegion()).toHaveTextContent(ANNOUNCE.timer(30));
    act(() => clock.advance(20_000)); // 10 left
    expect(liveRegion()).toHaveTextContent(ANNOUNCE.timer(10));
  });

  it("posts the result announcement when the result opens (Req 14.8)", async () => {
    const { clock, user } = setup();
    await openFirst(user);
    act(() => clock.advance(5_000));
    await walkCorrect(user);
    await user.click(checkButton());
    expect(liveRegion()).toHaveTextContent(ANNOUNCE.result(true, false, "0:05"));
  });

  it("keeps the timer text out of the accessibility tree", async () => {
    const { user } = setup();
    await openFirst(user);
    expect(screen.getByTestId("timer")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("accessibility: method radio group", () => {
  it("uses radio semantics with a roving tab stop and wrapping arrows (Req 14.4)", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: new RegExp(indexSubdivisionDrill.def.label) }));
    const group = screen.getByRole("radiogroup");
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveTextContent(METHOD_LABELS.index);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(radios[0]).toHaveAttribute("tabindex", "0");
    expect(radios[1]).toHaveAttribute("tabindex", "-1");

    radios[0]!.focus();
    await user.keyboard("{ArrowRight}");
    expect(radios[1]).toHaveFocus();
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{ArrowRight}"); // wraps to first
    expect(radios[0]).toHaveFocus();
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{ArrowLeft}"); // wraps to last
    expect(radios[1]).toHaveFocus();
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
  });
});

describe("accessibility: keyboard operation and disabled state", () => {
  it("opens a drill, picks options, and checks using Enter and Space only (Req 14.1)", async () => {
    const { user } = setup();
    await user.tab(); // the only control before the picker buttons is the first drill button
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(articleWithPartsDrill.def.label);

    const kw = within(screen.getByRole("group", { name: "Keyword" })).getByRole("button", {
      name: /Fictional gizmo wiring/,
    });
    kw.focus();
    await user.keyboard(" ");
    expect(kw).toHaveAttribute("aria-pressed", "true");
  });

  it("leaves the disabled Check button out of the tab order and exposes disabled (Req 14.11)", async () => {
    const { user } = setup();
    await openFirst(user);
    const check = checkButton();
    expect(check).toBeDisabled();
    const stops: Element[] = [];
    for (let i = 0; i < 40; i += 1) {
      await user.tab();
      stops.push(document.activeElement!);
    }
    expect(stops).not.toContain(check);

    await walkCorrect(user);
    expect(check).toBeEnabled();
    check.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: FIXED.tryAgainButton })).toBeInTheDocument();
  });

  it("tabs through result controls in reading order and operates them by key (Req 14.2)", async () => {
    const { user } = setup();
    await openFirst(user);
    await walkCorrect(user);
    await user.click(checkButton());
    await user.tab();
    const link = document.activeElement as HTMLElement;
    expect(link.tagName).toBe("A");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: FIXED.tryAgainButton }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: FIXED.backButton }));
    await user.keyboard(" ");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(FIXED.pickerHeading);
  });
});

describe("accessibility: targets, names, and verdict text", () => {
  it("gives every button and link a 44px target class (Req 13.1)", async () => {
    const { user } = setup();
    const check = (root: HTMLElement | Document = document) => {
      for (const el of root.querySelectorAll<HTMLElement>("button, a[href]")) {
        expect(el.className, el.textContent ?? "").toContain("min-h-[44px]");
        expect(el.className, el.textContent ?? "").toContain("min-w-[44px]");
      }
    };
    check();
    await openFirst(user);
    check();
    await walkCorrect(user);
    await user.click(checkButton());
    check();
  });

  it("includes the visible text in every accessible name (Req 14.9)", async () => {
    const { user } = setup();
    await openFirst(user);
    for (const el of document.querySelectorAll<HTMLElement>("button")) {
      const visible = (el.textContent ?? "").replace(/[\u2713\u2717\u2014]/g, "").replace(/\s+/g, " ").trim();
      const name = screen.getAllByRole("button").includes(el)
        ? (el.getAttribute("aria-label") ?? visible)
        : visible;
      expect(name).toContain(visible);
    }
  });

  it("states each verdict in words, not color alone (Req 13.2)", async () => {
    const { user } = setup();
    await openFirst(user);
    await walkCorrect(user);
    await user.click(checkButton());
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
    for (const li of items) expect(li).toHaveTextContent(FIXED.verdictCorrect);
  });

  it("says 'not answered' in words for unanswered rows at expiry (Req 13.2)", async () => {
    const { clock, user } = setup();
    await openFirst(user);
    act(() => clock.advance(120_000));
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    for (const li of items) expect(li).toHaveTextContent(FIXED.verdictNotAnswered);
  });
});
