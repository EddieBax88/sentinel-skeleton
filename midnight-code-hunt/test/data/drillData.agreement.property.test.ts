// Feature: midnight-code-hunt, Property 26: Declared trails and Option_Trees agree
// **Validates: Requirements 17.1, 17.3, 17.4, 17.5, 17.6, 17.9, 2.12, 2.16**
// All drills here are fictional, built by test/support generators.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateDrillData } from "../../src/data/validateDrillData";
import type { DrillRecord, OptionNode, OptionTree } from "../../src/model/types";
import { BROKEN_CASES } from "../fixtures/brokenDrills";
import { CLEAN_NAMES } from "../fixtures/fictionalNames";
import { arbDrill } from "../support/arbitraries";

const RUNS = { numRuns: 150 };

type Group = readonly OptionNode[];

/** Edit the leaf group on the first all-correct route of a tree. */
function editLeafGroup(tree: Group, fn: (g: Group) => Group): Group {
  const idx = tree.findIndex((n) => n.role === "correct");
  const node = tree[idx];
  if (node === undefined || node.next === undefined) return fn(tree);
  const next = editLeafGroup(node.next, fn);
  return tree.map((n, i) => (i === idx ? ({ ...n, next } as OptionNode) : n));
}

function leafOf(tree: Group): OptionNode {
  const node = tree.find((n) => n.role === "correct") as OptionNode;
  return node.next === undefined ? node : leafOf(node.next);
}

const withToc = (d: DrillRecord, f: (g: Group) => Group): DrillRecord => ({
  ...d,
  trees: { ...d.trees, toc: f(d.trees.toc) as unknown as OptionTree },
});

const rulesOf = (d: DrillRecord): string[] =>
  validateDrillData([d], CLEAN_NAMES).map((i) => i.rule);

describe("Property 26: declared trails and Option_Trees agree", () => {
  it("reports no issues for any generated drill", () => {
    fc.assert(
      fc.property(arbDrill, (drill) => {
        expect(validateDrillData([drill], CLEAN_NAMES)).toEqual([]);
      }),
      RUNS,
    );
  });

  it("reports a phantom route when an extra all-correct route is added (R17.9)", () => {
    fc.assert(
      fc.property(arbDrill, (drill) => {
        const leaf = leafOf(drill.trees.toc);
        const mutated = withToc(drill, (t) =>
          editLeafGroup(t, (g) => [...g, { level: leaf.level, value: "zz phantom 999", role: "correct" } as OptionNode]),
        );
        expect(rulesOf(mutated)).toContain("R17.9-phantom");
      }),
      RUNS,
    );
  });

  it("reports an unreachable trail when the correct leaf is renamed (R17.9)", () => {
    fc.assert(
      fc.property(arbDrill, (drill) => {
        const mutated = withToc(drill, (t) =>
          editLeafGroup(t, (g) =>
            g.map((n) => (n.role === "correct" ? ({ ...n, value: `${String(n.value)} zz renamed` } as OptionNode) : n)),
          ),
        );
        expect(rulesOf(mutated)).toContain("R17.9-reach");
      }),
      RUNS,
    );
  });

  it("reports a wrong option that repeats a correct sibling value (R2.12)", () => {
    fc.assert(
      fc.property(arbDrill, (drill) => {
        const leaf = leafOf(drill.trees.toc);
        const mutated = withToc(drill, (t) =>
          editLeafGroup(t, (g) => [...g, { level: leaf.level, value: leaf.value, role: "wrong" } as OptionNode]),
        );
        expect(rulesOf(mutated)).toContain("R2.12");
      }),
      RUNS,
    );
  });

  it("reports a leaf group with a next level that is an empty list (R17.9)", () => {
    fc.assert(
      fc.property(arbDrill, (drill) => {
        const mutated = withToc(drill, (t) =>
          editLeafGroup(t, (g) =>
            g.map((n) => (n.role === "correct" ? ({ ...n, next: [] } as unknown as OptionNode) : n)),
          ),
        );
        expect(rulesOf(mutated)).toContain("R17.9-end");
      }),
      RUNS,
    );
  });

  it("reports a moved-from trail that grades as a valid trail (R17.6)", () => {
    fc.assert(
      fc.property(
        arbDrill.filter((d) => d.def.movedFrom !== undefined),
        (drill) => {
          const mutated: DrillRecord = {
            ...drill,
            def: { ...drill.def, movedFrom: drill.def.trails[0] },
          };
          expect(rulesOf(mutated)).toContain("R17.6");
        },
      ),
      RUNS,
    );
  });

  it("reports a founder-checked drill whose wrong options are unreviewed (R2.11)", () => {
    fc.assert(
      fc.property(arbDrill, (drill) => {
        const mutated = { ...drill, founder_checked: true, wrongOptionsReviewed: false };
        expect(rulesOf(mutated)).toContain("R2.11");
      }),
      RUNS,
    );
  });

  it("reports shared ids (R2.13)", () => {
    fc.assert(
      fc.property(arbDrill, (drill) => {
        const rules = validateDrillData([drill, drill], CLEAN_NAMES).map((i) => i.rule);
        expect(rules).toContain("R2.13");
      }),
      RUNS,
    );
  });

  it("reports a missing Index tree when Index lookup is marked checked (R6.4)", () => {
    fc.assert(
      fc.property(arbDrill, (drill) => {
        const { index: _omit, ...trees } = drill.trees;
        const mutated: DrillRecord = { ...drill, index_checked: true, trees };
        if (drill.trees.index === undefined) {
          expect(rulesOf(mutated)).toContain("R6.4");
        } else {
          expect(rulesOf({ ...drill, trees })).toContain("R17.9-reach");
        }
      }),
      RUNS,
    );
  });

  it("every fixture broken drill reports its expected rule code on the right drill", () => {
    for (const c of BROKEN_CASES) {
      const issues = validateDrillData(c.drills, c.names);
      expect(
        issues.some((i) => i.rule === c.rule && i.drillId === c.drillId),
        `${c.rule}: ${c.description}`,
      ).toBe(true);
    }
  });
});
