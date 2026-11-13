// Uses fictional fixtures only. Not real NEC content.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FIXED, SENTINEL_URL } from "../copy/strings";
import type { DrillRecord, MethodId } from "../model/types";
import {
  guidedAllWhyNoPartsDrill,
  guidedAllWhyPartsDrill,
  guidedForkAndWhyDrill,
  guidedIndexClicksWhyDrill,
  guidedKeywordSectionWhyDrill,
  guidedNoWhyDrill,
  guidedSomeWhyNoKeywordDrill,
  guidedSomeWhyWithKeywordDrill,
  guidedTableWhyDrill,
} from "../../test/fixtures/guidedDrills";
import { movedArticleDrill } from "../../test/fixtures/fixtureDrills";
import { GuidedEndScreen } from "./GuidedEndScreen";

const PARTS_PICKS = ["Fictional gizmo wiring", "Chapter 4", "Article 481", "Part II", "481.12"];
const NO_PARTS_PICKS = ["Fictional widget spacing", "Chapter 3", "Article 377", "377.20"];
const INDEX_PICKS = [
  "Fictional gadgets",
  "Gadgets, spare, 555.4",
  "555.4",
  "555.4(B)",
  "555.4(B)(2)",
];
const TABLE_PICKS = ["Fictional sprocket sizes", "Chapter 9", "Table 99"];

const noop = () => {};

function show(
  drill: DrillRecord,
  picks: readonly string[],
  method: MethodId = "toc",
  handlers: { onRunTimed?: () => void; onBack?: () => void } = {},
) {
  return render(
    <GuidedEndScreen
      drill={drill}
      method={method}
      picks={picks}
      onRunTimed={handlers.onRunTimed ?? noop}
      onBack={handlers.onBack ?? noop}
    />,
  );
}

const rows = () => within(screen.getByRole("list")).getAllByRole("listitem");
const whysOf = (drill: DrillRecord): string[] => {
  const out: string[] = [];
  const walk = (nodes: readonly { why?: string; next?: unknown }[]) => {
    for (const n of nodes) {
      if (n.why) out.push(n.why);
      if (n.next) walk(n.next as never);
    }
  };
  walk(drill.trees.toc as never);
  if (drill.trees.index) walk(drill.trees.index as never);
  return out;
};

describe("GuidedEndScreen rows", () => {
  it("shows the Keyword row first, then one row per accepted pick in order (Parts)", () => {
    show(guidedAllWhyPartsDrill, PARTS_PICKS);
    const items = rows();
    expect(items).toHaveLength(PARTS_PICKS.length);
    const titles = items.map((li) => li.firstElementChild?.textContent);
    expect(titles).toEqual([
      FIXED.stepKeyword,
      FIXED.stepChapter,
      FIXED.stepArticle,
      FIXED.stepPart,
      FIXED.stepSection,
    ]);
    expect(items[0]).toHaveTextContent("Fictional gizmo wiring");
    expect(items[2]).toHaveTextContent("481");
    expect(items[4]).toHaveTextContent("481.12");
  });

  it("has no Part row when the Article has no Parts", () => {
    show(guidedAllWhyNoPartsDrill, NO_PARTS_PICKS);
    const titles = rows().map((li) => li.firstElementChild?.textContent);
    expect(titles).toEqual([
      FIXED.stepKeyword,
      FIXED.stepChapter,
      FIXED.stepArticle,
      FIXED.stepSection,
    ]);
  });

  it("shows the Index rows and subdivision rows in click order", () => {
    show(guidedIndexClicksWhyDrill, INDEX_PICKS, "index");
    const items = rows();
    expect(items).toHaveLength(INDEX_PICKS.length);
    expect(items[0].firstElementChild?.textContent).toBe(FIXED.stepKeyword);
    expect(items[1]).toHaveTextContent("Gadgets, spare, 555.4");
    expect(items[4]).toHaveTextContent("555.4(B)(2)");
  });
});

