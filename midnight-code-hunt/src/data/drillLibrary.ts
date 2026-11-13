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
 * Index Keyword Lookup is on (`index_checked: true`) only for drills whose
 * Index heading, entry, and numbers the founder checked in the 2026 edition.
 * Every other drill is Table of Contents Lookup only, with no Index trail and
 * no Index tree.
 *
 * Entry notes:
 * - `label` is the drill title the founder supplied.
 * - Index trail: the Keyword is the Index heading, the `index` step is the
 *   words of the entry (never the number), then the number the Index gives,
 *   then the steps down to the answer. A wrong Index entry carries the number
 *   printed beside it as its own wrong next click.
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

/** A drafted wrong Index entry: its words, the number printed beside it, and that number's level. */
type IndexEntryDecoy = {
  readonly entry: string;
  readonly gives: string;
  readonly level: "section" | "table";
};

/**
 * Drafted wrong options for an Index tree.
 * - `keyword`: wrong Index headings.
 * - `entries`: wrong Index entries, each with the number printed beside it.
 * - `rest`: wrong options for each step after the number the Index gives, in trail order.
 */
type IndexDecoys = {
  readonly keyword: readonly string[];
  readonly entries: readonly IndexEntryDecoy[];
  readonly rest: readonly (readonly string[])[];
};

