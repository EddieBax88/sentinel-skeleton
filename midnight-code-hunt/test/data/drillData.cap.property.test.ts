// Feature: midnight-code-hunt, Property 30: The Chapter step is exempt from the wrong-option cap
// Validates: Requirements 2.5, 9.8
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateDrillData } from "../../src/data/validateDrillData";
import type { DrillRecord, OptionNode, OptionTree } from "../../src/model/types";
import { CLEAN_NAMES } from "../fixtures/fictionalNames";
import { arbDrill } from "../support/arbitraries";

const RUNS = { numRuns: 100 };

type Group = readonly OptionNode[];

/** R2.5 issues that are about the wrong-option cap (not the missing-Chapter check). */
const capIssues = (drill: DrillRecord) =>
  validateDrillData([drill], CLEAN_NAMES).filter(
    (i) => i.rule === "R2.5" && i.message.includes("wrong options"),
  );

/** All R2.5 issues for this drill. */
const r25Issues = (drill: DrillRecord) =>
  validateDrillData([drill], CLEAN_NAMES).filter((i) => i.rule === "R2.5");

/** The sibling groups along the first-node chain of a tree; index = depth. */
function chain(tree: Group): Group[] {
  const groups: Group[] = [];
  let group: Group | undefined = tree;
  while (group !== undefined && group.length > 0) {
    groups.push(group);
    group = group[0]?.next;
  }
  return groups;
}

/** Rebuilds `group` so that it holds exactly `count` wrong nodes, deeper groups kept. */
function withWrongCount(group: Group, count: number): OptionNode[] {
  const kept = group.filter((n) => n.role !== "wrong");
  const level = (group[0] as OptionNode).level;
  const extra: OptionNode[] = Array.from({ length: count }, (_, i) =>
    level === "article"
      ? { level, value: `Fresh wrong ${i}`, role: "wrong" as const, hasParts: false }
      : ({ level, value: `Fresh wrong ${i}`, role: "wrong" as const } as OptionNode),
  );
  return [...kept, ...extra];
}

/** Replaces the group at `depth` along the first-node chain with `replacement`. */
function replaceAt(group: Group, depth: number, replacement: (g: Group) => OptionNode[]): OptionNode[] {
  if (depth === 0) return replacement(group);
  const [first, ...rest] = group as [OptionNode, ...OptionNode[]];
  const next = first.next === undefined ? undefined : replaceAt(first.next, depth - 1, replacement);
  const rebuilt = (next === undefined ? { ...first } : { ...first, next }) as OptionNode;
  return [rebuilt, ...rest];
}

function withTocTree(drill: DrillRecord, toc: OptionNode[]): DrillRecord {
  return { ...drill, trees: { ...drill.trees, toc: toc as unknown as OptionTree } };
}

describe("Property 30: Chapter step is exempt from the wrong-option cap", () => {
  it("the toc Chapter level holds nine options and never triggers the cap", () => {
    fc.assert(
      fc.property(arbDrill, (drill) => {
        const groups = chain(drill.trees.toc);
        const chapter = groups.find((g) => g[0]?.level === "chapter");
        // Annex and Article 90 trails have no Chapter step; the rest always show nine.
        if (chapter !== undefined) expect(chapter).toHaveLength(9);
        // Chapter-level wrong nodes may exceed six (eight when one Chapter is authored).
        expect(capIssues(drill)).toEqual([]);
        expect(r25Issues(drill)).toEqual([]);
      }),
      RUNS,
    );
  });

  it("any other toc level (Keyword included) takes 0 to 6 wrong nodes, and 7 or more raise R2.5 naming the drill", () => {
    fc.assert(
      fc.property(
        arbDrill,
        fc.nat({ max: 20 }),
        fc.integer({ min: 0, max: 10 }),
        (drill, pick, count) => {
          const groups = chain(drill.trees.toc);
          const depths = groups.map((g, d) => ({ g, d })).filter(({ g }) => g[0]?.level !== "chapter");
          const { d } = depths[pick % depths.length] as { g: Group; d: number };
          const mutated = withTocTree(
            drill,
            replaceAt(drill.trees.toc, d, (g) => withWrongCount(g, count)),
          );
          const issues = capIssues(mutated);
          if (count <= 6) {
            expect(issues).toEqual([]);
          } else {
            expect(issues.length).toBeGreaterThanOrEqual(1);
            for (const issue of issues) expect(issue.drillId).toBe(drill.def.id);
          }
        },
      ),
      RUNS,
    );
  });
});
