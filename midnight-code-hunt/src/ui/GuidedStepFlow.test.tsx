// Uses fictional fixtures only. Not real NEC content.
import { useReducer } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CHAPTER_LABELS } from "../logic/chapters";
import { buildNamesIndex } from "../logic/displayName";
import { createGuidedReducer, viewGuided } from "../logic/guided";
import type { GuidedState } from "../logic/guided";
import type { DrillRecord } from "../model/types";
import {
  guidedAllWhyNoPartsDrill,
  guidedAllWhyPartsDrill,
  guidedIndexClicksWhyDrill,
  guidedKeywordSectionWhyDrill,
  guidedNoWhyDrill,
  guidedSomeWhyWithKeywordDrill,
  guidedTableWhyDrill,
} from "../../test/fixtures/guidedDrills";
import { GuidedStepFlow } from "./GuidedStepFlow";

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});

const reducer = createGuidedReducer();
let latest: GuidedState = { phase: "idle" };

/** Small harness: the guided reducer drives GuidedStepFlow. */
function Harness({ drill }: { drill: DrillRecord }) {
  const [state, dispatch] = useReducer(reducer, { phase: "idle" } as GuidedState, () =>
    reducer({ phase: "idle" }, { type: "START", drill }),
  );
  latest = state;
  if (state.phase !== "guiding") return null;
  return (
    <GuidedStepFlow
      view={viewGuided(state, names)}
      onPick={(depth, value) => dispatch({ type: "PICK", depth, value })}
    />
  );
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const headings = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
const group = (name: string) => screen.getByRole("group", { name });
const optionTexts = (name: string) =>
  within(group(name))
    .getAllByRole("button")
    .map((b) => b.textContent?.trim());

async function pick(user: ReturnType<typeof userEvent.setup>, g: string, text: string) {
  await user.click(
    within(group(g)).getByRole("button", { name: new RegExp(`^\\s*${esc(text)}(\\s|$)`) }),
  );
}

const picks = () => (latest.phase === "guiding" ? latest.picks : []);

describe("GuidedStepFlow", () => {
  it("shows verdict, Why_Sentence, and opens the next step on a correct pick", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness drill={guidedAllWhyPartsDrill} />);
    await pick(user, "Keyword", "Fictional gizmo wiring");
    expect(headings()).toEqual(["Keyword", "Chapter"]);
    expect(group("Keyword")).toHaveTextContent("correct");
    expect(group("Keyword")).toHaveTextContent(
      "Made-up reason: the fictional keyword names the made-up gizmo topic.",
    );
    expect(screen.getByRole("status")).toHaveTextContent("correct");

    await pick(user, "Chapter", "Ch 4 Use: equipment");
    expect(headings()).toEqual(["Keyword", "Chapter", "Article"]);
    expect(group("Chapter")).toHaveTextContent(
      "Made-up reason: this fictional chapter covers made-up gizmo equipment.",
    );
    expect(container.textContent).not.toMatch(/Fictional section 481/);
  });

  it("shows only the verdict when a correct Option has no Why_Sentence", async () => {
    const user = userEvent.setup();
    render(<Harness drill={guidedSomeWhyWithKeywordDrill} />);
    await pick(user, "Keyword", "Fictional gizmo wiring");
    await pick(user, "Chapter", "Ch 4 Use: equipment");
    const chapter = group("Chapter");
    expect(chapter.querySelectorAll("p")).toHaveLength(1);
    expect(chapter).toHaveTextContent("Ch 4 Use: equipment");
    expect(chapter).toHaveTextContent("correct");
    expect(screen.getByRole("status")).toHaveTextContent("correct");
    expect(headings()).toEqual(["Keyword", "Chapter", "Article"]);
  });

  it("shows only the verdict everywhere for a drill with no Why_Sentence", async () => {
    const user = userEvent.setup();
    render(<Harness drill={guidedNoWhyDrill} />);
    await pick(user, "Keyword", "Fictional widget spacing");
    expect(group("Keyword").querySelectorAll("p")).toHaveLength(1);
  });

  it("says incorrect on a wrong pick, shows no Why_Sentence or answer, and allows a second pick", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness drill={guidedAllWhyPartsDrill} />);
    await pick(user, "Keyword", "Fictional gizmo wiring");
    await pick(user, "Chapter", "Ch 1 General");

    expect(screen.getByRole("status")).toHaveTextContent("incorrect");
    expect(screen.getByRole("button", { name: /Ch 1 General/ })).toHaveTextContent("incorrect");
    expect(headings()).toEqual(["Keyword", "Chapter"]);
    expect(picks()).toEqual(["Fictional gizmo wiring"]);
    // No Why_Sentence for the chapter and no correct answer revealed.
    expect(container.textContent).not.toContain("this fictional chapter covers");
    expect(container.textContent).not.toMatch(/Chapter 4|Article 481|481\.12/);
    expect(container.textContent).not.toContain("Fictional section");

    // Second pick at the same step is accepted.
    await pick(user, "Chapter", "Ch 4 Use: equipment");
    expect(picks()).toEqual(["Fictional gizmo wiring", "Chapter 4"]);
    expect(screen.getByRole("status")).toHaveTextContent("correct");
    expect(headings()).toEqual(["Keyword", "Chapter", "Article"]);
  });

  it("shows the Keyword Why_Sentence after the Keyword pick", async () => {
    const user = userEvent.setup();
    render(<Harness drill={guidedKeywordSectionWhyDrill} />);
    expect(headings()).toEqual(["Keyword"]);
    await pick(user, "Keyword", "Fictional gadgets");
    expect(group("Keyword")).toHaveTextContent(
      "Made-up reason: the fictional keyword names the made-up gadget topic.",
    );
  });

  it("shows a Why_Sentence on each of the two Index clicks", async () => {
    const user = userEvent.setup();
    render(<Harness drill={guidedIndexClicksWhyDrill} />);
    await pick(user, "Keyword", "Fictional gadgets");
    expect(headings()).toEqual(["Keyword", "Index"]);
    await pick(user, "Index entry", "Gadgets, spare, 555.4");
    expect(group("Index entry")).toHaveTextContent(
      "Made-up reason: this fictional Index entry lists spare gadgets.",
    );
    expect(group("Number the Index gives")).toBeInTheDocument();
    await pick(user, "Number the Index gives", "555.4");
    expect(group("Number the Index gives")).toHaveTextContent(
      "Made-up reason: the fictional number the Index gives leads to this section.",
    );
    expect(headings()).toEqual(["Keyword", "Index", "Section"]);
  });

  it("walks Keyword, Chapter, Article, Part, Section with Parts, with a reason on each", async () => {
    const user = userEvent.setup();
    render(<Harness drill={guidedAllWhyPartsDrill} />);
    await pick(user, "Keyword", "Fictional gizmo wiring");
    await pick(user, "Chapter", "Ch 4 Use: equipment");
    await pick(user, "Article", "Article 481");
    expect(headings()).toEqual(["Keyword", "Chapter", "Article", "Part"]);
    await pick(user, "Part", "Part II");
    expect(headings()).toEqual(["Keyword", "Chapter", "Article", "Part", "Section"]);
    await pick(user, "Section", "481.12");
    expect(headings()).toEqual(["Keyword", "Chapter", "Article", "Part", "Section"]);
    expect(group("Part")).toHaveTextContent("this fictional part holds the installation rules");
    expect(group("Section")).toHaveTextContent("this fictional section holds the one rule asked about");
    expect(screen.queryByRole("heading", { name: "Row" })).toBeNull();
  });

  it("skips the Part step for an Article with no Parts", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness drill={guidedAllWhyNoPartsDrill} />);
    await pick(user, "Keyword", "Fictional widget spacing");
    await pick(user, "Chapter", "Ch 3 Build: wiring methods, raceways, cables, boxes");
    await pick(user, "Article", "Article 377");
    expect(headings()).toEqual(["Keyword", "Chapter", "Article", "Section"]);
    await pick(user, "Section", "377.20");
    expect(headings()).toEqual(["Keyword", "Chapter", "Article", "Section"]);
    expect(screen.queryByRole("heading", { name: "Part" })).toBeNull();
    expect(container.textContent).not.toMatch(/NO_PARTS/i);
    expect(picks().some((p) => /NO_PARTS/i.test(p))).toBe(false);
    expect(picks()).toEqual(["Fictional widget spacing", "Chapter 3", "Article 377", "377.20"]);
  });

  it("shows a non-interactive Row line after the Table pick in Chapter 9", async () => {
    const user = userEvent.setup();
    render(<Harness drill={guidedTableWhyDrill} />);
    await pick(user, "Keyword", "Fictional sprocket sizes");
    await pick(user, "Chapter", "Ch 9 Tables");
    expect(headings()).toEqual(["Keyword", "Chapter", "Table"]);
    expect(screen.queryByRole("heading", { name: "Row" })).toBeNull();
    await pick(user, "Table", "Table 99");
    expect(headings()).toEqual(["Keyword", "Chapter", "Table", "Row"]);
    expect(group("Table")).toHaveTextContent("this fictional table lists the made-up sprocket sizes");
    const rowSection = screen.getByRole("heading", { name: "Row" }).closest("section")!;
    expect(within(rowSection).queryAllByRole("button")).toHaveLength(0);
    expect(within(rowSection).queryAllByRole("group")).toHaveLength(0);
    expect(rowSection).toHaveTextContent("Find the row in the table to read the value.");
    expect(picks()).toEqual(["Fictional sprocket sizes", "Chapter 9", "Table 99"]);
  });

  it("offers the nine Chapter labels word for word and in order", async () => {
    const user = userEvent.setup();
    render(<Harness drill={guidedAllWhyPartsDrill} />);
    await pick(user, "Keyword", "Fictional gizmo wiring");
    expect(optionTexts("Chapter")).toEqual([...CHAPTER_LABELS]);
    expect(CHAPTER_LABELS).toHaveLength(9);
  });

  it("leaves no Option to change on an accepted pick", async () => {
    const user = userEvent.setup();
    render(<Harness drill={guidedAllWhyPartsDrill} />);
    await pick(user, "Keyword", "Fictional gizmo wiring");
    await pick(user, "Chapter", "Ch 4 Use: equipment");
    expect(within(group("Keyword")).queryAllByRole("button")).toHaveLength(0);
    expect(within(group("Chapter")).queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /change|undo|edit/i })).toBeNull();
    // Only the open Article group offers buttons.
    expect(within(group("Article")).getAllByRole("button").length).toBeGreaterThan(0);
  });
});
