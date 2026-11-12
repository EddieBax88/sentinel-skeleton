// Uses fictional fixtures only. Not real NEC content.
//
// Deviation from tasks.md 11.6 / 11.8: those tasks name App.grading.test.tsx and
// App.twoTrails.test.tsx (full app). DRILL_LIBRARY is empty, so App cannot reach a
// drill. These tests render DrillScreen inside Shell with a fake clock instead, as
// DrillScreen.test.tsx does.
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defineCodeTrail } from "@sentinel/skeleton-core";
import type { CodeTrail } from "@sentinel/skeleton-core";
import { describe, expect, it, vi } from "vitest";
import { FIXED, PROSE } from "../copy/strings";
import { CHAPTER_LABELS } from "../logic/chapters";
import { createBestTimesStore } from "../logic/bestTimes";
import { buildNamesIndex } from "../logic/displayName";
import { defineDrill } from "../model/types";
import type { DrillRecord, OptionNode, OptionTree } from "../model/types";
import {
  articleNoPartsDrill,
  decoyHasPartsDrill,
  movedArticleDrill,
  twoKeywordDrill,
} from "../../test/fixtures/fixtureDrills";
import { createFakeClock } from "../../test/support/fakeClock";
import { treeFromTrails } from "../../test/support/buildTree";
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
              onBack={vi.fn()}
            />
          </Shell>
        </NamesContext.Provider>
      </BestTimesContext.Provider>
    </ClockContext.Provider>,
  );
  const advance = (ms: number) => act(() => clock.advance(ms));
  return { store, user, advance };
}

type User = ReturnType<typeof userEvent.setup>;

async function pick(user: User, group: string, name: string) {
  const g = screen.getAllByRole("group", { name: group }).at(-1)!;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await user.click(within(g).getByRole("button", { name: new RegExp(`^\\s*${esc}\\s*$`) }));
}

const check = async (user: User) =>
  user.click(screen.getByRole("button", { name: FIXED.checkButton }));

/** Verdict text ("correct" / "incorrect" / "not answered") of the result row with this title. */
function verdictOf(title: string): string {
  const li = screen
    .getAllByRole("listitem")
    .find((el) => el.querySelector("span")?.textContent === title);
  if (li === undefined) throw new Error(`No result row titled ${title}`);
  const text = li.textContent ?? "";
  for (const v of [FIXED.verdictNotAnswered, FIXED.verdictIncorrect, FIXED.verdictCorrect]) {
    if (text.includes(v)) return v;
  }
  throw new Error(`No verdict in row ${title}`);
}

const CH = (n: number) => CHAPTER_LABELS[n - 1]!;

/** Same subtree under a decoy Keyword node: wrong Keyword_Pick, matching path. */
function withWrongKeyword(tree: OptionTree, wrongKeyword: string): OptionTree {
  const first = tree[0] as OptionNode;
  const wrong = { ...first, value: wrongKeyword, role: "wrong" } as OptionNode;
  return [...tree, wrong] as unknown as OptionTree;
}

const trailX: CodeTrail = {
  keyword: "Fictional lever",
  legs: [
    [
      { level: "chapter", value: "Chapter 3" },
      { level: "article", value: "Article 377" },
      { level: "section", value: "377.20" },
    ],
  ],
};
const wrongKeywordDrill = defineDrill({
  ...articleNoPartsDrill,
  def: defineCodeTrail({
    id: "fixture-wrong-keyword",
    label: "Fixture: wrong keyword",
    trails: [trailX],
    hint: articleNoPartsDrill.def.hint,
  }),
  trees: { toc: withWrongKeyword(treeFromTrails([trailX]), "Fictional pulley") },
});

// movedFrom with a keyword different from the 2026 trail keyword.
const trailNew: CodeTrail = {
  keyword: "Fictional cog",
  legs: [
    [
      { level: "chapter", value: "Chapter 6" },
      { level: "article", value: "Article 641" },
      { level: "section", value: "641.5" },
    ],
  ],
};
const trailOld: CodeTrail = {
  keyword: "Fictional cog (old heading)",
  legs: [
    [
      { level: "chapter", value: "Chapter 5" },
      { level: "article", value: "Article 541" },
      { level: "section", value: "541.5" },
    ],
  ],
};
const movedKeywordDrill = defineDrill({
  ...movedArticleDrill,
  def: defineCodeTrail({
    id: "fixture-moved-keyword",
    label: "Fixture: moved keyword",
    trails: [trailNew],
    hint: movedArticleDrill.def.hint,
    movedFrom: trailOld,
    editionNote: "Fictional edition note.",
  }),
  trees: { toc: treeFromTrails([trailNew], trailOld, [["Article 642"]]) },
});

