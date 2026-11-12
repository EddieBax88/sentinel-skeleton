// Uses fictional fixtures only. Not real NEC content.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ANNOUNCE, FIXED, PROSE, SENTINEL_URL } from "../copy/strings";
import { buildNamesIndex } from "../logic/displayName";
import { gradeAttempt, type ResultModel } from "../logic/grading";
import type { MethodId, OptionNode, DrillRecord } from "../model/types";
import {
  articleNoPartsDrill,
  articleWithPartsDrill,
  chapter9TableDrill,
  movedArticleDrill,
  twoKeywordDrill,
} from "../../test/fixtures/fixtureDrills";
import { AnnouncerContext } from "./providers";
import { ResultScreen } from "./ResultScreen";

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});

/** Follows the given values down the drill's tree for the method; stops at the first miss. */
function pathOf(drill: DrillRecord, method: MethodId, values: readonly string[]): OptionNode[] {
  const tree = method === "toc" ? drill.trees.toc : drill.trees.index;
  let level: readonly OptionNode[] | undefined = tree;
  const path: OptionNode[] = [];
  for (const value of values) {
    const node: OptionNode | undefined = level?.find((n) => n.value === value);
    if (node === undefined) throw new Error(`No node "${value}" in ${drill.def.id}`);
    path.push(node);
    level = node.next;
  }
  return path;
}

function model(
  drill: DrillRecord,
  values: readonly string[],
  outcome = { timeUp: false, elapsedSeconds: 65 },
  method: MethodId = "toc",
): ResultModel {
  return gradeAttempt(drill, method, pathOf(drill, method, values), names, outcome);
}

const noop = () => {};
const rows = () => within(screen.getByRole("list")).getAllByRole("listitem");
const rowFor = (title: string) => {
  const found = rows().find((li) => li.firstElementChild?.textContent === title);
  if (found === undefined) throw new Error(`No row titled ${title}`);
  return found;
};

function show(m: ResultModel, extra: Partial<React.ComponentProps<typeof ResultScreen>> = {}) {
  return render(<ResultScreen model={m} onTryAgain={noop} onBack={noop} {...extra} />);
}

const CORRECT_PARTS = [
  "Fictional gizmo wiring",
  "Chapter 4",
  "Article 481",
  "Part II",
  "481.12",
];

