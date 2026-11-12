// Uses fictional fixtures only. Not real NEC content.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FIXED } from "../copy/strings";
import { CHAPTER_LABELS } from "../logic/chapters";
import { createBestTimesStore } from "../logic/bestTimes";
import { filterDrills } from "../logic/filterDrills";
import { twoKeywordDrill } from "../../test/fixtures/fixtureDrills";
import { createFakeClock } from "../../test/support/fakeClock";
import { DrillScreen } from "./DrillScreen";
import { BestTimesContext, ClockContext } from "./providers";
import { Shell } from "./Shell";

const entries = filterDrills([twoKeywordDrill], "test");
const drillId = twoKeywordDrill.def.id;

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

function setup() {
  const clock = createFakeClock(0);
  const store = createBestTimesStore(memoryStorage());
  const user = userEvent.setup();
  render(
    <ClockContext.Provider value={clock}>
      <BestTimesContext.Provider value={store}>
        <Shell title="Midnight Code Hunt">
          <DrillScreen drillId={drillId} entries={entries} buildMode="test" onBack={() => {}} />
        </Shell>
      </BestTimesContext.Provider>
    </ClockContext.Provider>,
  );
  return { clock, store, user };
}

type User = ReturnType<typeof userEvent.setup>;

async function pick(user: User, group: string, name: string) {
  const g = screen.getAllByRole("group", { name: group }).at(-1)!;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await user.click(within(g).getByRole("button", { name: new RegExp(`^\\s*${esc}\\s*$`) }));
}

const TRAIL_A = {
  keyword: "Fictional flange",
  chapter: CHAPTER_LABELS[1],
  article: "Article 211",
  section: "211.3",
};
const TRAIL_B = {
  keyword: "Fictional bracket",
  chapter: CHAPTER_LABELS[6],
  article: "Article 711",
  section: "711.8",
};

/**
 * Picks the keyword of one trail, then the steps of another. When the trails differ, the
 * chapter of the other trail is a wrong branch under this keyword and ends the path there,
 * so no further steps are offered.
 */
async function walk(user: User, keyword: typeof TRAIL_A, steps: typeof TRAIL_A) {
  await pick(user, "Keyword", keyword.keyword);
  await pick(user, "Chapter", steps.chapter);
  if (keyword !== steps) return;
  await pick(user, "Article", steps.article);
  await pick(user, "Section", steps.section);
}

async function check(user: User, clock: ReturnType<typeof createFakeClock>) {
  clock.advance(5000);
  await user.click(screen.getByRole("button", { name: FIXED.checkButton }));
}

const rows = () => within(screen.getByRole("list")).getAllByRole("listitem");
const rowFor = (title: string) => {
  const found = rows().find((li) => li.firstElementChild?.textContent === title);
  if (found === undefined) throw new Error(`No row titled ${title}`);
  return found;
};

describe("DrillScreen with two valid trails of one method", () => {
  it("is incorrect, with a correct Keyword row and no best time, for keyword A with the steps of B", async () => {
    const { clock, store, user } = setup();
    await walk(user, TRAIL_A, TRAIL_B);
    await check(user, clock);

    expect(screen.getByText(FIXED.overallIncorrect)).toBeInTheDocument();
    expect(
      within(rowFor(FIXED.stepKeyword)).getByText(FIXED.verdictCorrect, { exact: false }),
    ).toBeInTheDocument();
    expect(store.get(drillId, "toc")).toBeUndefined();
  });

  it("is incorrect for keyword B with the steps of A", async () => {
    const { clock, store, user } = setup();
    await walk(user, TRAIL_B, TRAIL_A);
    await check(user, clock);

    expect(screen.getByText(FIXED.overallIncorrect)).toBeInTheDocument();
    expect(
      within(rowFor(FIXED.stepKeyword)).getByText(FIXED.verdictCorrect, { exact: false }),
    ).toBeInTheDocument();
    expect(store.get(drillId, "toc")).toBeUndefined();
  });

  it.each([
    ["A", TRAIL_A],
    ["B", TRAIL_B],
  ])("is correct and saves a best time for the keyword and steps of trail %s", async (_n, trail) => {
    const { clock, store, user } = setup();
    await walk(user, trail, trail);
    await check(user, clock);

    expect(screen.getByText(FIXED.overallCorrect)).toBeInTheDocument();
    for (const li of rows()) {
      expect(within(li).getByText(FIXED.verdictCorrect, { exact: false })).toBeInTheDocument();
    }
    expect(store.get(drillId, "toc")).toBe(5);
  });
});