describe("DrillScreen grading: Keyword_Pick", () => {
  it("correct Keyword_Pick with a wrong path: keyword correct, overall incorrect, no best time", async () => {
    const { user, store } = setup(articleNoPartsDrill);
    await pick(user, "Keyword", "Fictional widget spacing");
    await pick(user, "Chapter", CH(3));
    await pick(user, "Article", "Article 378");
    await check(user);

    expect(screen.getByText(FIXED.overallIncorrect)).toBeInTheDocument();
    expect(verdictOf("Keyword")).toBe(FIXED.verdictCorrect);
    expect(verdictOf("Article")).toBe(FIXED.verdictIncorrect);
    expect(store.get(articleNoPartsDrill.def.id, "toc")).toBeUndefined();
  });

  it("wrong Keyword_Pick with a matching path: keyword incorrect, overall incorrect, no best time", async () => {
    const { user, store } = setup(wrongKeywordDrill);
    await pick(user, "Keyword", "Fictional pulley");
    await pick(user, "Chapter", CH(3));
    await pick(user, "Article", "Article 377");
    await pick(user, "Section", "377.20");
    await check(user);

    expect(screen.getByText(FIXED.overallIncorrect)).toBeInTheDocument();
    expect(screen.queryByText(FIXED.overallCorrect)).toBeNull();
    expect(verdictOf("Keyword")).toBe(FIXED.verdictIncorrect);
    expect(verdictOf("Section")).toBe(FIXED.verdictCorrect);
    expect(screen.queryByText(PROSE.newBest)).toBeNull();
    expect(store.get(wrongKeywordDrill.def.id, "toc")).toBeUndefined();
  });

  it("correct Keyword_Pick and matching path is the only correct overall result", async () => {
    const { user, store } = setup(wrongKeywordDrill);
    await pick(user, "Keyword", "Fictional lever");
    await pick(user, "Chapter", CH(3));
    await pick(user, "Article", "Article 377");
    await pick(user, "Section", "377.20");
    await check(user);

    expect(screen.getByText(FIXED.overallCorrect)).toBeInTheDocument();
    expect(verdictOf("Keyword")).toBe(FIXED.verdictCorrect);
    expect(store.get(wrongKeywordDrill.def.id, "toc")).toBeDefined();
  });
});

describe("DrillScreen grading: movedFrom (Table of Contents Lookup)", () => {
  it("2023 route with the shared keyword: overall incorrect with the 2023 message", async () => {
    const { user, store } = setup(movedArticleDrill);
    await pick(user, "Keyword", "Fictional doohickey");
    await pick(user, "Chapter", CH(5));
    await pick(user, "Article", "Article 541");
    await pick(user, "Section", "541.5");
    await check(user);

    expect(screen.getByText(FIXED.overallIncorrect)).toBeInTheDocument();
    expect(screen.getByText(PROSE.movedArticle)).toBeInTheDocument();
    expect(screen.getByText(PROSE.verdictsAgainst2023)).toBeInTheDocument();
    expect(screen.getByText(/Fictional edition note/)).toBeInTheDocument();
    expect(store.get(movedArticleDrill.def.id, "toc")).toBeUndefined();
  });

  it("2026 route is correct with no moved-article message", async () => {
    const { user } = setup(movedArticleDrill);
    await pick(user, "Keyword", "Fictional doohickey");
    await pick(user, "Chapter", CH(6));
    await pick(user, "Article", "Article 641");
    await pick(user, "Section", "641.5");
    await check(user);

    expect(screen.getByText(FIXED.overallCorrect)).toBeInTheDocument();
    expect(screen.queryByText(PROSE.movedArticle)).toBeNull();
  });

  it("a movedFrom-only keyword with the 2023 route: incorrect Keyword row, no 2023 message", async () => {
    const { user, store } = setup(movedKeywordDrill);
    await pick(user, "Keyword", "Fictional cog (old heading)");
    await pick(user, "Chapter", CH(5));
    await pick(user, "Article", "Article 541");
    await pick(user, "Section", "541.5");
    await check(user);

    expect(screen.getByText(FIXED.overallIncorrect)).toBeInTheDocument();
    expect(verdictOf("Keyword")).toBe(FIXED.verdictIncorrect);
    expect(screen.queryByText(PROSE.movedArticle)).toBeNull();
    expect(screen.queryByText(PROSE.verdictsAgainst2023)).toBeNull();
    expect(screen.queryByText(/Fictional edition note/)).toBeNull();
    expect(store.get(movedKeywordDrill.def.id, "toc")).toBeUndefined();
  });
});

