// Uses fictional fixtures only. Not real NEC content.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FIXED, PROSE } from "../copy/strings";
import { CHAPTER_LABELS } from "../logic/chapters";
import type { BestTimesStore } from "../logic/bestTimes";
import { buildNamesIndex } from "../logic/displayName";
import type { DrillRecord } from "../model/types";
import { movedArticleDrill } from "../../test/fixtures/fixtureDrills";
import {
  guidedAllWhyNoPartsDrill,
  guidedAllWhyPartsDrill,
  guidedIndexClicksWhyDrill,
  guidedKeywordSectionWhyDrill,
} from "../../test/fixtures/guidedDrills";
import { GuidedScreen } from "./GuidedScreen";
import { BestTimesContext, NamesContext } from "./providers";
import { Shell } from "./Shell";

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});

function spyStore() {
  const get = vi.fn<BestTimesStore["get"]>(() => undefined);
  const submit = vi.fn<BestTimesStore["submit"]>((_id, _m, e) => ({ best: e, isNewBest: true }));
  const store: BestTimesStore = { get, submit, persistent: false };
  return { store, get, submit };
}

function setup(drill: DrillRecord) {
  const spy = spyStore();
  const onBack = vi.fn();
  const onRunTimed = vi.fn();
  const user = userEvent.setup();
  render(
    <BestTimesContext.Provider value={spy.store}>
      <NamesContext.Provider value={names}>
        <Shell title="Midnight Code Hunt">
          <GuidedScreen
            drillId={drill.def.id}
            entries={[{ drill, draft: false }]}
            buildMode="test"
            onBack={onBack}
            onRunTimed={onRunTimed}
          />
        </Shell>
      </NamesContext.Provider>
    </BestTimesContext.Provider>,
  );
  return { ...spy, onBack, onRunTimed, user };
}

type User = ReturnType<typeof userEvent.setup>;

async function pick(user: User, group: string, name: string) {
  const g = screen.getAllByRole("group", { name: group }).at(-1)!;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await user.click(within(g).getByRole("button", { name: new RegExp(`^\\s*${esc}\\s*$`) }));
}

const radio = (re: RegExp) => screen.getByRole("radio", { name: re });
const INDEX_RADIO = /Index Keyword Lookup/;
const TOC_RADIO = /Table of Contents Lookup/;
const fullPathButton = () => screen.queryByRole("button", { name: FIXED.showFullPathButton });
const headings = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

async function walkToc(user: User) {
  await pick(user, "Keyword", "Fictional gizmo wiring");
  await pick(user, "Chapter", CHAPTER_LABELS[3]!);
  await pick(user, "Article", "Article 481");
  await pick(user, "Part", "Part II");
  await pick(user, "Section", "481.12");
}

async function walkIndex(user: User) {
  await pick(user, "Keyword", "Fictional gadgets");
  await pick(user, FIXED.indexEntryGroup, "Gadgets, spare, 555.4");
  await pick(user, FIXED.indexNumberGroup, "555.4");
  await pick(user, "Section", "555.4(B)");
  await pick(user, "Section", "555.4(B)(2)");
}

describe("GuidedScreen full runs", () => {
  it("runs Table of Contents Lookup from the first step to the full path", async () => {
    const { user } = setup(guidedAllWhyPartsDrill);
    expect(radio(TOC_RADIO)).toHaveAttribute("aria-checked", "true");
    expect(fullPathButton()).toBeNull();

    await walkToc(user);
    expect(headings()).toEqual(["Keyword", "Chapter", "Article", "Part", "Section"]);
    expect(
      screen.getByText("Made-up reason: this fictional section holds the one rule asked about."),
    ).toBeInTheDocument();

    await user.click(fullPathButton()!);
    expect(screen.getByRole("region", { name: FIXED.guidedEndHeading })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: FIXED.runTimedButton })).toBeInTheDocument();
    expect(screen.getByText(guidedAllWhyPartsDrill.citation)).toBeInTheDocument();
  });

  it("runs a toc Article with no Parts to the full path", async () => {
    const { user } = setup(guidedAllWhyNoPartsDrill);
    await pick(user, "Keyword", "Fictional widget spacing");
    await pick(user, "Chapter", CHAPTER_LABELS[2]!);
    await pick(user, "Article", "Article 377");
    await pick(user, "Section", "377.20");
    await user.click(fullPathButton()!);
    expect(screen.getByRole("region", { name: FIXED.guidedEndHeading })).toBeInTheDocument();
  });

  it("runs Index Keyword Lookup from the first step to the full path", async () => {
    const { user, onRunTimed } = setup(guidedIndexClicksWhyDrill);
    expect(radio(INDEX_RADIO)).toHaveAttribute("aria-checked", "true");

    await walkIndex(user);
    expect(headings().slice(0, 3)).toEqual(["Keyword", "Index", "Section"]);
    await user.click(fullPathButton()!);
    expect(screen.getByRole("region", { name: FIXED.guidedEndHeading })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: FIXED.runTimedButton }));
    expect(onRunTimed).toHaveBeenCalledWith("index");
  });
});