describe("ResultScreen", () => {
  it("shows the elapsed time, the Keyword row first, and a text verdict on every row", () => {
    show(model(articleWithPartsDrill, CORRECT_PARTS));
    expect(screen.getByText(`${FIXED.elapsedLabel}: 1:05`)).toBeInTheDocument();
    const items = rows();
    expect(items[0]?.firstElementChild?.textContent).toBe(FIXED.stepKeyword);
    expect(within(items[0] as HTMLElement).getByText(/Fictional gizmo wiring/)).toBeInTheDocument();
    expect(items.map((li) => li.firstElementChild?.textContent)).toEqual([
      FIXED.stepKeyword,
      FIXED.stepChapter,
      FIXED.stepArticle,
      FIXED.stepPart,
      FIXED.stepSection,
    ]);
    for (const li of items) {
      expect(within(li).getByText(FIXED.verdictCorrect, { exact: false })).toBeInTheDocument();
    }
    expect(screen.getByText(FIXED.overallCorrect)).toBeInTheDocument();
  });

  it("labels wrong and missing picks with text, not color alone", () => {
    // Wrong Article, then stop: Part and Section are unanswered.
    show(
      model(articleWithPartsDrill, [
        "Fictional gizmo wiring",
        "Chapter 4",
        "Article 482",
      ]),
    );
    expect(within(rowFor(FIXED.stepArticle)).getByText(FIXED.verdictIncorrect, { exact: false }))
      .toBeInTheDocument();
    expect(within(rowFor(FIXED.stepSection)).getByText(FIXED.verdictNotAnswered, { exact: false }))
      .toBeInTheDocument();
    expect(within(rowFor(FIXED.stepSection)).getByText(FIXED.noPickText)).toBeInTheDocument();
    expect(screen.getByText(FIXED.overallIncorrect)).toBeInTheDocument();
  });

  it("marks an unanswered Keyword row when nothing was picked", () => {
    show(model(articleWithPartsDrill, [], { timeUp: true, elapsedSeconds: 120 }));
    expect(
      within(rowFor(FIXED.stepKeyword)).getByText(FIXED.verdictNotAnswered, { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText(PROSE.timeRanOut)).toBeInTheDocument();
  });

  it("shows the answer, its citation, and the hint", () => {
    const m = model(articleNoPartsDrill, [
      "Fictional widget spacing",
      "Chapter 3",
      "Article 377",
      "377.20",
    ]);
    show(m);
    expect(screen.getByText(FIXED.answerLabel).nextElementSibling).toHaveTextContent(m.answer);
    expect(screen.getByText(FIXED.citationLabel).nextElementSibling).toHaveTextContent(
      "Fictional section 377.20",
    );
    expect(screen.getByText(FIXED.hintLabel).nextElementSibling).toHaveTextContent(m.hint);
  });

  it("links to sentinellearning.com above the action buttons", () => {
    show(model(articleNoPartsDrill, ["Fictional widget spacing"]));
    const link = screen.getByRole("link", { name: FIXED.sentinelLinkText });
    expect(link).toHaveAttribute("href", SENTINEL_URL);
    const tryAgain = screen.getByRole("button", { name: FIXED.tryAgainButton });
    expect(
      link.compareDocumentPosition(tryAgain) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows fork sentences only on their rows and only when the drill has them", () => {
    const { unmount } = show(model(articleWithPartsDrill, CORRECT_PARTS));
    expect(
      within(rowFor(FIXED.stepChapter)).getByText(articleWithPartsDrill.chapterForkSentence!),
    ).toBeInTheDocument();
    expect(
      within(rowFor(FIXED.stepArticle)).getByText(articleWithPartsDrill.articleForkSentence!),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/made-up fork sentence/)).toHaveLength(2);
    expect(within(rowFor(FIXED.stepSection)).queryByText(/fork sentence/)).toBeNull();
    unmount();

    show(
      model(articleNoPartsDrill, [
        "Fictional widget spacing",
        "Chapter 3",
        "Article 377",
        "377.20",
      ]),
    );
    expect(screen.queryByText(/fork sentence/)).toBeNull();
  });

  it("shows the Table_Walk on the Row line only for a drill that has one", () => {
    const { unmount } = show(
      model(chapter9TableDrill, ["Fictional sprocket sizes", "Chapter 9", "Table 99"]),
    );
    const row = rowFor(FIXED.rowLineLabel);
    expect(within(row).getByText(PROSE.rowLineIntro)).toBeInTheDocument();
    expect(within(row).getByText(`${FIXED.tableWalkColumn}: Size 7`)).toBeInTheDocument();
    expect(within(row).getByText(`${FIXED.tableWalkRow}: Type Q`)).toBeInTheDocument();
    expect(
      within(row).getByText(`${FIXED.tableWalkValue}: 0.123 in. (fictional)`),
    ).toBeInTheDocument();
    // The Row line is the last row and carries no verdict.
    expect(rows().at(-1)).toBe(row);
    expect(within(row).queryByText(FIXED.verdictCorrect, { exact: false })).toBeNull();
    unmount();

    show(model(articleNoPartsDrill, ["Fictional widget spacing"]));
    expect(screen.queryByText(PROSE.rowLineIntro)).toBeNull();
  });

  it("shows the moved-article message with the edition note when the 2023 route matched", () => {
    const m = model(movedArticleDrill, [
      "Fictional doohickey",
      "Chapter 5",
      "Article 541",
      "541.5",
    ]);
    expect(m.matchedMovedFrom).toBe(true);
    show(m);
    expect(screen.getByText(PROSE.movedArticle)).toBeInTheDocument();
    expect(screen.getByText(PROSE.verdictsAgainst2023)).toBeInTheDocument();
    expect(screen.getByText(m.editionNote!)).toBeInTheDocument();
    expect(screen.getByText(FIXED.overallIncorrect)).toBeInTheDocument();
  });

  it("omits the moved-article message and edition note on a 2026 route", () => {
    show(model(movedArticleDrill, ["Fictional doohickey", "Chapter 6", "Article 641", "641.5"]));
    expect(screen.queryByText(PROSE.movedArticle)).toBeNull();
    expect(screen.queryByText(/Fictional edition note/)).toBeNull();
    expect(screen.getByText(FIXED.overallCorrect)).toBeInTheDocument();
  });

  it("is incorrect overall when the keyword of one trail is paired with the other's steps", () => {
    // Keyword of trail A (flange) followed by the steps of trail B (bracket).
    const flange = pathOf(twoKeywordDrill, "toc", ["Fictional flange"]);
    const bracket = pathOf(twoKeywordDrill, "toc", [
      "Fictional bracket",
      "Chapter 7",
      "Article 711",
      "711.8",
    ]);
    show(
      gradeAttempt(
        twoKeywordDrill,
        "toc",
        [...flange, ...bracket.slice(1)],
        names,
        { timeUp: false, elapsedSeconds: 65 },
      ),
    );
    expect(screen.getByText(FIXED.overallIncorrect)).toBeInTheDocument();
    expect(
      within(rowFor(FIXED.stepKeyword)).getByText(FIXED.verdictCorrect, { exact: false }),
    ).toBeInTheDocument();
  });

  it("shows the new-best message only for a correct result that set a new best", () => {
    const correct = model(articleWithPartsDrill, CORRECT_PARTS);
    const { unmount } = show(correct, { outcome: { isNewBest: true, best: 65 } });
    expect(screen.getByText(PROSE.newBest)).toBeInTheDocument();
    expect(screen.getByText(`${FIXED.bestTimeLabel}: 1:05`)).toBeInTheDocument();
    unmount();

    const wrong = model(articleWithPartsDrill, ["Fictional gizmo wiring", "Chapter 4", "Article 482"]);
    show(wrong, { outcome: { isNewBest: true, best: 65 } });
    expect(screen.queryByText(PROSE.newBest)).toBeNull();
  });

  it("shows the storage note only when storage is unavailable", () => {
    const m = model(articleWithPartsDrill, CORRECT_PARTS);
    const { unmount } = show(m);
    expect(screen.queryByText(PROSE.storageNote)).toBeNull();
    unmount();
    show(m, { storageUnavailable: true });
    expect(screen.getByText(PROSE.storageNote)).toBeInTheDocument();
  });

  it("contains no pass or score promise", () => {
    const { container } = show(model(articleWithPartsDrill, CORRECT_PARTS));
    expect(container.textContent).not.toMatch(/\b(pass|passing|guarantee|score)\b/i);
  });

  it("moves focus to the h1 on mount and announces the result", () => {
    const announce = vi.fn();
    render(
      <AnnouncerContext.Provider value={announce}>
        <h1>Result</h1>
        <ResultScreen
          model={model(articleWithPartsDrill, CORRECT_PARTS)}
          onTryAgain={noop}
          onBack={noop}
        />
      </AnnouncerContext.Provider>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    expect(announce).toHaveBeenCalledWith(ANNOUNCE.result(true, false, "1:05"));
  });

  it("calls the action handlers from the Try again and Back to drills buttons", async () => {
    const user = userEvent.setup();
    const onTryAgain = vi.fn();
    const onBack = vi.fn();
    render(
      <ResultScreen
        model={model(articleNoPartsDrill, ["Fictional widget spacing"])}
        onTryAgain={onTryAgain}
        onBack={onBack}
      />,
    );
    await user.click(screen.getByRole("button", { name: FIXED.tryAgainButton }));
    await user.click(screen.getByRole("button", { name: FIXED.backButton }));
    expect(onTryAgain).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
