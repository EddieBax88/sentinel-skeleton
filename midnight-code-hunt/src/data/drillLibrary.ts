import { defineCodeTrail, extractFirstNumber, makeTableValue } from "@sentinel/skeleton-core";
import type { CodeTrail, TrailLevel, TrailStep } from "@sentinel/skeleton-core";
import { completeChapterOptions } from "../logic/chapters";
import { defineDrill } from "../model/types";
import type { DrillRecord, NodeLevel, OptionNode, OptionRole, OptionTree } from "../model/types";

/*
 * Drill library.
 *
 * Content rules:
 * - The founder supplies every question, answer, trail, hint, Index entry,
 *   and citation.
 * - Every new record starts with `founder_checked`, `index_checked`, and
 *   `wrongOptionsReviewed` all set to `false`.
 * - Kiro may draft only wrong options, and only when the founder asks. A
 *   record with drafted wrong options keeps `wrongOptionsReviewed: false`.
 * - Any table-sourced value is built with `makeTableValue`, with a `source`
 *   naming the table and `nfpa_checked: false`.
 *
 * Batch 1: Table of Contents Lookup only. No Index trail and no Index tree
 * while the founder is still checking Index entries.
 *
 * Entry notes:
 * - `label` is not founder content. It is the drill `id` in sentence case and
 *   is a placeholder until the founder supplies labels.
 * - `citation` is the last step of the founder's trail, nothing more.
 * - The Chapter step shows the nine fixed Chapters, so it needs no wrong list.
 * - A lettered or numbered subdivision is its own Section step. Each Section
 *   value carries the whole number, for example 210.8, then 210.8(A), then
 *   210.8(A)(7).
 */

// ---------------------------------------------------------------------------
// Entry helpers (data entry only; no NEC content lives in this section)
// ---------------------------------------------------------------------------

const step = (level: TrailLevel, value: string): TrailStep => ({ level, value });

const trailOf = (keyword: string, steps: readonly [TrailStep, ...TrailStep[]]): CodeTrail => ({
  keyword,
  legs: [steps],
});

/** A drafted wrong Article. `hasParts` is the marker the Step_Flow uses. */
type ArticleDecoy = { readonly article: number; readonly hasParts: boolean };
const article = (n: number, hasParts: boolean): ArticleDecoy => ({ article: n, hasParts });

/**
 * Drafted wrong options, level by level.
 * - `keyword`: wrong Keyword options.
 * - `articles`: wrong Article options (empty for a Chapter 9 trail).
 * - `rest`: wrong options for each step after the Article, in trail order
 *   (the Part, then each Section or Table step).
 */
type Decoys = {
  readonly keyword: readonly string[];
  readonly articles: readonly ArticleDecoy[];
  readonly rest: readonly (readonly string[])[];
};

const norm = (value: string): string => value.trim().toLowerCase();

const articleKey = (value: string): string => `article-${String(extractFirstNumber(value))}`;

type NodeOptions = {
  readonly next?: readonly OptionNode[];
  readonly hasParts?: boolean;
};

function makeNode(level: NodeLevel, value: string, role: OptionRole, options: NodeOptions = {}): OptionNode {
  const next =
    options.next !== undefined && options.next.length > 0
      ? { next: options.next as unknown as [OptionNode, ...OptionNode[]] }
      : {};
  if (level === "article") {
    return {
      level,
      value,
      role,
      designator: value,
      nameKey: articleKey(value),
      hasParts: options.hasParts ?? false,
      ...next,
    };
  }
  return { level, value, role, ...next };
}

/** Moves the first `seed % n` options to the end, so the right option does not always sit first. */
function rotate(nodes: readonly OptionNode[], seed: number): OptionNode[] {
  const shift = nodes.length > 1 ? seed % nodes.length : 0;
  return [...nodes.slice(shift), ...nodes.slice(0, shift)];
}

/**
 * Builds the Table of Contents option tree from the founder's trail plus the
 * drafted wrong options. A `movedFrom` route shares the nodes it has in common
 * with the trail and adds `moved` nodes where it differs.
 */
