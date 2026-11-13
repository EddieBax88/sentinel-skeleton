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
  options: { onOpen?: (id: string, mode: "guided" | "timed") => void; seed?: (s: ReturnType<typeof createBestTimesStore>) => void } = {},
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

const itemFor = (label: string) =>
  screen.getAllByRole("listitem").find((li) => li.textContent?.includes(label))!;

describe("DrillPicker", () => {
  it("lists the filtered drills by label in filter order, with the benefit and NEC copy", () => {
    renderPicker([articleWithPartsDrill, draftDrill, movedArticleDrill], "production");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(articleWithPartsDrill.def.label);
    expect(items[1]).toHaveTextContent(movedArticleDrill.def.label);
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
    const withTimes = itemFor(articleWithPartsDrill.def.label);
    expect(within(withTimes).getByText(`${METHOD_LABELS.index}: ${FIXED.bestTimeLabel} 1:15`)).toBeInTheDocument();
    expect(within(withTimes).getByText(`${METHOD_LABELS.toc}: ${FIXED.bestTimeLabel} 2:05`)).toBeInTheDocument();
    const without = itemFor(articleNoPartsDrill.def.label);
    expect(without).not.toHaveTextContent(FIXED.bestTimeLabel);
  });

  it("shows only the method that has a saved best time", () => {
    renderPicker([articleWithPartsDrill], "production", {
      seed: (s) => void s.submit(articleWithPartsDrill.def.id, "toc", 59),
    });
    const button = itemFor(articleWithPartsDrill.def.label);
    expect(button).toHaveTextContent(`${METHOD_LABELS.toc}: ${FIXED.bestTimeLabel} 0:59`);
    expect(button).not.toHaveTextContent(METHOD_LABELS.index);
  });

  it("shows the moved label only on drills with movedFrom", () => {
    renderPicker([articleWithPartsDrill, movedArticleDrill], "production");
    expect(screen.getAllByText(FIXED.movedLabel)).toHaveLength(1);
    const moved = itemFor(movedArticleDrill.def.label);
    expect(moved).toHaveTextContent(FIXED.movedLabel);
    const plain = itemFor(articleWithPartsDrill.def.label);
    expect(plain).not.toHaveTextContent(FIXED.movedLabel);
  });

  it.each<BuildMode>(["test", "development"])(
    "shows the Draft badge as text only on draft drills in %s mode",
    (mode) => {
      renderPicker([articleWithPartsDrill, draftDrill], mode);
      expect(screen.getAllByText(FIXED.draftBadge)).toHaveLength(1);
      const draft = itemFor(draftDrill.def.label);
      expect(draft).toHaveTextContent(FIXED.draftBadge);
      const checked = itemFor(articleWithPartsDrill.def.label);
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
    const button = within(itemFor(articleWithPartsDrill.def.label)).getByRole("button", {
      name: new RegExp(`${FIXED.modeTimed}.*${articleWithPartsDrill.def.label}`),
    });
    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onOpen).toHaveBeenCalledTimes(3);
    expect(onOpen).toHaveBeenCalledWith(articleWithPartsDrill.def.id, "timed");
  });

  it("renders two buttons per drill, Guided then Timed, with distinct names containing the visible text", () => {
    renderPicker([articleWithPartsDrill, movedArticleDrill], "production");
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
    const names = new Set<string>();
    for (const drill of [articleWithPartsDrill, movedArticleDrill]) {
      const own = within(itemFor(drill.def.label)).getAllByRole("button");
      expect(own).toHaveLength(2);
      expect(own[0]).toHaveTextContent(FIXED.modeGuided);
      expect(own[1]).toHaveTextContent(FIXED.modeTimed);
      for (const b of own) {
        const name = b.getAttribute("aria-labelledby")!
          .split(" ")
          .map((id) => document.getElementById(id)!.textContent)
          .join(" ");
        expect(name).toContain(b.textContent!);
        expect(name).toContain(drill.def.label);
        names.add(name);
      }
      expect(own[0]).toHaveAccessibleName(`${FIXED.modeGuided} ${drill.def.label}`);
      expect(own[1]).toHaveAccessibleName(`${FIXED.modeTimed} ${drill.def.label}`);
    }
    expect(names.size).toBe(4);
  });

  it("calls onOpen with the drill id and the mode of the clicked button", async () => {
    const user = userEvent.setup();
    const { onOpen } = renderPicker([articleWithPartsDrill, movedArticleDrill], "production");
    const [guided, timed] = within(itemFor(movedArticleDrill.def.label)).getAllByRole("button");
    await user.click(guided);
    expect(onOpen).toHaveBeenLastCalledWith(movedArticleDrill.def.id, "guided");
    await user.click(timed);
    expect(onOpen).toHaveBeenLastCalledWith(movedArticleDrill.def.id, "timed");
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("shows one Draft badge, one moved label, and one best-time list per drill, not per button", () => {
    const draftMoved: DrillRecord = {
      ...movedArticleDrill,
      def: { ...movedArticleDrill.def, id: "draft-moved-x", label: "Draft moved drill" },
      founder_checked: false,
    };
    renderPicker([draftMoved], "test", {
      seed: (s) => void s.submit(draftMoved.def.id, "index", 75),
    });
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getAllByText(FIXED.draftBadge)).toHaveLength(1);
    expect(screen.getAllByText(FIXED.movedLabel)).toHaveLength(1);
    expect(screen.getAllByText(FIXED.bestTimeLabel, { exact: false })).toHaveLength(1);
    expect(screen.getAllByText(draftMoved.def.label)).toHaveLength(1);
  });
});
