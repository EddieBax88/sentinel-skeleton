// Unit test for the test generators. Everything here is fictional.
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { validateCodeTrail } from "@sentinel/skeleton-core";
import type { CodeTrail } from "@sentinel/skeleton-core";
import type { OptionNode, OptionTree } from "../../src/model/types";
import { validateDrillData } from "../../src/data/validateDrillData";
import { CLEAN_NAMES } from "../fixtures/fictionalNames";
import {
  arbBrokenWhy,
  arbDrill,
  arbDrillWithWhy,
  arbTrail,
  BROKEN_WHY_RULE,
  type TrailKind,
} from "./arbitraries";
import { treeFromTrails } from "./buildTree";

const KINDS: readonly TrailKind[] = [
  "main-chapter",
  "chapter9-table",
  "annex",
  "article90",
  "index",
];

const norm = (s: string): string => s.trim().toLowerCase();

/** Route of a trail as `keyword|level:value|...` (first leg only). */
function trailRoute(t: CodeTrail): string {
  return [`keyword:${norm(t.keyword)}`, ...t.legs[0].map((s) => `${s.level}:${norm(s.value)}`)].join("|");
}

/** Every root-to-leaf route made only of `correct` nodes. */
function correctRoutes(tree: OptionTree): string[] {
  const out: string[] = [];
  const walk = (nodes: readonly OptionNode[], prefix: string[]): void => {
    for (const n of nodes) {
      if (n.role !== "correct") continue;
      const here = [...prefix, `${n.level}:${norm(n.value)}`];
      if (n.next === undefined) out.push(here.join("|"));
      else walk(n.next, here);
    }
  };
  walk(tree, []);
  return out;
}

/** Route-equals-trail: the tree's all-correct routes match the trails one-to-one. */
function expectRoutesEqualTrails(tree: OptionTree, trails: readonly CodeTrail[]): void {
  const routes = correctRoutes(tree).sort();
  const expected = trails.map(trailRoute).sort();
  expect(new Set(routes).size).toBe(routes.length);
  expect(routes).toEqual(expected);
}

describe("arbTrail", () => {
  for (const kind of KINDS) {
    it(`generates trails that pass validateCodeTrail (${kind})`, () => {
      fc.assert(
        fc.property(arbTrail(kind), (t) => {
          expect(validateCodeTrail(t)).toEqual({ ok: true });
        }),
      );
    });
  }
});

describe("arbDrill", () => {
  it("generates definitions whose trails and movedFrom pass validateCodeTrail", () => {
    fc.assert(
      fc.property(arbDrill, (d) => {
        expect(validateCodeTrail(d.def)).toEqual({ ok: true });
      }),
    );
  });

  it("generates trees whose all-correct routes equal the declared trails one-to-one", () => {
    fc.assert(
      fc.property(arbDrill, (d) => {
        const tocTrails = d.def.trails.filter((t) => t.legs[0][0].level !== "index");
        const indexTrails = d.def.trails.filter((t) => t.legs[0][0].level === "index");
        expectRoutesEqualTrails(d.trees.toc, tocTrails);
        if (d.index_checked) {
          expect(d.trees.index).toBeDefined();
          expectRoutesEqualTrails(d.trees.index!, indexTrails);
        } else {
          expect(d.trees.index).toBeUndefined();
          expect(indexTrails).toHaveLength(0);
        }
      }),
    );
  });
});

describe("treeFromTrails", () => {
  it("matches the trails one-to-one for every trail kind, with and without a moved route", () => {
    for (const kind of KINDS) {
      fc.assert(
        fc.property(arbTrail(kind), (t) => {
          expectRoutesEqualTrails(treeFromTrails([t]), [t]);
        }),
      );
    }
  });

  it("keeps a moved route out of the all-correct routes", () => {
    const valid: CodeTrail = {
      keyword: "fictional alpha 1",
      legs: [
        [
          { level: "chapter", value: "Chapter 2" },
          { level: "article", value: "Article 200" },
          { level: "section", value: "200.1" },
        ],
      ],
    };
    const moved: CodeTrail = {
      keyword: "fictional alpha 1",
      legs: [
        [
          { level: "chapter", value: "Chapter 2" },
          { level: "article", value: "Article 1200" },
          { level: "section", value: "1200.1" },
        ],
      ],
    };
    expect(validateCodeTrail(moved)).toEqual({ ok: true });
    expectRoutesEqualTrails(treeFromTrails([valid], moved, [["Decoy x 1"]]), [valid]);
  });
});

function whysOf(nodes: readonly OptionNode[] | undefined, out: OptionNode[] = []): OptionNode[] {
  for (const n of nodes ?? []) {
    if (n.why !== undefined) out.push(n);
    whysOf(n.next, out);
  }
  return out;
}

describe("Why_Sentence generators", () => {
  it("leaves default arbDrill output free of any why", () => {
    fc.assert(
      fc.property(arbDrill, (d) => {
        expect(whysOf(d.trees.toc)).toHaveLength(0);
        expect(whysOf(d.trees.index)).toHaveLength(0);
      }),
    );
  });

  it("puts whys only on correct nodes and still passes validateDrillData", () => {
    let sawWhy = false;
    fc.assert(
      fc.property(arbDrillWithWhy, (d) => {
        const all = [...whysOf(d.trees.toc), ...whysOf(d.trees.index)];
        sawWhy ||= all.length > 0;
        for (const n of all) {
          expect(n.role).toBe("correct");
          expect(n.why!.length).toBeGreaterThanOrEqual(1);
          expect(n.why!.length).toBeLessThanOrEqual(300);
        }
        expect(validateDrillData([d], CLEAN_NAMES)).toEqual([]);
      }),
    );
    expect(sawWhy).toBe(true);
  });

  it("generates broken-why drills that the validator rejects with the matching rule", () => {
    fc.assert(
      fc.property(arbBrokenWhy, ({ kind, drill }) => {
        const rules = validateDrillData([drill], CLEAN_NAMES).map((i) => i.rule);
        expect(rules).toContain(BROKEN_WHY_RULE[kind]);
      }),
    );
  });
});
