// Uses fictional fixtures only. Not real NEC content.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { articleNoPartsDrill } from "../../test/fixtures/fixtureDrills";
import App from "../App";
import { FOOTER_DISCLAIMER } from "../copy/strings";
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