function buildTocTree(
  id: string,
  trail: CodeTrail,
  decoys: Decoys,
  movedFrom?: CodeTrail,
): OptionTree {
  const flat = (t: CodeTrail): { level: NodeLevel; value: string }[] => [
    { level: "keyword", value: t.keyword },
    ...t.legs.flat().map((s) => ({ level: s.level as NodeLevel, value: s.value })),
  ];
  const steps = flat(trail);
  const movedSteps = movedFrom === undefined ? undefined : flat(movedFrom);

  // First depth where the movedFrom route leaves the valid trail.
  let diverge = -1;
  if (movedSteps !== undefined) {
    const limit = Math.max(steps.length, movedSteps.length);
    for (let d = 0; d < limit; d++) {
      const a = steps[d];
      const b = movedSteps[d];
      if (a === undefined || b === undefined || a.level !== b.level || norm(a.value) !== norm(b.value)) {
        diverge = d;
        break;
      }
    }
  }

  const seed = [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0);

  // Index into `decoys.rest` for each depth after the Article.
  const restIndex = new Map<number, number>();
  let counted = 0;
  steps.forEach((s, d) => {
    if (s.level !== "keyword" && s.level !== "chapter" && s.level !== "article") {
      restIndex.set(d, counted++);
    }
  });

  const movedChain = (from: number): OptionNode | undefined => {
    if (movedSteps === undefined || from >= movedSteps.length) return undefined;
    const s = movedSteps[from] as { level: NodeLevel; value: string };
    const below = movedChain(from + 1);
    return makeNode(s.level, s.value, "moved", {
      next: below === undefined ? [] : [below],
      hasParts: movedSteps[from + 1]?.level === "part",
    });
  };

  const group = (depth: number): OptionNode[] => {
    const s = steps[depth] as { level: NodeLevel; value: string };
    const below = depth + 1 < steps.length ? group(depth + 1) : [];
    const correct = makeNode(s.level, s.value, "correct", {
      next: below,
      hasParts: steps[depth + 1]?.level === "part",
    });
    const nodes: OptionNode[] = [correct];
    if (diverge === depth) {
      const moved = movedChain(depth);
      if (moved !== undefined) nodes.push(moved);
    }

    if (s.level === "chapter") return [...completeChapterOptions(nodes)];

    if (s.level === "keyword") {
      for (const value of decoys.keyword) nodes.push(makeNode("keyword", value, "wrong"));
    } else if (s.level === "article") {
      for (const d of decoys.articles) {
        const value = `Article ${d.article}`;
        const parts = d.hasParts
          ? [makeNode("part", "Part I", "wrong"), makeNode("part", "Part II", "wrong")]
          : [];
        nodes.push(makeNode("article", value, "wrong", { hasParts: d.hasParts, next: parts }));
      }
    } else {
      for (const value of decoys.rest[restIndex.get(depth) as number] ?? []) {
        nodes.push(makeNode(s.level, value, "wrong"));
      }
    }
    return rotate(nodes, seed + depth);
  };

  return group(0) as unknown as OptionTree;
}

// ---------------------------------------------------------------------------
// Drills
// ---------------------------------------------------------------------------

const panelWorkingSpaceTrail = trailOf("working space", [
  step("chapter", "Chapter 1"),
  step("article", "Article 110"),
  step("part", "Part II"),
  step("table", "Table 110.26(A)(1)"),
]);

const boxFillTrail = trailOf("box fill", [
  step("chapter", "Chapter 3"),
  step("article", "Article 314"),
  step("part", "Part II"),
  step("table", "Table 314.16(A)"),
]);

const conduitFillTrail = trailOf("conduit fill", [
  step("chapter", "Chapter 9"),
  step("table", "Tables 4 and 5"),
]);

const ampacityTrail = trailOf("ampacity", [
  step("chapter", "Chapter 3"),
  step("article", "Article 310"),
  step("part", "Part III"),
  step("table", "Table 310.16"),
]);

