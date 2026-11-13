// Uses fictional fixtures only. Not real NEC content.
// Focus, live region, radio, heading, target-size, and keyboard checks (Req 14, 15.3).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { articleWithPartsDrill, indexSubdivisionDrill } from "../../test/fixtures/fixtureDrills";
import {
  guidedAllWhyPartsDrill,
  guidedIndexClicksWhyDrill,
} from "../../test/fixtures/guidedDrills";
import { createFakeClock, type FakeClock } from "../../test/support/fakeClock";
import { SWITCHER_URL } from "../config";
import { AppView } from "../App";
import { ANNOUNCE, FIXED, PROSE } from "../copy/strings";
import { createBestTimesStore } from "../logic/bestTimes";
import { buildNamesIndex } from "../logic/displayName";
import { filterDrills } from "../logic/filterDrills";
import { METHOD_LABELS } from "../model/methods";
import { BestTimesContext, ClockContext, NamesContext } from "./providers";

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

const guidedEntries = filterDrills([guidedAllWhyPartsDrill, guidedIndexClicksWhyDrill], "test");

function setup(list: typeof entries = entries) {
  const clock: FakeClock = createFakeClock(0);
  const user = userEvent.setup();
  render(
    <ClockContext.Provider value={clock}>
      <BestTimesContext.Provider value={createBestTimesStore(memoryStorage())}>
        <NamesContext.Provider value={names}>
          <AppView entries={list} buildMode="test" />
        </NamesContext.Provider>
      </BestTimesContext.Provider>
    </ClockContext.Provider>,
  );
  return { clock, user };
}

const liveRegion = () => screen.getByRole("status");
const openFirst = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(
    screen.getByRole("button", {
      name: new RegExp(`${FIXED.modeTimed}.*${articleWithPartsDrill.def.label}`),
    }),
  );

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
    await user.click(screen.getByRole("button", { name: new RegExp(`${FIXED.modeTimed}.*${indexSubdivisionDrill.def.label}`) }));
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
    await user.tab(); // first drill's Guided button
    await user.tab(); // first drill's Timed button
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

// ---- Guided screen and Guided end screen (Req 19.14, 19.15, 21.2, 21.9, 22.8) ----

type User = ReturnType<typeof userEvent.setup>;

/** The Shell's polite region. The Guided verdict line is also a status, so query by aria-live. */
const polite = () => document.querySelector<HTMLElement>('[aria-live="polite"]')!;

const openGuided = (user: User, label: string) =>
  user.click(screen.getByRole("button", { name: new RegExp(`^${FIXED.modeGuided}\\b.*${label}`) }));

const PARTS_LABEL = guidedAllWhyPartsDrill.def.label;
const INDEX_LABEL = guidedIndexClicksWhyDrill.def.label;
const fullPathButton = () => screen.getByRole("button", { name: FIXED.showFullPathButton });

async function guidedWalkToPathEnd(user: User) {
  await pick(user, "Keyword", "Fictional gizmo wiring");
  await pick(user, "Chapter", "Ch 4 Use: equipment");
  await pick(user, "Article", "Article 481");
  await pick(user, "Part", "Part II");
  await pick(user, "Section", "481.12");
}

async function tabStops(user: User, max = 40): Promise<Element[]> {
  const seen: Element[] = [];
  for (let i = 0; i < max; i += 1) {
    await user.tab();
    const el = document.activeElement!;
    if (el === document.body || seen.includes(el)) break;
    seen.push(el);
  }
  return seen;
}

