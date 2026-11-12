import { describe, expect, it } from "vitest";
import {
  articleNoPartsDrill,
  articleWithPartsDrill,
  chapter9TableDrill,
  indexSubdivisionDrill,
} from "../../test/fixtures/fixtureDrills";
import { buildNamesIndex } from "./displayName";
import {
  applyPick,
  canCheck,
  optionsAt,
  resolvePath,
  treeFor,
  viewFlow,
} from "./stepEngine";

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});

describe("stepEngine", () => {
  it("shows only the keyword click first and completes chapters to nine", () => {
    const tree = treeFor(articleWithPartsDrill, "toc");
    const first = viewFlow(tree, [], names);
    expect(first.steps).toHaveLength(1);
    expect(first.steps[0]?.label).toBe("keyword");
    expect(canCheck(tree, [])).toBe(false);

    const picks = applyPick(tree, [], 0, "Fictional gizmo wiring");
    expect(optionsAt(tree, picks, 1)).toHaveLength(9);
    const second = viewFlow(tree, picks, names);
    expect(second.steps.map((s) => s.label)).toEqual(["keyword", "chapter"]);
    expect(second.steps[1]?.clicks[0]?.options[0]?.text).toBe("Ch 1 General");
  });

  it("walks Article with Parts through part, and no-Parts straight to section", () => {
    const withParts = treeFor(articleWithPartsDrill, "toc");
    const p = ["Fictional gizmo wiring", "Chapter 4", "Article 481"];
    expect(resolvePath(withParts, p)).toHaveLength(3);
    expect(viewFlow(withParts, p, names).steps.at(-1)?.label).toBe("part");

    const noParts = treeFor(articleNoPartsDrill, "toc");
    const q = ["Fictional widget spacing", "Chapter 3", "Article 377"];
    expect(viewFlow(noParts, q, names).steps.at(-1)?.label).toBe("section");
  });

  it("clears later picks when an earlier pick changes and ignores unoffered values", () => {
    const tree = treeFor(articleNoPartsDrill, "toc");
    const full = ["Fictional widget spacing", "Chapter 3", "Article 377", "377.20"];
    expect(canCheck(tree, full)).toBe(true);
    expect(applyPick(tree, full, 1, "Chapter 5")).toEqual([
      "Fictional widget spacing",
      "Chapter 5",
    ]);
    expect(applyPick(tree, full, 1, "nonsense")).toBe(full);
  });

  it("sets showRowNote for a Chapter 9 table path", () => {
    const tree = treeFor(chapter9TableDrill, "toc");
    const picks = ["Fictional sprocket sizes", "Chapter 9", "Table 99"];
    const view = viewFlow(tree, picks, names);
    expect(view.pathEnded).toBe(true);
    expect(view.showRowNote).toBe(true);
    expect(viewFlow(tree, picks.slice(0, 2), names).showRowNote).toBe(false);
  });

  it("groups the two Index clicks into one index step", () => {
    const tree = treeFor(indexSubdivisionDrill, "index");
    const one = ["Fictional gadgets", "Gadgets, spare, 555.4"];
    const v1 = viewFlow(tree, one, names);
    expect(v1.steps.map((s) => s.label)).toEqual(["keyword", "index"]);
    expect(v1.steps[1]?.clicks).toHaveLength(2);
    expect(v1.steps[1]?.clicks[1]?.selected).toBeUndefined();

    const two = [...one, "555.4"];
    expect(applyPick(tree, [...two, "555.4(B)"], 1, "Gadgets, spare, 555.4")).toEqual(one);
    expect(applyPick(tree, two, 2, "555.4")).toEqual(two);
    expect(viewFlow(tree, two, names).steps.at(-1)?.label).toBe("section");
  });
});