const gecTrail = trailOf("grounding electrode conductor", [
  step("chapter", "Chapter 2"),
  step("article", "Article 250"),
  step("part", "Part III"),
  step("table", "Table 250.66"),
]);

const egcTrail = trailOf("equipment grounding conductor", [
  step("chapter", "Chapter 2"),
  step("article", "Article 250"),
  step("part", "Part VI"),
  step("table", "Table 250.122"),
]);

const gfciTrail = trailOf("GFCI", [
  step("chapter", "Chapter 2"),
  step("article", "Article 210"),
  step("part", "Part I"),
  step("section", "210.8"),
  step("section", "210.8(A)"),
  step("section", "210.8(A)(7)"),
]);
const gfciMovedFrom = trailOf("GFCI", [
  step("chapter", "Chapter 2"),
  step("article", "Article 210"),
  step("part", "Part I"),
  step("section", "210.8"),
  step("section", "210.8(A)"),
  step("section", "210.8(A)(6)"),
]);

const afciTrail = trailOf("AFCI", [
  step("chapter", "Chapter 2"),
  step("article", "Article 210"),
  step("part", "Part I"),
  step("section", "210.12"),
  step("section", "210.12(B)"),
  step("section", "210.12(B)(8)"),
]);

const receptacleSpacingTrail = trailOf("receptacle spacing", [
  step("chapter", "Chapter 2"),
  step("article", "Article 210"),
  step("part", "Part III"),
  step("section", "210.52"),
  step("section", "210.52(A)"),
  step("section", "210.52(A)(1)"),
]);