describe("GuidedScreen has no Timed controls", () => {
  it("shows no Timer and no Check button during or after the run", async () => {
    const { user } = setup(guidedAllWhyPartsDrill);
    const assertNone = () => {
      expect(screen.queryByTestId("timer")).toBeNull();
      expect(screen.queryByRole("button", { name: FIXED.checkButton })).toBeNull();
    };
    assertNone();
    await walkToc(user);
    assertNone();
    await user.click(fullPathButton()!);
    assertNone();
  });
});

describe("GuidedScreen Method choice", () => {
  it("clears picks and keeps working after a Method change", async () => {
    const { user } = setup(guidedKeywordSectionWhyDrill);
    await pick(user, "Keyword", "Fictional gadgets");
    await pick(user, FIXED.indexEntryGroup, "Gadgets, spare, 555.4");
    expect(headings()).toEqual(["Keyword", "Index"]);

    await user.click(radio(TOC_RADIO));
    expect(radio(TOC_RADIO)).toHaveAttribute("aria-checked", "true");
    expect(headings()).toEqual(["Keyword"]);
    expect(within(screen.getByRole("main")).queryByRole("status")).toBeNull();

    await pick(user, "Keyword", "Fictional gadgets");
    await pick(user, "Chapter", CHAPTER_LABELS[4]!);
    await pick(user, "Article", "Article 555");
    await pick(user, "Section", "555.4");
    await pick(user, "Section", "555.4(B)");
    await pick(user, "Section", "555.4(B)(2)");
    expect(fullPathButton()).not.toBeNull();
  });

  it("moves and selects with the arrow keys, wrapping at both ends", async () => {
    const { user } = setup(guidedKeywordSectionWhyDrill);
    await pick(user, "Keyword", "Fictional gadgets");
    radio(INDEX_RADIO).focus();

    await user.keyboard("{ArrowRight}");
    expect(radio(TOC_RADIO)).toHaveAttribute("aria-checked", "true");
    expect(radio(TOC_RADIO)).toHaveFocus();
    expect(headings()).toEqual(["Keyword"]);

    await user.keyboard("{ArrowRight}");
    expect(radio(INDEX_RADIO)).toHaveAttribute("aria-checked", "true");
    expect(radio(INDEX_RADIO)).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(radio(TOC_RADIO)).toHaveAttribute("aria-checked", "true");

    // Still working after the key moves.
    await pick(user, "Keyword", "Fictional gadgets");
    expect(headings()).toEqual(["Keyword", "Chapter"]);
  });

  it("offers Index Keyword Lookup only when index_checked is true", () => {
    setup({ ...guidedIndexClicksWhyDrill, index_checked: false });
    expect(screen.queryByRole("radio", { name: INDEX_RADIO })).toBeNull();
    expect(radio(TOC_RADIO)).toHaveAttribute("aria-checked", "true");
  });

  it("offers both Methods, Index Keyword Lookup selected, when index_checked is true", () => {
    setup(guidedIndexClicksWhyDrill);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveAccessibleName(INDEX_RADIO);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
  });
});

describe("GuidedScreen moved article", () => {
  it("marks a pick matching only the movedFrom route incorrect, with no moved message", async () => {
    const { user } = setup(movedArticleDrill);
    await pick(user, "Keyword", "Fictional doohickey");
    await pick(user, "Chapter", CHAPTER_LABELS[4]!); // movedFrom route: Chapter 5

    const verdict = within(screen.getByRole("main")).getByRole("status");
    expect(verdict).toHaveTextContent(FIXED.verdictIncorrect);
    expect(verdict).toHaveTextContent(PROSE.guidedPickAgain);
    expect(screen.queryByText(PROSE.movedArticle)).toBeNull();
    expect(screen.queryByText(PROSE.verdictsAgainst2023)).toBeNull();
    expect(screen.queryByText(FIXED.movedLabel)).toBeNull();
    expect(screen.queryByText(movedArticleDrill.def.editionNote!)).toBeNull();

    // The current route still works at the same step.
    await pick(user, "Chapter", CHAPTER_LABELS[5]!);
    expect(headings()).toEqual(["Keyword", "Chapter", "Article"]);
  });
});

describe("GuidedScreen best times", () => {
  it("makes zero calls on the best-times store across a full run", async () => {
    const { user, get, submit } = setup(guidedAllWhyPartsDrill);
    await walkToc(user);
    await user.click(fullPathButton()!);
    await user.click(screen.getByRole("button", { name: FIXED.runTimedButton }));
    expect(get).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it("offers Back to drills mid-run, returns to the picker, and saves nothing", async () => {
    const { user, onBack, submit } = setup(guidedAllWhyPartsDrill);
    await user.click(screen.getByRole("button", { name: FIXED.backButton }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });
});