describe("GuidedEndScreen why sentences", () => {
  it("shows every why under its own pick when all Options have one", () => {
    show(guidedAllWhyPartsDrill, PARTS_PICKS);
    const items = rows();
    const expected = whysOf(guidedAllWhyPartsDrill);
    expect(expected).toHaveLength(5);
    expected.forEach((why, i) => {
      expect(within(items[i]).getByText(why)).toBeInTheDocument();
    });
  });

  it("shows the Keyword why and both Index-click whys", () => {
    show(guidedIndexClicksWhyDrill, INDEX_PICKS, "index");
    const items = rows();
    expect(
      within(items[1]).getByText(/this fictional Index entry lists spare gadgets/),
    ).toBeInTheDocument();
    expect(
      within(items[2]).getByText(/fictional number the Index gives/),
    ).toBeInTheDocument();
    expect(within(items[3]).queryByText(/Made-up reason/)).toBeNull();
  });

  it("shows the Keyword why when only some Options have one", () => {
    show(guidedSomeWhyWithKeywordDrill, PARTS_PICKS);
    const items = rows();
    expect(within(items[0]).getByText(/first word to look up/)).toBeInTheDocument();
    expect(within(items[4]).getByText(/holds the made-up rule/)).toBeInTheDocument();
    for (const i of [1, 2, 3]) {
      expect(items[i].querySelectorAll("span")).toHaveLength(2);
    }
  });

  it("adds nothing and no placeholder where the Keyword has no why", () => {
    show(guidedSomeWhyNoKeywordDrill, PARTS_PICKS);
    const items = rows();
    // title + pick text only
    expect(items[0].querySelectorAll("span")).toHaveLength(2);
    expect(items[0].textContent).toBe(`${FIXED.stepKeyword}Fictional gizmo wiring`);
    expect(within(items[2]).getByText(/titled for gizmo wiring/)).toBeInTheDocument();
    expect(within(items[3]).getByText(/installation rules/)).toBeInTheDocument();
    expect(items[1].querySelectorAll("span")).toHaveLength(2);
  });

  it("shows no why text and no extra element when no Option has a why", () => {
    show(guidedNoWhyDrill, NO_PARTS_PICKS);
    for (const li of rows()) {
      expect(li.querySelectorAll("span")).toHaveLength(2);
      expect(li.textContent ?? "").not.toMatch(/Made-up reason/);
    }
    expect(screen.queryByText(/Made-up reason/)).toBeNull();
  });

  it("shows the whys of a Keyword row and Section subdivisions", () => {
    show(guidedKeywordSectionWhyDrill, INDEX_PICKS, "index");
    const items = rows();
    expect(within(items[0]).getByText(/gadget topic/)).toBeInTheDocument();
    expect(within(items[3]).getByText(/lettered subdivision/)).toBeInTheDocument();
    expect(within(items[4]).getByText(/numbered subdivision/)).toBeInTheDocument();
    expect(items[1].querySelectorAll("span")).toHaveLength(2);
  });
});

describe("GuidedEndScreen Row line", () => {
  it("shows the Row line last with the table walk, and no why on it", () => {
    show(guidedTableWhyDrill, TABLE_PICKS);
    const items = rows();
    expect(items).toHaveLength(TABLE_PICKS.length + 1);
    const last = items[items.length - 1];
    expect(last.firstElementChild?.textContent).toBe(FIXED.rowLineLabel);
    expect(last).toHaveTextContent("Size 7");
    expect(last).toHaveTextContent("Type Q");
    expect(last).toHaveTextContent("0.123 in. (fictional)");
    expect(last.textContent ?? "").not.toMatch(/Made-up reason/);
    // Label + three walk lines, nothing else.
    expect(last.querySelectorAll("span")).toHaveLength(4);
    // The Keyword and Table rows keep their whys.
    expect(within(items[0]).getByText(/sprocket topic/)).toBeInTheDocument();
    expect(within(items[2]).getByText(/lists the made-up sprocket sizes/)).toBeInTheDocument();
  });

  it("shows no Row line without a table walk", () => {
    show(guidedAllWhyPartsDrill, PARTS_PICKS);
    expect(rows()).toHaveLength(PARTS_PICKS.length);
    expect(screen.queryByText(FIXED.rowLineLabel)).toBeNull();
    expect(screen.queryByText(new RegExp(`${FIXED.tableWalkColumn}:`))).toBeNull();
  });
});