export const DRILL_LIBRARY: readonly DrillRecord[] = [
  // 1
  defineDrill({
    def: defineCodeTrail({
      id: "panel-working-space",
      label: "Panel working space",
      trails: [panelWorkingSpaceTrail],
      hint: "The voltage row is 0–150 V to ground, and the opposite wall decides the condition — drywall is Condition 1.",
      tableValues: [makeTableValue(3, "Table 110.26(A)(1)")],
    }),
    question:
      "A 120/240-volt panelboard has exposed live parts on one side and no live or grounded parts on the other side. What is the minimum depth of working space in front of it?",
    answer: "3 ft",
    citation: "Table 110.26(A)(1)",
    founder_checked: false,
    index_checked: false,
    wrongOptionsReviewed: false,
    trees: {
      toc: buildTocTree("panel-working-space", panelWorkingSpaceTrail, {
        keyword: ["clearance", "dedicated space", "illumination", "headroom"],
        articles: [article(100, true), article(312, false), article(408, true)],
        rest: [
          ["Part I", "Part III", "Part IV"],
          ["Table 110.34(A)", "Table 110.28", "Table 110.31"],
        ],
      }),
    },
  }),

  // 3
  defineDrill({
    def: defineCodeTrail({
      id: "box-fill-4-square",
      label: "Box fill 4 square",
      trails: [boxFillTrail],
      hint: "The table count only holds for a bare box — a device, clamp, or ground each eats allowances.",
      tableValues: [makeTableValue(13, "Table 314.16(A)")],
    }),
    question:
      "How many 12 AWG conductors are allowed in a 4-inch square metal box, 2-1/8 inches deep, with nothing else in the box?",
    answer: "13",
    citation: "Table 314.16(A)",
    founder_checked: false,
    index_checked: false,
    wrongOptionsReviewed: false,
    trees: {
      toc: buildTocTree("box-fill-4-square", boxFillTrail, {
        keyword: ["boxes", "conductor fill", "volume allowance", "cabinets"],
        articles: [article(300, false), article(310, true), article(312, false), article(358, false)],
        rest: [
          ["Part I", "Part III", "Part IV"],
          ["Table 314.16(B)", "Table 312.6(A)", "Table 312.6(B)"],
        ],
      }),
    },
  }),

  // 4
  defineDrill({
    def: defineCodeTrail({
      id: "conduit-fill-emt",
      label: "Conduit fill emt",
      trails: [conduitFillTrail],
      hint: "Table 4 gives you 0.213 sq in. of usable space at 40 percent, Table 5 says each 12 AWG THHN takes 0.0133 — 0.213 ÷ 0.0133 is 16, and a 17th would push you over.",
      tableValues: [makeTableValue(16, "Chapter 9 Tables 4 and 5")],
    }),
    question: "How many 12 AWG THHN copper conductors fit in a 3/4-in. EMT?",
    answer: "16",
    citation: "Chapter 9, Tables 4 and 5",
    founder_checked: false,
    index_checked: false,
    wrongOptionsReviewed: false,
    trees: {
      toc: buildTocTree("conduit-fill-emt", conduitFillTrail, {
        keyword: ["raceway fill", "conductor fill", "conduit size", "box fill"],
        articles: [],
        rest: [["Table 1", "Table 5A", "Table 8", "Table 9"]],
      }),
    },
  }),

  // 5
  defineDrill({
    def: defineCodeTrail({
      id: "ampacity-100a-feeder",
      label: "Ampacity 100a feeder",
      trails: [ampacityTrail],
      hint: "THHN is a 90°C wire, but the 75°C terminations cap you at the 75°C column — 4 AWG only carries 85 there, so you step up.",
      tableValues: [makeTableValue(3, "Table 310.16")],
    }),
    question: "What size copper THHN conductor is needed for a 100-amp feeder with 75°C terminations?",
    answer: "3 AWG copper",
    citation: "Table 310.16",
    founder_checked: false,
    index_checked: false,
    wrongOptionsReviewed: false,
    trees: {
      toc: buildTocTree("ampacity-100a-feeder", ampacityTrail, {
        keyword: ["conductors", "temperature limitations", "derating", "terminations"],
        articles: [article(300, false), article(314, true), article(312, false), article(358, false)],
        rest: [
          ["Part I", "Part II", "Part IV"],
          ["Table 310.17", "Table 310.18", "Table 310.15(C)(1)"],
        ],
      }),
    },
  }),

  // 6
  defineDrill({
    def: defineCodeTrail({
      id: "gec-service",
      label: "Gec service",
      trails: [gecTrail],
      hint: "Find your service conductor size in the left column, then read straight across — the row covers both 2/0 and 3/0.",
      tableValues: [makeTableValue(4, "Table 250.66")],
    }),
    question:
      "What size copper grounding electrode conductor is required for a service with 3/0 AWG copper service-entrance conductors?",
    answer: "4 AWG copper",
    citation: "Table 250.66",
    founder_checked: false,
    index_checked: false,
    wrongOptionsReviewed: false,
    trees: {
      toc: buildTocTree("gec-service", gecTrail, {
        keyword: ["grounded conductor", "main bonding jumper", "grounding electrode", "bonding"],
        articles: [article(210, true), article(215, false), article(230, true), article(240, true)],
        rest: [
          ["Part I", "Part II", "Part IV", "Part V"],
          ["Table 250.102(C)(1)", "Table 250.122", "Table 310.16"],
        ],
      }),
    },
  }),

  // 7
  defineDrill({
    def: defineCodeTrail({
      id: "egc-60a",
      label: "Egc 60a",
      trails: [egcTrail],
      hint: "This table keys off the breaker size, not the wire size — find 60 amps in the left column and read across.",
      tableValues: [makeTableValue(10, "Table 250.122")],
    }),
    question: "What size copper equipment grounding conductor is required for a 60-amp circuit?",
    answer: "10 AWG copper",
    citation: "Table 250.122",
    founder_checked: false,
    index_checked: false,
    wrongOptionsReviewed: false,
    trees: {
      toc: buildTocTree("egc-60a", egcTrail, {
        keyword: ["grounding electrode conductor", "grounded conductor", "bonding jumper", "grounding"],
        articles: [article(210, true), article(215, false), article(230, true), article(240, true)],
        rest: [
          ["Part II", "Part III", "Part V", "Part VII"],
          ["Table 250.66", "Table 250.102(C)(1)", "Table 310.16"],
        ],
      }),
    },
  }),

  // 8 (list item renumbered in 2026)
  defineDrill({
    def: defineCodeTrail({
      id: "gfci-kitchen-countertop",
      label: "Gfci kitchen countertop",
      trails: [gfciTrail],
      hint: "Kitchens are on the dwelling list, and the rule covers 125- through 250-volt receptacles — the countertop spot is what puts it on the list, not the voltage alone.",
      movedFrom: gfciMovedFrom,
      editionNote:
        "In 2026 kitchens are list item (A)(7). In 2023 they were (A)(6); laundry areas were added ahead of them.",
    }),
    question:
      "Is GFCI protection required for a 125-volt, 15-amp receptacle serving a dwelling kitchen countertop?",
    answer: "Yes",
    citation: "210.8(A)(7)",
    founder_checked: false,
    index_checked: false,
    wrongOptionsReviewed: false,
    trees: {
      toc: buildTocTree(
        "gfci-kitchen-countertop",
        gfciTrail,
        {
          keyword: ["AFCI", "ground-fault protection", "receptacles", "personnel protection"],
          articles: [article(215, false), article(220, true), article(225, true), article(240, true)],
          rest: [
            ["Part II", "Part III", "Part IV"],
            ["210.12", "210.11", "210.5"],
            ["210.8(B)", "210.8(C)", "210.8(D)"],
            ["210.8(A)(1)", "210.8(A)(2)", "210.8(A)(3)", "210.8(A)(8)"],
          ],
        },
        gfciMovedFrom,
      ),
    },
  }),

  // 9
  defineDrill({
    def: defineCodeTrail({
      id: "afci-bedroom",
      label: "Afci bedroom",
      trails: [afciTrail],
      hint: "(A) only lists the types of AFCI devices you can use — the rooms that actually need it are in (B), and bedrooms are on that list.",
    }),
    question:
      "Is AFCI protection required for a 120-volt branch circuit supplying a receptacle outlet in a dwelling bedroom?",
    answer: "Yes",
    citation: "210.12(B)(8)",
    founder_checked: false,
    index_checked: false,
    wrongOptionsReviewed: false,
    trees: {
      toc: buildTocTree("afci-bedroom", afciTrail, {
        keyword: ["GFCI", "arc-fault circuit interrupters", "branch circuits", "bedrooms"],
        articles: [article(215, false), article(220, true), article(225, true), article(240, true)],
        rest: [
          ["Part II", "Part III", "Part IV"],
          ["210.8", "210.11", "210.5"],
          ["210.12(A)", "210.12(C)", "210.12(D)"],
          ["210.12(B)(1)", "210.12(B)(2)", "210.12(B)(3)", "210.12(B)(4)"],
        ],
      }),
    },
  }),

  // 10
  defineDrill({
    def: defineCodeTrail({
      id: "receptacle-spacing-living-room",
      label: "Receptacle spacing living room",
      trails: [receptacleSpacingTrail],
      hint: "The book only states 6 feet — no point on the wall can be more than 6 feet from a receptacle — and 12 feet between two receptacles is just that rule doubled.",
    }),
    question: "What is the maximum spacing between receptacles along a dwelling living-room wall?",
    answer: "12 ft apart, 6 ft max from any point.",
    citation: "210.52(A)(1)",
    founder_checked: false,
    index_checked: false,
    wrongOptionsReviewed: false,
    trees: {
      toc: buildTocTree("receptacle-spacing-living-room", receptacleSpacingTrail, {
        keyword: ["receptacle outlets", "outlets required", "wall space", "convenience outlets"],
        articles: [article(215, false), article(220, true), article(225, true), article(240, true)],
        rest: [
          ["Part I", "Part II", "Part IV"],
          ["210.50", "210.62", "210.63", "210.70"],
          ["210.52(B)", "210.52(C)", "210.52(D)"],
          ["210.52(A)(2)", "210.52(A)(3)", "210.52(A)(4)"],
        ],
      }),
    },
  }),
];