function expectDocumentOrder(stops: Element[]) {
  for (let i = 1; i < stops.length; i += 1) {
    expect(
      stops[i - 1]!.compareDocumentPosition(stops[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  }
}

describe("accessibility: Guided screen", () => {
  it("has one h1, no Check button, and natively disabled controls only (Req 19.14, 14.10, 14.11)", async () => {
    const { user } = setup(guidedEntries);
    await openGuided(user, PARTS_LABEL);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(PARTS_LABEL);
    expect(screen.queryByRole("button", { name: FIXED.checkButton })).toBeNull();
    expect(document.querySelectorAll('[aria-disabled="true"]')).toHaveLength(0);
    const stops = await tabStops(user);
    for (const el of stops) expect(el).not.toBeDisabled();
  });

  it("tabs in reading order through the Method choice and Options (Req 14.2, 19.15)", async () => {
    const { user } = setup(guidedEntries);
    await openGuided(user, PARTS_LABEL);
    const stops = await tabStops(user);
    expect(stops.length).toBeGreaterThan(0);
    expectDocumentOrder(stops);
    const keywordGroup = screen.getByRole("group", { name: "Keyword" });
    const optionButtons = within(keywordGroup).getAllByRole("button");
    for (const b of optionButtons) expect(stops).toContain(b);
    // Shift+Tab walks back the same way.
    (stops[stops.length - 1] as HTMLElement).focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(stops[stops.length - 2]);
  });

  it("accepts a pick with Enter, then another with Space (Req 14.1, 19.15)", async () => {
    const { user } = setup(guidedEntries);
    await openGuided(user, PARTS_LABEL);
    const kw = within(screen.getByRole("group", { name: "Keyword" })).getByRole("button", {
      name: /Fictional gizmo wiring/,
    });
    kw.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { level: 2, name: FIXED.stepChapter })).toHaveFocus();
    const ch = within(screen.getByRole("group", { name: "Chapter" })).getByRole("button", {
      name: /Ch 4 Use: equipment/,
    });
    ch.focus();
    await user.keyboard(" ");
    expect(screen.getByRole("heading", { level: 2, name: FIXED.stepArticle })).toHaveFocus();
  });

  it("moves focus to each next step heading after a correct pick (Req 14.5)", async () => {
    const { user } = setup(guidedEntries);
    await openGuided(user, PARTS_LABEL);
    await pick(user, "Keyword", "Fictional gizmo wiring");
    expect(screen.getByRole("heading", { level: 2, name: FIXED.stepChapter })).toHaveFocus();
    await pick(user, "Chapter", "Ch 4 Use: equipment");
    expect(screen.getByRole("heading", { level: 2, name: FIXED.stepArticle })).toHaveFocus();
    await pick(user, "Article", "Article 481");
    expect(screen.getByRole("heading", { level: 2, name: FIXED.stepPart })).toHaveFocus();
    await pick(user, "Part", "Part II");
    expect(screen.getByRole("heading", { level: 2, name: FIXED.stepSection })).toHaveFocus();
  });

  it("moves focus to the second Index group after the first Index click (Req 14.5)", async () => {
    const { user } = setup(guidedEntries);
    await openGuided(user, INDEX_LABEL);
    await pick(user, "Keyword", "Fictional gadgets");
    expect(screen.getByRole("heading", { level: 2, name: FIXED.stepIndex })).toHaveFocus();
    await pick(user, FIXED.indexEntryGroup, "Gadgets, spare, 555.4");
    expect(screen.getByRole("group", { name: FIXED.indexNumberGroup })).toHaveFocus();
  });

  it("moves focus to 'Show the full path' when the path ends (Req 19.9)", async () => {
    const { user } = setup(guidedEntries);
    await openGuided(user, PARTS_LABEL);
    await guidedWalkToPathEnd(user);
    expect(fullPathButton()).toBeEnabled();
    expect(fullPathButton()).toHaveFocus();
  });

  it("keeps focus on the Option after an incorrect pick (Req 19.7)", async () => {
    const { user } = setup(guidedEntries);
    await openGuided(user, PARTS_LABEL);
    await pick(user, "Keyword", "Fictional gizmo wiring");
    const group = screen.getByRole("group", { name: "Chapter" });
    const wrong = within(group)
      .getAllByRole("button")
      .find((b) => !/Ch 4 Use: equipment/.test(b.textContent ?? ""))!;
    await user.click(wrong);
    expect(wrong).toHaveFocus();
    expect(wrong).toBeEnabled();
    expect(screen.getByRole("heading", { level: 2, name: FIXED.stepChapter })).not.toHaveFocus();
    // Enter on the same Option keeps focus there too.
    await user.keyboard("{Enter}");
    expect(wrong).toHaveFocus();
  });

  it("posts the verdict of each pick to the live region (Req 19.4, 22.8)", async () => {
    const { user } = setup(guidedEntries);
    await openGuided(user, PARTS_LABEL);
    expect(polite()).toHaveTextContent("");
    await pick(user, "Keyword", "Fictional gizmo wiring");
    expect(polite()).toHaveTextContent(PROSE.guidedCorrectLine);
    expect(polite()).toHaveTextContent("Made-up reason: the fictional keyword");
    const group = screen.getByRole("group", { name: "Chapter" });
    const wrong = within(group)
      .getAllByRole("button")
      .find((b) => !/Ch 4 Use: equipment/.test(b.textContent ?? ""))!;
    await user.click(wrong);
    expect(polite()).toHaveTextContent(PROSE.guidedPickAgain);
  });

  it("gives every Guided button a 44px target class (Req 13.1, 19.15)", async () => {
    const { user } = setup(guidedEntries);
    await openGuided(user, PARTS_LABEL);
    await guidedWalkToPathEnd(user);
    for (const el of document.querySelectorAll<HTMLElement>("button, a[href]")) {
      expect(el.className, el.textContent ?? "").toContain("min-h-[44px]");
      expect(el.className, el.textContent ?? "").toContain("min-w-[44px]");
    }
  });
});

describe("accessibility: Guided end screen", () => {
  async function toEndScreen(user: User) {
    await openGuided(user, PARTS_LABEL);
    await guidedWalkToPathEnd(user);
    await user.keyboard(" "); // Space on the focused "Show the full path"
  }

  it("opens with Space, one h1, focus on it (Req 21.2, 14.10)", async () => {
    const { user } = setup(guidedEntries);
    await toEndScreen(user);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(FIXED.guidedEndHeading);
    expect(headings[0]).toHaveFocus();
  });

  it("posts the path-complete text to the live region (Req 21.2)", async () => {
    const { user } = setup(guidedEntries);
    await toEndScreen(user);
    expect(polite()).toHaveTextContent(ANNOUNCE.guidedDone);
  });

  it("opens with Enter as well (Req 14.1)", async () => {
    const { user } = setup(guidedEntries);
    await openGuided(user, PARTS_LABEL);
    await guidedWalkToPathEnd(user);
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("tabs link, Run Timed, then Back, with only native controls (Req 21.9, 14.2)", async () => {
    const { user } = setup(guidedEntries);
    await toEndScreen(user);
    expect(document.querySelectorAll('[aria-disabled="true"]')).toHaveLength(0);
    const stops = await tabStops(user);
    expect(stops).toHaveLength(3);
    expect(stops[0]!.tagName).toBe("A");
    expect(stops[1]).toBe(screen.getByRole("button", { name: FIXED.runTimedButton }));
    expect(stops[2]).toBe(screen.getByRole("button", { name: FIXED.backButton }));
    expectDocumentOrder(stops);
    for (const el of stops) expect(el).not.toBeDisabled();
  });

  it("runs the drill Timed with Enter and goes back with Space (Req 21.6, 14.1)", async () => {
    const first = setup(guidedEntries);
    await toEndScreen(first.user);
    screen.getByRole("button", { name: FIXED.runTimedButton }).focus();
    await first.user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(PARTS_LABEL);
    expect(screen.getByTestId("timer")).toBeInTheDocument();
  });

  it("goes back to the picker with Space (Req 14.1)", async () => {
    const { user } = setup(guidedEntries);
    await toEndScreen(user);
    screen.getByRole("button", { name: FIXED.backButton }).focus();
    await user.keyboard(" ");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(FIXED.pickerHeading);
  });
});