describe("GuidedEndScreen answer, link, buttons", () => {
  it("shows the answer, citation, and hint", () => {
    const drill = guidedAllWhyPartsDrill;
    show(drill, PARTS_PICKS);
    expect(screen.getByText(FIXED.answerLabel)).toBeInTheDocument();
    expect(screen.getByText(drill.answer)).toBeInTheDocument();
    expect(screen.getByText(FIXED.citationLabel)).toBeInTheDocument();
    expect(screen.getByText(drill.citation)).toBeInTheDocument();
    expect(screen.getByText(FIXED.hintLabel)).toBeInTheDocument();
    expect(screen.getByText(drill.def.hint as string)).toBeInTheDocument();
  });

  it("places the sentinellearning.com link above the action buttons", () => {
    show(guidedAllWhyPartsDrill, PARTS_PICKS);
    const link = screen.getByRole("link", { name: FIXED.sentinelLinkText });
    expect(link).toHaveAttribute("href", SENTINEL_URL);
    expect(SENTINEL_URL).toContain("sentinellearning.com");
    for (const name of [FIXED.runTimedButton, FIXED.backButton]) {
      const button = screen.getByRole("button", { name });
      expect(
        link.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("calls the matching handler for each button", async () => {
    const user = userEvent.setup();
    const onRunTimed = vi.fn();
    const onBack = vi.fn();
    show(guidedAllWhyPartsDrill, PARTS_PICKS, "toc", { onRunTimed, onBack });

    await user.click(screen.getByRole("button", { name: FIXED.runTimedButton }));
    expect(onRunTimed).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: FIXED.backButton }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onRunTimed).toHaveBeenCalledTimes(1);
  });
});

describe("GuidedEndScreen leaves out Timed content", () => {
  it("shows no elapsed time, overall result, fork sentence, or moved-article message", () => {
    const drill = guidedForkAndWhyDrill;
    expect(drill.chapterForkSentence).toBeTruthy();
    expect(drill.articleForkSentence).toBeTruthy();
    const { container } = show(drill, PARTS_PICKS);
    const text = container.textContent ?? "";

    expect(text).not.toContain(drill.chapterForkSentence as string);
    expect(text).not.toContain(drill.articleForkSentence as string);
    expect(text).not.toMatch(/Made-up fork text/);
    expect(screen.queryByText(FIXED.elapsedLabel)).toBeNull();
    expect(text).not.toMatch(/\b\d+:\d{2}\b/);
    expect(screen.queryByText(FIXED.overallCorrect)).toBeNull();
    expect(screen.queryByText(FIXED.overallIncorrect)).toBeNull();
    expect(screen.queryByText(FIXED.verdictCorrect)).toBeNull();
    expect(screen.queryByText(FIXED.movedLabel)).toBeNull();
    // The why sentences are still there.
    expect(screen.getByText(/names the made-up gizmo topic/)).toBeInTheDocument();
  });

  it("shows no moved-article message or edition note for a moved drill", () => {
    const drill = movedArticleDrill;
    const { container } = show(drill, [
      "Fictional doohickey",
      "Chapter 6",
      "Article 641",
      "641.5",
    ]);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/2023/);
    expect(screen.queryByText(FIXED.movedLabel)).toBeNull();
    expect(text).not.toContain("Fictional edition note");
  });
});