/** Builds the Index option tree from the founder's Index trail plus the drafted wrong options. */
function buildIndexTree(id: string, trail: CodeTrail, decoys: IndexDecoys): OptionTree {
  const steps: { level: NodeLevel; value: string }[] = [
    { level: "keyword", value: trail.keyword },
    ...trail.legs.flat().map((t) => ({ level: t.level as NodeLevel, value: t.value })),
  ];
  const seed = [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0);

  const group = (depth: number): OptionNode[] => {
    const t = steps[depth] as { level: NodeLevel; value: string };
    const below = depth + 1 < steps.length ? group(depth + 1) : [];
    const nodes: OptionNode[] = [makeNode(t.level, t.value, "correct", { next: below })];
    if (t.level === "keyword") {
      for (const value of decoys.keyword) nodes.push(makeNode("keyword", value, "wrong"));
    } else if (t.level === "index") {
      for (const e of decoys.entries) {
        nodes.push(makeNode("index", e.entry, "wrong", { next: [makeNode(e.level, e.gives, "wrong")] }));
      }
    } else if (depth >= 3) {
      for (const value of decoys.rest[depth - 3] ?? []) nodes.push(makeNode(t.level, value, "wrong"));
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

const burialDepthTrail = trailOf("burial depth", [
  step("chapter", "Chapter 3"),
  step("article", "Article 300"),
  step("table", "Table 300.7(A)"),
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

// Index trails (founder-checked in the 2026 edition).
const panelWorkingSpaceIndexTrail = trailOf("Working space", [
  step("index", "About electrical equipment"),
  step("section", "110.26"),
  step("table", "Table 110.26(A)(1)"),
]);
const burialDepthIndexTrail = trailOf("Underground wiring", [
  step("index", "Minimum cover requirements"),
  step("section", "300.7(A)"),
  step("table", "Table 300.7(A)"),
]);
const boxFillIndexTrail = trailOf("Boxes (outlet, device, pull, and junction)", [
  step("index", "Conductors, number in box"),
  step("section", "314.16"),
  step("table", "Table 314.16(A)"),
]);
const ampacityIndexTrail = trailOf("Ampacities", [
  step("index", "Conductors"),
  step("section", "310.14 through 310.21"),
  step("section", "310.16"),
  step("table", "Table 310.16"),
]);
const gecIndexTrail = trailOf("Grounding electrode conductors", [
  step("index", "Sizing"),
  step("section", "250.66"),
  step("table", "Table 250.66"),
]);
const egcIndexTrail = trailOf("Equipment grounding conductors", [
  step("index", "Sizing"),
  step("section", "250.122"),
  step("table", "Table 250.122"),
]);
const gfciIndexTrail = trailOf("Ground-fault circuit interrupters (GFCI)", [
  step("index", "Kitchens in dwelling units"),
  step("section", "210.8(A)(7)"),
]);

const afciIndexTrail = trailOf("Arc-fault circuit interrupters", [
  step("index", "Arc-fault circuit interrupters"),
  step("section", "210.12"),
  step("section", "210.12(B)"),
  step("section", "210.12(B)(8)"),
]);

const receptacleSpacingIndexTrail = trailOf("Receptacles, cord connectors, and attachment plugs (caps)", [
  step("index", "Dwellings, where required"),
  step("section", "210.52"),
  step("section", "210.52(A)"),
  step("section", "210.52(A)(1)"),
]);

export const DRILL_LIBRARY: readonly DrillRecord[] = [
  // 1
  defineDrill({
    def: defineCodeTrail({
      id: "panel-working-space",
      label: "Working space in front of electrical equipment",
      trails: [panelWorkingSpaceTrail, panelWorkingSpaceIndexTrail],
      hint: "The voltage row is 0–150 V to ground, and the opposite wall decides the condition — drywall is Condition 1.",
      tableValues: [makeTableValue(3, "Table 110.26(A)(1)")],
    }),
    question:
      "A 120/240-volt panelboard has exposed live parts on one side and no live or grounded parts on the other side. What is the minimum depth of working space in front of it?",
    answer: "3 ft",
    citation: "Table 110.26(A)(1)",
    founder_checked: true,
    index_checked: true,
    wrongOptionsReviewed: true,
    trees: {
      toc: buildTocTree("panel-working-space", panelWorkingSpaceTrail, {
        keyword: ["clearance", "dedicated space", "illumination", "headroom"],
        articles: [article(100, false), article(312, true), article(408, true)],
        rest: [
          ["Part I", "Part III", "Part IV"],
          ["Table 110.34(A)", "Table 110.28", "Table 110.31"],
        ],
      }),
      index: buildIndexTree("panel-working-space", panelWorkingSpaceIndexTrail, {
        keyword: ["Underground wiring", "Ampacities", "Loads"],
        entries: [
          { entry: "Adjacent to live parts (circuits over 1000 volts)", gives: "110.32 through 110.34", level: "section" },
          { entry: "Assembly occupancies", gives: "518.8", level: "section" },
          { entry: "Battery systems", gives: "480.10(C)", level: "section" },
          { entry: "Manholes", gives: "110.72", level: "section" },
        ],
        rest: [["Table 110.34(A)", "Table 110.28", "Table 110.31"]],
      }),
    },
  }),

  // 2 (moved in 2026)
  // The 2023 route (Part I > Table 300.5) is held back: the option tree cannot
  // show one Article with Parts in one edition and none in the other.
  defineDrill({
    def: defineCodeTrail({
      id: "burial-depth-driveway",
      label: "Minimum burial depth for underground wiring",
      trails: [burialDepthTrail, burialDepthIndexTrail],
      hint: "Cover is measured from the top of the cable to finished grade, not the bottom of the trench.",
      tableValues: [makeTableValue(18, "Table 300.7(A)")],
    }),
    question: "What is the minimum cover for a direct-buried cable under a one- and two-family dwelling driveway?",
    answer: "18 in.",
    citation: "Table 300.7(A)",
    founder_checked: true,
    index_checked: true,
    wrongOptionsReviewed: true,
    trees: {
      toc: buildTocTree("burial-depth-driveway", burialDepthTrail, {
        keyword: ["underground installations", "trench depth", "working space"],
        articles: [article(310, true), article(312, true), article(314, true), article(358, true)],
        rest: [["Table 300.19(B)", "Table 310.16"]],
      }),
      index: buildIndexTree("burial-depth-driveway", burialDepthIndexTrail, {
        keyword: ["Underground installations", "Working space", "Loads"],
        entries: [
          { entry: "Liquidtight flexible metal conduit", gives: "350.10(3)", level: "section" },
          { entry: "Liquidtight flexible nonmetallic conduit", gives: "356.10", level: "section" },
          { entry: "Motor fuel dispensing facilities", gives: "514.8", level: "section" },
          { entry: "Over 1000 volts", gives: "305.15", level: "section" },
        ],
        rest: [["Table 300.19(B)", "Table 310.16"]],
      }),
    },
  }),

  // 3
  defineDrill({
    def: defineCodeTrail({
      id: "box-fill-4-square",
      label: "Maximum conductors in a 4-inch square box",
      trails: [boxFillTrail, boxFillIndexTrail],
      hint: "The table count only holds for a bare box — a device, clamp, or ground each eats allowances.",
      tableValues: [makeTableValue(13, "Table 314.16(A)")],
    }),
    question:
      "How many 12 AWG conductors are allowed in a 4-inch square metal box, 2-1/8 inches deep, with nothing else in the box?",
    answer: "13",
    citation: "Table 314.16(A)",
    founder_checked: true,
    index_checked: true,
    wrongOptionsReviewed: true,
    trees: {
      toc: buildTocTree("box-fill-4-square", boxFillTrail, {
        keyword: ["cabinets", "conduit fill", "ampacity"],
        articles: [article(300, false), article(310, true), article(312, true), article(358, true)],
        rest: [
          ["Part I", "Part III", "Part IV"],
          ["Table 314.16(B)(4)", "Table 312.9(A)", "Table 312.9(B)(2)"],
        ],
      }),
      index: buildIndexTree("box-fill-4-square", boxFillIndexTrail, {
        keyword: ["Conductor fill", "Conduit fill", "Underground wiring"],
        entries: [
          { entry: "Concealed work", gives: "314.20", level: "section" },
          { entry: "Entering boxes, conduit bodies or fittings", gives: "314.17", level: "section" },
          { entry: "Alternating-current power distribution box", gives: "530.23(D)", level: "section" },
        ],
        rest: [["Table 314.16(B)(4)", "Table 312.9(A)", "Table 312.9(B)(2)"]],
      }),
    },
  }),

  // 4
  defineDrill({
    def: defineCodeTrail({
      id: "conduit-fill-emt",
      label: "Conduit fill for multiple conductors",
      trails: [conduitFillTrail],
      hint: "Table 4 gives you 0.213 sq in. of usable space at 40 percent, Table 5 says each 12 AWG THHN takes 0.0133 — 0.213 ÷ 0.0133 is 16, and a 17th would push you over.",
      tableValues: [makeTableValue(16, "Chapter 9 Tables 4 and 5")],
    }),
    question: "How many 12 AWG THHN copper conductors fit in a 3/4-in. EMT?",
    answer: "16",
    citation: "Chapter 9, Tables 4 and 5",
    founder_checked: true,
    index_checked: false,
    wrongOptionsReviewed: true,
    trees: {
      toc: buildTocTree("conduit-fill-emt", conduitFillTrail, {
        keyword: ["conduit size", "box fill", "ampacity"],
        articles: [],
        rest: [["Table 1", "Table 5A", "Table 8", "Table 9"]],
      }),
    },
  }),

  // 5
  defineDrill({
    def: defineCodeTrail({
      id: "ampacity-100a-feeder",
      label: "Finding conductor ampacity",
      trails: [ampacityTrail, ampacityIndexTrail],
      hint: "THHN is a 90°C wire, but the 75°C terminations cap you at the 75°C column — 4 AWG only carries 85 there, so you step up.",
      tableValues: [makeTableValue(3, "Table 310.16")],
    }),
    question: "What size copper THHN conductor is needed for a 100-amp feeder with 75°C terminations?",
    answer: "3 AWG copper",
    citation: "Table 310.16",
    founder_checked: true,
    index_checked: true,
    wrongOptionsReviewed: true,
    trees: {
      toc: buildTocTree("ampacity-100a-feeder", ampacityTrail, {
        keyword: ["temperature limitations", "derating", "terminations"],
        articles: [article(300, false), article(314, true), article(312, true), article(358, true)],
        rest: [
          ["Part I", "Part II"],
          ["Table 310.17", "Table 310.18", "Table 310.15(C)(1)"],
        ],
      }),
      index: buildIndexTree("ampacity-100a-feeder", ampacityIndexTrail, {
        keyword: ["Conductor fill", "Equipment grounding conductors", "Loads"],
        entries: [
          { entry: "Amusement attractions", gives: "522.22", level: "section" },
          { entry: "Auxiliary gutters", gives: "366.23", level: "section" },
          { entry: "Crane and hoist", gives: "Table 610.14(A)", level: "table" },
          { entry: "Energy storage systems", gives: "706.30(C)", level: "section" },
        ],
        rest: [[], ["Table 310.17", "Table 310.18", "Table 310.15(C)(1)"]],
      }),
    },
  }),

  // 6
  defineDrill({
    def: defineCodeTrail({
      id: "gec-service",
      label: "Sizing the grounding electrode conductor",
      trails: [gecTrail, gecIndexTrail],
      hint: "Find your service conductor size in the left column, then read straight across — the row covers both 2/0 and 3/0.",
      tableValues: [makeTableValue(4, "Table 250.66")],
    }),
    question:
      "What size copper grounding electrode conductor is required for a service with 3/0 AWG copper service-entrance conductors?",
    answer: "4 AWG copper",
    citation: "Table 250.66",
    founder_checked: true,
    index_checked: true,
    wrongOptionsReviewed: true,
    trees: {
      toc: buildTocTree("gec-service", gecTrail, {
        keyword: ["grounded conductor", "main bonding jumper", "bonding"],
        articles: [article(210, true), article(215, false), article(230, true), article(240, true)],
        rest: [
          ["Part I", "Part II", "Part IV", "Part V"],
          ["Table 250.102(C)(1)", "Table 250.122", "Table 310.16"],
        ],
      }),
      index: buildIndexTree("gec-service", gecIndexTrail, {
        keyword: ["Equipment grounding conductors", "Ampacities", "Working space"],
        entries: [
          { entry: "Installation", gives: "250.64", level: "section" },
          { entry: "Material", gives: "250.62", level: "section" },
          { entry: "Separately derived systems", gives: "250.30", level: "section" },
          { entry: "Solar photovoltaic systems", gives: "690.47", level: "section" },
        ],
        rest: [["Table 250.102(C)(1)", "Table 250.122", "Table 310.16"]],
      }),
    },
  }),

  // 7
  defineDrill({
    def: defineCodeTrail({
      id: "egc-60a",
      label: "Sizing the equipment grounding conductor",
      trails: [egcTrail, egcIndexTrail],
      hint: "This table keys off the breaker size, not the wire size — find 60 amps in the left column and read across.",
      tableValues: [makeTableValue(10, "Table 250.122")],
    }),
    question: "What size copper equipment grounding conductor is required for a 60-amp circuit?",
    answer: "10 AWG copper",
    citation: "Table 250.122",
    founder_checked: true,
    index_checked: true,
    wrongOptionsReviewed: true,
    trees: {
      toc: buildTocTree("egc-60a", egcTrail, {
        keyword: ["grounding electrode conductor", "grounded conductor", "bonding jumper", "grounding"],
        articles: [article(210, true), article(215, false), article(230, true), article(240, true)],
        rest: [
          ["Part II", "Part III", "Part V", "Part VII"],
          ["Table 250.66", "Table 250.102(C)(1)", "Table 310.16"],
        ],
      }),
      index: buildIndexTree("egc-60a", egcIndexTrail, {
        keyword: ["Grounding electrode conductors", "Ampacities", "Conductor fill"],
        entries: [
          { entry: "Sensitive electronic equipment", gives: "647.7(B)", level: "section" },
          { entry: "Signs and outline lighting", gives: "600.7(A)", level: "section" },
          { entry: "Snap switches, general-use", gives: "406.40(B)", level: "section" },
          { entry: "Solar photovoltaic systems", gives: "690.43 through 690.47", level: "section" },
        ],
        rest: [["Table 250.66", "Table 250.102(C)(1)", "Table 310.16"]],
      }),
    },
  }),

  // 8 (list item renumbered in 2026)
  defineDrill({
    def: defineCodeTrail({
      id: "gfci-kitchen-countertop",
      label: "GFCI protection in a dwelling kitchen",
      trails: [gfciTrail, gfciIndexTrail],
      hint: "Kitchens are on the dwelling list, and the rule covers 125- through 250-volt receptacles — the countertop spot is what puts it on the list, not the voltage alone.",
      movedFrom: gfciMovedFrom,
      editionNote:
        "In 2026 kitchens are list item (A)(7). In 2023 they were (A)(6); laundry areas were added ahead of them.",
    }),
    question:
      "Is GFCI protection required for a 125-volt, 15-amp receptacle serving a dwelling kitchen countertop?",
    answer: "Yes",
    citation: "210.8(A)(7)",
    founder_checked: true,
    index_checked: true,
    wrongOptionsReviewed: true,
    trees: {
      toc: buildTocTree(
        "gfci-kitchen-countertop",
        gfciTrail,
        {
          keyword: ["AFCI", "ground-fault protection", "personnel protection"],
          articles: [article(215, false), article(230, true), article(225, true), article(240, true)],
          rest: [
            ["Part II", "Part III"],
            ["210.12", "210.11", "210.5"],
            ["210.8(B)", "210.8(C)", "210.8(D)"],
            ["210.8(A)(1)", "210.8(A)(2)", "210.8(A)(3)", "210.8(A)(8)"],
          ],
        },
        gfciMovedFrom,
      ),
      index: buildIndexTree("gfci-kitchen-countertop", gfciIndexTrail, {
        keyword: ["Loads", "Working space", "Ampacities"],
        entries: [
          { entry: "Garages, in dwelling units", gives: "210.8(A)(2)", level: "section" },
          { entry: "Bathrooms in dwelling units", gives: "210.8(A)(1)", level: "section" },
          { entry: "Health care facilities", gives: "517.20(A)", level: "section" },
          { entry: "Mobile homes", gives: "550.13(B)", level: "section" },
        ],
        rest: [],
      }),
    },
  }),

  // 9
  defineDrill({
    def: defineCodeTrail({
      id: "afci-bedroom",
      label: "AFCI protection for branch circuits",
      trails: [afciTrail, afciIndexTrail],
      hint: "(A) only lists the types of AFCI devices you can use — the rooms that actually need it are in (B), and bedrooms are on that list.",
    }),
    question:
      "Is AFCI protection required for a 120-volt branch circuit supplying a receptacle outlet in a dwelling bedroom?",
    answer: "Yes",
    citation: "210.12(B)(8)",
    founder_checked: true,
    index_checked: true,
    wrongOptionsReviewed: true,
    trees: {
      toc: buildTocTree("afci-bedroom", afciTrail, {
        keyword: ["GFCI", "bedrooms", "receptacle spacing"],
        articles: [article(215, false), article(230, true), article(225, true), article(240, true)],
        rest: [
          ["Part II", "Part III"],
          ["210.8", "210.11", "210.5"],
          ["210.12(A)", "210.12(C)", "210.12(D)"],
          ["210.12(B)(1)", "210.12(B)(2)", "210.12(B)(3)", "210.12(B)(4)"],
        ],
      }),
      index: buildIndexTree("afci-bedroom", afciIndexTrail, {
        keyword: ["Ground-fault circuit interrupters (GFCI)", "Ampacities", "Working space"],
        entries: [
          { entry: "Protection", gives: "440.65", level: "section" },
          { entry: "Receptacle replacements", gives: "406.12(D)(4)", level: "section" },
          { entry: "Solar photovoltaic systems", gives: "690.11", level: "section" },
        ],
        rest: [
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
      label: "Required receptacle spacing in a dwelling",
      trails: [receptacleSpacingTrail, receptacleSpacingIndexTrail],
      hint: "The book only states 6 feet — no point on the wall can be more than 6 feet from a receptacle — and 12 feet between two receptacles is just that rule doubled.",
    }),
    question: "What is the maximum spacing between receptacles along a dwelling living-room wall?",
    answer: "12 ft apart, 6 ft max from any point.",
    citation: "210.52(A)(1)",
    founder_checked: true,
    index_checked: true,
    wrongOptionsReviewed: true,
    trees: {
      toc: buildTocTree("receptacle-spacing-living-room", receptacleSpacingTrail, {
        keyword: ["convenience outlets", "GFCI", "working space"],
        articles: [article(215, false), article(230, true), article(225, true), article(240, true)],
        rest: [
          ["Part I", "Part II"],
          ["210.50", "210.62", "210.63", "210.70"],
          ["210.52(B)", "210.52(C)", "210.52(D)"],
          ["210.52(A)(2)", "210.52(A)(3)", "210.52(A)(4)"],
        ],
      }),
      index: buildIndexTree("receptacle-spacing-living-room", receptacleSpacingIndexTrail, {
        keyword: ["Boxes (outlet, device, pull, and junction)", "Working space", "Ampacities"],
        entries: [
          { entry: "Guest rooms, guest suites, and dormitories", gives: "210.60", level: "section" },
          { entry: "Meeting rooms", gives: "210.65", level: "section" },
          { entry: "Loads", gives: "120.14", level: "section" },
        ],
        rest: [
          ["210.52(B)", "210.52(C)", "210.52(D)"],
          ["210.52(A)(2)", "210.52(A)(3)", "210.52(A)(4)"],
        ],
      }),
    },
  }),
];