describe("DrillScreen grading: synthetic Part row", () => {
  it("shows a Part pick on a part-less trail as an incorrect row", async () => {
    const { user, store } = setup(decoyHasPartsDrill);
    await pick(user, "Keyword", "Fictional bobbin");
    await pick(user, "Chapter", CH(8));
    await pick(user, "Article", "Article 6120");
    await pick(user, "Part", "Part IX");
    await check(user);

    expect(screen.getByText(FIXED.overallIncorrect)).toBeInTheDocument();
    expect(verdictOf("Part")).toBe(FIXED.verdictIncorrect);
    expect(verdictOf("Article")).toBe(FIXED.verdictIncorrect);
    expect(store.get(decoyHasPartsDrill.def.id, "toc")).toBeUndefined();
  });
});

describe("DrillScreen grading: two valid trails of one method", () => {
  it("either keyword gives a correct Keyword row", async () => {
    for (const [kw, ch, art, sec] of [
      ["Fictional flange", 2, "Article 211", "211.3"],
      ["Fictional bracket", 7, "Article 711", "711.8"],
    ] as const) {
      const { user } = setup(twoKeywordDrill);
      await pick(user, "Keyword", kw);
      await pick(user, "Chapter", CH(ch));
      await pick(user, "Article", art);
      await pick(user, "Section", sec);
      await check(user);
      expect(verdictOf("Keyword")).toBe(FIXED.verdictCorrect);
      expect(screen.getByText(FIXED.overallCorrect)).toBeInTheDocument();
      cleanup();
    }
  });

  it("trail A keyword with trail B steps is incorrect overall and saves no best time", async () => {
    // Cross tree: each keyword node offers the other keyword's steps.
    const base = twoKeywordDrill.trees.toc;
    const [a, b] = [base[0] as OptionNode, base[1] as OptionNode];
    const cross = [
      { ...a, next: b.next },
      { ...b, next: a.next },
    ] as unknown as OptionTree;
    const drill = defineDrill({
      ...twoKeywordDrill,
      def: defineCodeTrail({
        id: "fixture-two-keywords-cross",
        label: "Fixture: two trails, crossed",
        trails: twoKeywordDrill.def.trails,
        hint: twoKeywordDrill.def.hint,
      }),
      trees: { toc: cross },
    });
    const { user, store } = setup(drill);
    await pick(user, "Keyword", "Fictional flange");
    await pick(user, "Chapter", CH(7));
    await pick(user, "Article", "Article 711");
    await pick(user, "Section", "711.8");
    await check(user);

    expect(verdictOf("Keyword")).toBe(FIXED.verdictCorrect);
    expect(screen.getByText(FIXED.overallIncorrect)).toBeInTheDocument();
    expect(store.get(drill.def.id, "toc")).toBeUndefined();
  });

  it("one trail's keyword and steps give a correct overall result", async () => {
    const { user, store } = setup(twoKeywordDrill);
    await pick(user, "Keyword", "Fictional bracket");
    await pick(user, "Chapter", CH(7));
    await pick(user, "Article", "Article 711");
    await pick(user, "Section", "711.8");
    await check(user);

    expect(screen.getByText(FIXED.overallCorrect)).toBeInTheDocument();
    expect(store.get(twoKeywordDrill.def.id, "toc")).toBeDefined();
  });
});
