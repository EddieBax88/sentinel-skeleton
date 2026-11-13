// Uses fictional fixtures only. Not real NEC content.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { articleNoPartsDrill } from "../../test/fixtures/fixtureDrills";
import { guidedAllWhyNoPartsDrill } from "../../test/fixtures/guidedDrills";
import App, { AppView } from "../App";
import { FIXED, FOOTER_DISCLAIMER } from "../copy/strings";
import { buildNamesIndex } from "../logic/displayName";
import { filterDrills } from "../logic/filterDrills";
import { gradeAttempt } from "../logic/grading";
import { DrillPicker } from "./DrillPicker";
import { DrillScreen } from "./DrillScreen";
import { Footer } from "./Footer";
import { ResultScreen } from "./ResultScreen";
import { Shell } from "./Shell";

const REQUIRED =
  "Sentinel Learning is an independent study aid, not affiliated with the NFPA or any licensing board. NEC\u00AE is a registered trademark of the NFPA.";

const noop = () => {};

function footerText(): string | null {
  return screen.getByRole("contentinfo").textContent;
}

describe("footer disclaimer", () => {
  it("constant equals the required string character for character", () => {
    expect(FOOTER_DISCLAIMER).toBe(REQUIRED);
    expect(FOOTER_DISCLAIMER.includes("\u00AE")).toBe(true);
  });

  it("Footer renders exactly FOOTER_DISCLAIMER", () => {
    render(<Footer />);
    expect(footerText()).toBe(FOOTER_DISCLAIMER);
  });

  it("shows on the picker screen (via App)", () => {
    render(<App />);
    expect(footerText()).toBe(REQUIRED);
  });

  it("shows on the drill screen", () => {
    const entries = filterDrills([articleNoPartsDrill], "development");
    render(
      <Shell title="Drill">
        <DrillScreen
          drillId={articleNoPartsDrill.def.id}
          entries={entries}
          buildMode="development"
          onBack={noop}
        />
      </Shell>,
    );
    expect(footerText()).toBe(REQUIRED);
  });

  it("shows on the picker screen with drills listed", () => {
    const entries = filterDrills([articleNoPartsDrill], "development");
    render(
      <Shell title="Pick">
        <DrillPicker entries={entries} buildMode="development" onOpen={noop} />
      </Shell>,
    );
    expect(footerText()).toBe(REQUIRED);
  });

  it("shows on the result screen", () => {
    const names = buildNamesIndex({
      y2023: { edition: 2023, entries: [] },
      y2026: { edition: 2026, entries: [] },
    });
    const model = gradeAttempt(articleNoPartsDrill, "toc", [], names, {
      timeUp: true,
      elapsedSeconds: 120,
    });
    render(
      <Shell title="Result">
        <ResultScreen model={model} onTryAgain={noop} onBack={noop} />
      </Shell>,
    );
    expect(footerText()).toBe(REQUIRED);
  });
});

describe("footer disclaimer on Guided screens", () => {
  it("is identical on the Guided screen and the Guided end screen (Req 15.5, 19.14, 21.9)", async () => {
    const user = userEvent.setup();
    const entries = filterDrills([guidedAllWhyNoPartsDrill], "test");
    render(<AppView entries={entries} buildMode="test" />);
    const label = guidedAllWhyNoPartsDrill.def.label;
    const picker = footerText();

    await user.click(
      screen.getByRole("button", { name: new RegExp(`^${FIXED.modeGuided}\\b.*${label}`) }),
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(label);
    const guided = footerText();

    const choose = async (group: string, name: string) => {
      const g = screen.getAllByRole("group", { name: group }).at(-1)!;
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      await user.click(
        within(g).getByRole("button", { name: new RegExp(`^\\s*${esc}\\s*$`) }),
      );
    };
    await choose("Keyword", "Fictional widget spacing");
    await choose("Chapter", "Ch 3 Build: wiring methods, raceways, cables, boxes");
    await choose("Article", "Article 377");
    await choose("Section", "377.20");
    await user.click(screen.getByRole("button", { name: FIXED.showFullPathButton }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(FIXED.guidedEndHeading);
    const end = footerText();

    expect(guided).toBe(REQUIRED);
    expect(end).toBe(REQUIRED);
    expect(guided).toBe(picker);
    expect(end).toBe(guided);
  });
});
