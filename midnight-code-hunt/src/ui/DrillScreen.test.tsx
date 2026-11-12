// Uses fictional fixtures only. Not real NEC content.
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FIXED, PROSE } from "../copy/strings";
import { CHAPTER_LABELS } from "../logic/chapters";
import { createBestTimesStore } from "../logic/bestTimes";
import { buildNamesIndex } from "../logic/displayName";
import type { DrillRecord } from "../model/types";
import {
  articleNoPartsDrill,
  indexSubdivisionDrill,
} from "../../test/fixtures/fixtureDrills";
import { createFakeClock } from "../../test/support/fakeClock";
import { DrillScreen } from "./DrillScreen";
import { BestTimesContext, ClockContext, NamesContext } from "./providers";
import { Shell } from "./Shell";

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});

function setup(drill: DrillRecord) {
  const clock = createFakeClock(1000);
  const store = createBestTimesStore(undefined);
  const onBack = vi.fn();
  const user = userEvent.setup();
  render(
    <ClockContext.Provider value={clock}>
      <BestTimesContext.Provider value={store}>
        <NamesContext.Provider value={names}>
          <Shell title="Midnight Code Hunt">
            <DrillScreen
              drillId={drill.def.id}
              entries={[{ drill, draft: false }]}
              buildMode="test"
              onBack={onBack}
            />
          </Shell>
        </NamesContext.Provider>
      </BestTimesContext.Provider>
    </ClockContext.Provider>,
  );
  const advance = (ms: number) => act(() => clock.advance(ms));
  return { clock, store, onBack, user, advance };
}

type User = ReturnType<typeof userEvent.setup>;

async function pick(user: User, group: string, name: string) {
  const g = screen.getAllByRole("group", { name: group }).at(-1)!;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await user.click(within(g).getByRole("button", { name: new RegExp(`^\\s*${esc}\\s*$`) }));
}

const checkButton = () => screen.getByRole("button", { name: FIXED.checkButton });
const timer = () => screen.getByTestId("timer").textContent;
const CH3 = CHAPTER_LABELS[2]!;

async function walkCorrect(user: User) {
  await pick(user, "Keyword", "Fictional widget spacing");
  await pick(user, "Chapter", CH3);
  await pick(user, "Article", "Article 377");
  await pick(user, "Section", "377.20");
}

async function walkWrongArticle(user: User) {
  await pick(user, "Keyword", "Fictional widget spacing");
  await pick(user, "Chapter", CH3);
  await pick(user, "Article", "Article 378");
}

describe("DrillScreen grading flow", () => {
  it("keeps Check disabled until the picks end a path", async () => {
    const { user } = setup(articleNoPartsDrill);
    expect(checkButton()).toBeDisabled();
    await pick(user, "Keyword", "Fictional widget spacing");
    await pick(user, "Chapter", CH3);
    await pick(user, "Article", "Article 377");
    expect(checkButton()).toBeDisabled();
    await pick(user, "Section", "377.20");
    expect(checkButton()).toBeEnabled();
  });

  it("shows a correct result and saves the best time on a correct check", async () => {
    const { user, store, advance } = setup(articleNoPartsDrill);
    await walkCorrect(user);
    advance(5000);
    await user.click(checkButton());

    expect(screen.getByText(FIXED.overallCorrect)).toBeInTheDocument();
    expect(screen.getByText(`${FIXED.elapsedLabel}: 0:05`)).toBeInTheDocument();
    expect(screen.getByText(PROSE.newBest)).toBeInTheDocument();
    expect(store.get(articleNoPartsDrill.def.id, "toc")).toBe(5);
  });

  it("shows an incorrect result and saves no best time for a wrong path", async () => {
    const { user, store } = setup(articleNoPartsDrill);
    await walkWrongArticle(user);
    await user.click(checkButton());

    expect(screen.getByText(FIXED.overallIncorrect)).toBeInTheDocument();
    expect(screen.queryByText(PROSE.newBest)).toBeNull();
    expect(store.get(articleNoPartsDrill.def.id, "toc")).toBeUndefined();
  });

  it("expires at 120 seconds with the time-up message and no best time", async () => {
    const { user, store, advance } = setup(articleNoPartsDrill);
    await pick(user, "Keyword", "Fictional widget spacing");
    advance(119_000);
    expect(timer()).toBe("0:01");
    expect(screen.queryByText(PROSE.timeRanOut)).toBeNull();
    advance(1000);

    expect(screen.getByText(PROSE.timeRanOut)).toBeInTheDocument();
    expect(screen.getByText(FIXED.overallIncorrect)).toBeInTheDocument();
    expect(screen.queryByText(PROSE.newBest)).toBeNull();
    expect(store.get(articleNoPartsDrill.def.id, "toc")).toBeUndefined();
    expect(store.get(articleNoPartsDrill.def.id, "index")).toBeUndefined();
  });

  it("clears picks but keeps the timer running when the method changes mid-drill", async () => {
    const { user, advance } = setup(indexSubdivisionDrill);
    expect(screen.getByRole("radio", { name: /Index Keyword Lookup/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await pick(user, "Keyword", "Fictional gadgets");
    advance(10_000);
    expect(timer()).toBe("1:50");

    await user.click(screen.getByRole("radio", { name: /Table of Contents Lookup/ }));
    expect(screen.getByRole("radio", { name: /Table of Contents Lookup/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(timer()).toBe("1:50");
    expect(
      within(screen.getByRole("group", { name: "Keyword" })).queryAllByRole("button", {
        pressed: true,
      }),
    ).toHaveLength(0);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Keyword",
    ]);
    expect(checkButton()).toBeDisabled();

    advance(5000);
    expect(timer()).toBe("1:45");
  });

  it("resets the timer to 2:00 and clears picks on Try again", async () => {
    const { user, advance } = setup(articleNoPartsDrill);
    await walkWrongArticle(user);
    advance(30_000);
    await user.click(checkButton());
    await user.click(screen.getByRole("button", { name: FIXED.tryAgainButton }));

    expect(timer()).toBe("2:00");
    expect(checkButton()).toBeDisabled();
    advance(1000);
    expect(timer()).toBe("1:59");
  });

  it("saves nothing when the user leaves after an incorrect result", async () => {
    const { user, store, onBack } = setup(articleNoPartsDrill);
    await walkWrongArticle(user);
    await user.click(checkButton());
    await user.click(screen.getByRole("button", { name: FIXED.backButton }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(store.get(articleNoPartsDrill.def.id, "toc")).toBeUndefined();
  });
});
