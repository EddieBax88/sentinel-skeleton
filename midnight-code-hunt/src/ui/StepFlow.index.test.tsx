// Uses fictional fixtures only. Not real NEC content.
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { buildNamesIndex } from "../logic/displayName";
import { applyPick, canCheck, treeFor, viewFlow } from "../logic/stepEngine";
import { indexSubdivisionDrill } from "../../test/fixtures/fixtureDrills";
import { StepFlow } from "./StepFlow";

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});

const tree = treeFor(indexSubdivisionDrill, "index");

let latestPicks: readonly string[] = [];

/** StepFlow wired to the step engine, plus a Check button gated by canCheck. */
function Harness() {
  const [picks, setPicks] = useState<readonly string[]>([]);
  latestPicks = picks;
  return (
    <div>
      <StepFlow
        view={viewFlow(tree, picks, names)}
        onPick={(depth, value) => setPicks((p) => applyPick(tree, p, depth, value))}
      />
      <button type="button" disabled={!canCheck(tree, picks)}>
        Check
      </button>
    </div>
  );
}

const headings = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
const checkButton = () => screen.getByRole("button", { name: "Check" });

async function pick(user: ReturnType<typeof userEvent.setup>, group: string, name: string) {
  const g = screen.getAllByRole("group", { name: group }).at(-1)!; // latest group of that name
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await user.click(within(g).getByRole("button", { name: new RegExp(`^\\s*${esc}\\s*$`) }));
}

const selected = (group: string) =>
  within(screen.getByRole("group", { name: group }))
    .queryAllByRole("button", { pressed: true })
    .map((b) => b.textContent?.replace("\u2713", "").trim());

const ENTRY = "Index entry";
const NUMBER = "Number the Index gives";

async function walkToEnd(user: ReturnType<typeof userEvent.setup>) {
  await pick(user, "Keyword", "Fictional gadgets");
  await pick(user, ENTRY, "Gadgets, spare, 555.4");
  await pick(user, NUMBER, "555.4");
  await pick(user, "Section", "555.4(B)");
  await pick(user, "Section", "555.4(B)(2)");
}

describe("StepFlow under Index Keyword Lookup", () => {
  it("walks Keyword, Index, then Section steps in order", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(headings()).toEqual(["Keyword"]);

    await pick(user, "Keyword", "Fictional gadgets");
    expect(headings()).toEqual(["Keyword", "Index"]);
    await pick(user, ENTRY, "Gadgets, spare, 555.4");
    expect(headings()).toEqual(["Keyword", "Index"]);
    await pick(user, NUMBER, "555.4");
    expect(headings()).toEqual(["Keyword", "Index", "Section"]);
    expect(screen.queryByRole("heading", { name: "Chapter" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Article" })).toBeNull();
  });

  it("shows the Index step as one heading holding two clicks and records two picks", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await pick(user, "Keyword", "Fictional gadgets");
    await pick(user, ENTRY, "Gadgets, spare, 555.4");

    expect(screen.getAllByRole("heading", { name: "Index" })).toHaveLength(1);
    const section = screen.getByRole("heading", { name: "Index" }).closest("section")!;
    expect(within(section).getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual([
      ENTRY,
      NUMBER,
    ]);

    await pick(user, NUMBER, "555.4");
    expect(latestPicks).toEqual(["Fictional gadgets", "Gadgets, spare, 555.4", "555.4"]);
    expect(screen.getAllByRole("heading", { name: "Index" })).toHaveLength(1);
  });

  it("repeats the Section step for each subdivision", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await walkToEnd(user);
    expect(headings()).toEqual(["Keyword", "Index", "Section", "Section"]);
    expect(latestPicks).toEqual([
      "Fictional gadgets",
      "Gadgets, spare, 555.4",
      "555.4",
      "555.4(B)",
      "555.4(B)(2)",
    ]);
  });

  it("clears the second Index click and every later pick when the first changes", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await walkToEnd(user);

    await pick(user, ENTRY, "Gadgets, spare, 556.4");
    expect(latestPicks).toEqual(["Fictional gadgets", "Gadgets, spare, 556.4"]);
    expect(headings()).toEqual(["Keyword", "Index"]);
    // The decoy entry ends its path, so no second click is offered and Check is enabled.
    expect(screen.queryByRole("group", { name: NUMBER })).toBeNull();
    expect(checkButton()).toBeEnabled();

    // Re-picking the correct entry shows an empty second click.
    await pick(user, ENTRY, "Gadgets, spare, 555.4");
    expect(latestPicks).toEqual(["Fictional gadgets", "Gadgets, spare, 555.4"]);
    expect(selected(NUMBER)).toEqual([]);
    expect(screen.queryByRole("heading", { name: "Section" })).toBeNull();
  });

  it("keeps the first Index click when the second changes, clearing later picks", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await walkToEnd(user);

    await pick(user, NUMBER, "555.4");
    expect(latestPicks).toEqual(["Fictional gadgets", "Gadgets, spare, 555.4", "555.4"]);
    expect(selected(ENTRY)).toEqual(["Gadgets, spare, 555.4"]);
    expect(headings()).toEqual(["Keyword", "Index", "Section"]);
    expect(checkButton()).toBeDisabled();
  });

  it("keeps Check disabled until the latest pick ends its path", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(checkButton()).toBeDisabled();

    await pick(user, "Keyword", "Fictional gadgets");
    expect(checkButton()).toBeDisabled();
    await pick(user, ENTRY, "Gadgets, spare, 555.4");
    expect(checkButton()).toBeDisabled();
    await pick(user, NUMBER, "555.4");
    expect(checkButton()).toBeDisabled();
    await pick(user, "Section", "555.4(B)");
    expect(checkButton()).toBeDisabled();
    await pick(user, "Section", "555.4(B)(2)");
    expect(checkButton()).toBeEnabled();

    // Stepping back to a pick that has further steps disables Check again.
    await pick(user, "Keyword", "Fictional gadgets");
    expect(latestPicks).toEqual(["Fictional gadgets"]);
    expect(checkButton()).toBeDisabled();
  });
});
