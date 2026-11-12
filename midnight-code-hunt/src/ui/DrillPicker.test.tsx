import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  articleNoPartsDrill,
  articleWithPartsDrill,
  movedArticleDrill,
} from "../../test/fixtures/fixtureDrills";
import { FIXED, PROSE } from "../copy/strings";
import { createBestTimesStore } from "../logic/bestTimes";
import { filterDrills, type BuildMode } from "../logic/filterDrills";
import type { DrillRecord } from "../model/types";
import { METHOD_LABELS } from "../model/methods";
import { DrillPicker } from "./DrillPicker";
import { BestTimesContext } from "./providers";

/** In-memory storage so no test touches localStorage. */
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const draftDrill: DrillRecord = { ...articleNoPartsDrill, founder_checked: false };

function renderPicker(
  drills: readonly DrillRecord[],
  mode: BuildMode,
  options: { onOpen?: (id: string) => void; seed?: (s: ReturnType<typeof createBestTimesStore>) => void } = {},
) {
  const store = createBestTimesStore(memoryStorage());
  options.seed?.(store);
  const onOpen = options.onOpen ?? vi.fn();
  render(
    <BestTimesContext.Provider value={store}>
      <DrillPicker entries={filterDrills(drills, mode)} buildMode={mode} onOpen={onOpen} />
    </BestTimesContext.Provider>,
  );
  return { onOpen };
}

describe("DrillPicker", () => {
  it("lists the filtered drills by label in filter order, with the benefit and NEC copy", () => {
    renderPicker([articleWithPartsDrill, draftDrill, movedArticleDrill], "production");
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent(articleWithPartsDrill.def.label);
    expect(buttons[1]).toHaveTextContent(movedArticleDrill.def.label);
    expect(screen.queryByText(draftDrill.def.label)).not.toBeInTheDocument();
    expect(screen.getByText(PROSE.pickerBenefit)).toBeInTheDocument();
    expect(PROSE.pickerBenefit.length).toBeLessThanOrEqual(120);
    expect(screen.getByText(PROSE.pickerNecNote)).toHaveTextContent("2026 NEC");
  });

  it("shows a best time per method only for methods that have one", () => {
    const id = articleWithPartsDrill.def.id;
    renderPicker([articleWithPartsDrill, articleNoPartsDrill], "production", {
      seed: (s) => {
        s.submit(id, "index", 75);
        s.submit(id, "toc", 125);
      },
    });
    const withTimes = screen.getByRole("button", { name: new RegExp(articleWithPartsDrill.def.label) });
    expect(within(withTimes).getByText(`${METHOD_LABELS.index}: ${FIXED.bestTimeLabel} 1:15`)).toBeInTheDocument();
    expect(within(withTimes).getByText(`${METHOD_LABELS.toc}: ${FIXED.bestTimeLabel} 2:05`)).toBeInTheDocument();
    const without = screen.getByRole("button", { name: new RegExp(articleNoPartsDrill.def.label) });
    expect(without).not.toHaveTextContent(FIXED.bestTimeLabel);
  });

  it("shows only the method that has a saved best time", () => {
    renderPicker([articleWithPartsDrill], "production", {
      seed: (s) => void s.submit(articleWithPartsDrill.def.id, "toc", 59),
    });
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent(`${METHOD_LABELS.toc}: ${FIXED.bestTimeLabel} 0:59`);
    expect(button).not.toHaveTextContent(METHOD_LABELS.index);
  });

  it("shows the moved label only on drills with movedFrom", () => {
    renderPicker([articleWithPartsDrill, movedArticleDrill], "production");
    expect(screen.getAllByText(FIXED.movedLabel)).toHaveLength(1);
    const moved = screen.getByRole("button", { name: new RegExp(movedArticleDrill.def.label) });
    expect(moved).toHaveTextContent(FIXED.movedLabel);
    const plain = screen.getByRole("button", { name: new RegExp(articleWithPartsDrill.def.label) });
    expect(plain).not.toHaveTextContent(FIXED.movedLabel);
  });

  it.each<BuildMode>(["test", "development"])(
    "shows the Draft badge as text only on draft drills in %s mode",
    (mode) => {
      renderPicker([articleWithPartsDrill, draftDrill], mode);
      expect(screen.getAllByText(FIXED.draftBadge)).toHaveLength(1);
      const draft = screen.getByRole("button", { name: new RegExp(draftDrill.def.label) });
      expect(draft).toHaveTextContent(FIXED.draftBadge);
      const checked = screen.getByRole("button", { name: new RegExp(articleWithPartsDrill.def.label) });
      expect(checked).not.toHaveTextContent(FIXED.draftBadge);
    },
  );

  it("shows no Draft badge in production", () => {
    renderPicker([articleWithPartsDrill, draftDrill], "production");
    expect(screen.queryByText(FIXED.draftBadge)).not.toBeInTheDocument();
  });

  it("shows the coming-soon message and no drills for an empty production list", () => {
    renderPicker([draftDrill], "production");
    expect(screen.getByRole("status")).toHaveTextContent(PROSE.pickerComingSoon);
    expect(PROSE.pickerComingSoon.length).toBeLessThanOrEqual(120);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("shows the short no-drills message for an empty non-production list", () => {
    renderPicker([], "test");
    expect(screen.getByRole("status")).toHaveTextContent(PROSE.pickerNoDrillsDev);
    expect(screen.queryByText(PROSE.pickerComingSoon)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("opens a drill by click, Enter, and Space", async () => {
    const user = userEvent.setup();
    const { onOpen } = renderPicker([articleWithPartsDrill], "production");
    const button = screen.getByRole("button");
    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onOpen).toHaveBeenCalledTimes(3);
    expect(onOpen).toHaveBeenCalledWith(articleWithPartsDrill.def.id);
  });
});
