// Uses fictional fixtures only. Not real NEC content.
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The Switcher_Link reads SWITCHER_URL from config; let each test set it.
const cfg = vi.hoisted(() => ({ url: null as string | null }));
vi.mock("../config", () => ({
  get SWITCHER_URL() {
    return cfg.url;
  },
  BUILD_MODE: "test",
}));

import { AppView } from "../App";
import { FIXED, FOOTER_DISCLAIMER } from "../copy/strings";
import { bestKey, createBestTimesStore, type StorageLike } from "../logic/bestTimes";
import { CHAPTER_LABELS } from "../logic/chapters";
import { buildNamesIndex } from "../logic/displayName";
import { guidedKeywordSectionWhyDrill as drill } from "../../test/fixtures/guidedDrills";
import { createFakeClock } from "../../test/support/fakeClock";
import { BestTimesContext, ClockContext, NamesContext } from "./providers";

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});

const SWITCHER = "https://example.test/dead-circuit-check";

function countingStorage() {
  const data = new Map<string, string>();
  const setItem = vi.fn((k: string, v: string) => void data.set(k, v));
  const getItem = vi.fn((k: string) => data.get(k) ?? null);
  const storage = { getItem, setItem } as StorageLike;
  return { storage, setItem, getItem };
}

function setup() {
  const clock = createFakeClock(1000);
  const counting = countingStorage();
  const store = createBestTimesStore(counting.storage);
  const user = userEvent.setup();
  render(
    <ClockContext.Provider value={clock}>
      <BestTimesContext.Provider value={store}>
        <NamesContext.Provider value={names}>
          <AppView entries={[{ drill, draft: false }]} buildMode="test" />
        </NamesContext.Provider>
      </BestTimesContext.Provider>
    </ClockContext.Provider>,
  );
  return { ...counting, user, advance: (ms: number) => act(() => clock.advance(ms)) };
}

type User = ReturnType<typeof userEvent.setup>;

async function pick(user: User, group: string, name: string) {
  const g = screen.getAllByRole("group", { name: group }).at(-1)!;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await user.click(within(g).getByRole("button", { name: new RegExp(`^\\s*${esc}\\s*$`) }));
}

async function walkToc(user: User) {
  await pick(user, "Keyword", "Fictional gadgets");
  await pick(user, "Chapter", CHAPTER_LABELS[4]!);
  await pick(user, "Article", "Article 555");
  await pick(user, "Section", "555.4");
  await pick(user, "Section", "555.4(B)");
  await pick(user, "Section", "555.4(B)(2)");
}

const modeButton = (mode: string) =>
  screen.getByRole("button", { name: new RegExp(`^${mode}\\b`) });
const radio = (re: RegExp) => screen.getByRole("radio", { name: re });
const TOC = /Table of Contents Lookup/;
const onPicker = () =>
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(FIXED.pickerHeading);
const backToPicker = async (user: User) => {
  await user.click(screen.getByRole("button", { name: FIXED.backButton }));
  onPicker();
};
const toEndScreen = async (user: User) => {
  await user.click(modeButton("Guided"));
  await user.click(radio(TOC));
  await walkToc(user);
  await user.click(screen.getByRole("button", { name: FIXED.showFullPathButton }));
  expect(screen.getByRole("region", { name: FIXED.guidedEndHeading })).toBeInTheDocument();
};

beforeEach(() => {
  cfg.url = null;
});

describe("App Guided flow: storage", () => {
  it("picker to Guided to end screen writes no item", async () => {
    const { user, setItem } = setup();
    await toEndScreen(user);
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("App Guided flow: run this drill Timed", () => {
  it("opens the same drill and Method at 2:00", async () => {
    const { user } = setup();
    await toEndScreen(user);
    await user.click(screen.getByRole("button", { name: FIXED.runTimedButton }));

    expect(screen.getByRole("region", { name: drill.def.label })).toBeInTheDocument();
    expect(screen.getByTestId("timer")).toHaveTextContent("2:00");
    expect(radio(TOC)).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: FIXED.checkButton })).toBeInTheDocument();
  });

  it("a correct, checked Timed attempt then saves a best time", async () => {
    const { user, setItem, advance } = setup();
    await toEndScreen(user);
    await user.click(screen.getByRole("button", { name: FIXED.runTimedButton }));
    expect(setItem).not.toHaveBeenCalled();

    advance(5000);
    await walkToc(user);
    await user.click(screen.getByRole("button", { name: FIXED.checkButton }));

    expect(screen.getByText(FIXED.overallCorrect)).toBeInTheDocument();
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem.mock.calls[0]![0]).toBe(bestKey(drill.def.id, "toc"));

    await backToPicker(user);
    expect(screen.getByText(new RegExp(`${FIXED.bestTimeLabel} 0:05`))).toBeInTheDocument();
  });

  it("an incorrect Timed attempt does not save a best time", async () => {
    const { user, setItem } = setup();
    await user.click(modeButton("Timed"));
    await user.click(radio(TOC));
    await pick(user, "Keyword", "Fictional gadgets");
    await pick(user, "Chapter", CHAPTER_LABELS[0]!); // wrong Chapter
    await user.click(screen.getByRole("button", { name: FIXED.checkButton }));

    expect(screen.getByText(FIXED.overallIncorrect)).toBeInTheDocument();
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("App Guided flow: Back to drills", () => {
  // The in-run Guided and Timed screens have no Back button (it lives on the end
  // and result screens), so those are the screens covered here.
  it("returns to the picker from the Guided end screen", async () => {
    const { user } = setup();
    await toEndScreen(user);
    await backToPicker(user);
  });

  it("returns to the picker from the Timed result screen opened from Guided", async () => {
    const { user } = setup();
    await toEndScreen(user);
    await user.click(screen.getByRole("button", { name: FIXED.runTimedButton }));
    await walkToc(user);
    await user.click(screen.getByRole("button", { name: FIXED.checkButton }));
    await backToPicker(user);
  });
});

describe("App Guided flow: Switcher_Link and footer", () => {
  it("show the link and the footer on the Guided screen and the end screen", async () => {
    cfg.url = SWITCHER;
    const { user } = setup();
    await user.click(modeButton("Guided"));
    expect(screen.getByRole("link", { name: FIXED.switcherLinkText })).toHaveAttribute(
      "href",
      SWITCHER,
    );
    expect(screen.getByText(FOOTER_DISCLAIMER)).toBeInTheDocument();

    await user.click(radio(TOC));
    await walkToc(user);
    await user.click(screen.getByRole("button", { name: FIXED.showFullPathButton }));
    expect(screen.getByRole("region", { name: FIXED.guidedEndHeading })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: FIXED.switcherLinkText })).toHaveAttribute(
      "href",
      SWITCHER,
    );
    expect(screen.getByText(FOOTER_DISCLAIMER)).toBeInTheDocument();
  });

  it("show no link when the switcher URL is unset, but still show the footer", async () => {
    const { user } = setup();
    await user.click(modeButton("Guided"));
    expect(screen.queryByRole("link", { name: FIXED.switcherLinkText })).toBeNull();
    expect(screen.getByText(FOOTER_DISCLAIMER)).toBeInTheDocument();
  });
});
