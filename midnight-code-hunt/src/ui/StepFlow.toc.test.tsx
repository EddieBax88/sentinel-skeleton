// Uses fictional fixtures only. Not real NEC content.
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { buildNamesIndex } from "../logic/displayName";
import { CHAPTER_LABELS } from "../logic/chapters";
import { applyPick, treeFor, viewFlow } from "../logic/stepEngine";
import type { DrillRecord } from "../model/types";
import {
  articleNoPartsDrill,
  articleWithPartsDrill,
  chapter9TableDrill,
  decoyHasPartsDrill,
} from "../../test/fixtures/fixtureDrills";
import { StepFlow } from "./StepFlow";

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});

let latestPicks: readonly string[] = [];

function Harness({ drill }: { drill: DrillRecord }) {
  const tree = treeFor(drill, "toc");
  const [picks, setPicks] = useState<readonly string[]>([]);
  latestPicks = picks;
  return (
    <StepFlow
      view={viewFlow(tree, picks, names)}
      onPick={(depth, value) => setPicks((p) => applyPick(tree, p, depth, value))}
    />
  );
}

const headings = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
const optionTexts = (group: string) =>
  within(screen.getByRole("group", { name: group }))
    .getAllByRole("button")
    .map((b) => b.textContent?.replace("\u2713", "").trim());

async function pick(user: ReturnType<typeof userEvent.setup>, group: string, name: string) {
  const g = screen.getByRole("group", { name: group });
  await user.click(within(g).getByRole("button", { name: new RegExp(`^\\s*${name}\\s*$`) }));
}

describe("StepFlow under Table of Contents Lookup", () => {
  it("walks Keyword, Chapter, Article, Part, Section for an Article with Parts", async () => {
    const user = userEvent.setup();
    render(<Harness drill={articleWithPartsDrill} />);
    expect(headings()).toEqual(["Keyword"]);

    await pick(user, "Keyword", "Fictional gizmo wiring");
    expect(headings()).toEqual(["Keyword", "Chapter"]);
    await pick(user, "Chapter", "Ch 4 Use: equipment");
    expect(headings()).toEqual(["Keyword", "Chapter", "Article"]);
    await pick(user, "Article", "Article 481");
    expect(headings()).toEqual(["Keyword", "Chapter", "Article", "Part"]);
    await pick(user, "Part", "Part II");
    expect(headings()).toEqual(["Keyword", "Chapter", "Article", "Part", "Section"]);
    await pick(user, "Section", "481.12");
    expect(headings()).toEqual(["Keyword", "Chapter", "Article", "Part", "Section"]);
    expect(screen.queryByRole("heading", { name: "Row" })).toBeNull();
  });

  it("skips the Part step for an Article with no Parts", async () => {
    const user = userEvent.setup();
    render(<Harness drill={articleNoPartsDrill} />);
    await pick(user, "Keyword", "Fictional widget spacing");
    await pick(user, "Chapter", "Ch 3 Build: wiring methods, raceways, cables, boxes");
    await pick(user, "Article", "Article 377");
    expect(headings()).toEqual(["Keyword", "Chapter", "Article", "Section"]);
    expect(screen.queryByRole("heading", { name: "Part" })).toBeNull();
    await pick(user, "Section", "377.20");
    expect(headings()).toEqual(["Keyword", "Chapter", "Article", "Section"]);
  });

  it("shows no Part step for a wrong Article without Parts and a Part step for a decoy with Parts", async () => {
    const user = userEvent.setup();
    render(<Harness drill={decoyHasPartsDrill} />);
    await pick(user, "Keyword", "Fictional bobbin");
    await pick(user, "Chapter", "Ch 8 Communications");

    // Decoy without Parts: next step is Section (wrong node, path ends).
    await pick(user, "Article", "Article 612");
    expect(headings()).not.toContain("Part");

    // Decoy with hasParts true: a Part step appears.
    await pick(user, "Article", "Article 6120");
    expect(headings()).toEqual(["Keyword", "Chapter", "Article", "Part"]);
    expect(optionTexts("Part")).toEqual(["Part IX"]);
  });

  it("shows a non-interactive Row line after the Table pick in Chapter 9", async () => {
    const user = userEvent.setup();
    render(<Harness drill={chapter9TableDrill} />);
    await pick(user, "Keyword", "Fictional sprocket sizes");
    await pick(user, "Chapter", "Ch 9 Tables");
    expect(headings()).toEqual(["Keyword", "Chapter", "Table"]);
    expect(screen.queryByRole("heading", { name: "Row" })).toBeNull();

    await pick(user, "Table", "Table 99");
    expect(headings()).toEqual(["Keyword", "Chapter", "Table", "Row"]);
    const rowSection = screen.getByRole("heading", { name: "Row" }).closest("section")!;
    expect(within(rowSection).queryAllByRole("button")).toHaveLength(0);
    expect(within(rowSection).queryAllByRole("group")).toHaveLength(0);
    expect(rowSection).toHaveTextContent("Find the row in the table to read the value.");
    // The Row line adds nothing to the picks.
    expect(latestPicks).toEqual(["Fictional sprocket sizes", "Chapter 9", "Table 99"]);
  });

  it("offers the nine Chapter labels word for word and in order", async () => {
    const user = userEvent.setup();
    render(<Harness drill={articleWithPartsDrill} />);
    await pick(user, "Keyword", "Fictional gizmo wiring");
    expect(optionTexts("Chapter")).toEqual([...CHAPTER_LABELS]);
    expect(optionTexts("Chapter")).toEqual([
      "Ch 1 General",
      "Ch 2 Plan: circuits, protection, grounding",
      "Ch 3 Build: wiring methods, raceways, cables, boxes",
      "Ch 4 Use: equipment",
      "Ch 5 Special occupancies",
      "Ch 6 Special equipment",
      "Ch 7 Special conditions",
      "Ch 8 Communications",
      "Ch 9 Tables",
    ]);
  });

  it("never offers or records an option named NO_PARTS", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness drill={articleNoPartsDrill} />);
    await pick(user, "Keyword", "Fictional widget spacing");
    await pick(user, "Chapter", "Ch 3 Build: wiring methods, raceways, cables, boxes");
    await pick(user, "Article", "Article 377");
    await pick(user, "Section", "377.20");
    expect(container.textContent).not.toMatch(/NO_PARTS/i);
    expect(latestPicks.some((p) => /NO_PARTS/i.test(p))).toBe(false);
    expect(latestPicks).toEqual([
      "Fictional widget spacing",
      "Chapter 3",
      "Article 377",
      "377.20",
    ]);
  });
});
