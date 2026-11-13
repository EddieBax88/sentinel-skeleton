// FICTIONAL FIXTURES. Not real NEC content.
// Every article, section, table, number, and sentence in this file is made up
// and unverified. Test-only: no production file under src/ imports this file.
// Each variant derives from a drill in fixtureDrills.ts and adds `why`
// sentences (or none) to chosen correct Options.
import type { DrillRecord, OptionNode, OptionTree } from "../../src/model/types";
import {
  articleNoPartsDrill,
  articleWithPartsDrill,
  chapter9TableDrill,
  indexSubdivisionDrill,
} from "./fixtureDrills";

/** Keys are `${level}:${value}` of a correct node, e.g. "section:481.12". */
export type WhyMap = Readonly<Record<string, string>>;

/** Copies a tree and sets `why` on the correct nodes named in `whys`. */
function withWhyOnTree(tree: OptionTree, whys: WhyMap, used: Set<string>): OptionTree {
  const walk = (nodes: readonly OptionNode[]): OptionNode[] =>
    nodes.map((node) => {
      const key = `${node.level}:${node.value}`;
      const why = node.role === "correct" ? whys[key] : undefined;
      if (why !== undefined) used.add(key);
      const next = node.next ? (walk(node.next) as unknown as OptionNode["next"]) : undefined;
      return {
        ...node,
        ...(why !== undefined ? { why } : {}),
        ...(next ? { next } : {}),
      } as OptionNode;
    });
  return walk(tree) as unknown as OptionTree;
}

/** Returns a copy of `drill` with the given `why` sentences and a new id. */
function withWhy(drill: DrillRecord, id: string, whys: WhyMap): DrillRecord {
  const used = new Set<string>();
  const toc = withWhyOnTree(drill.trees.toc, whys, used);
  const index = drill.trees.index
    ? withWhyOnTree(drill.trees.index, whys, used)
    : undefined;
  for (const key of Object.keys(whys)) {
    if (!used.has(key)) throw new Error(`guidedDrills: no correct node for ${key}`);
  }
  return {
    ...drill,
    def: { ...drill.def, id },
    trees: index ? { toc, index } : { toc },
  };
}

/** Same drill under a new id, with no `why` anywhere. */
function withoutWhy(drill: DrillRecord, id: string): DrillRecord {
  return withWhy(drill, id, {});
}

// ---- A why on every correct Option -----------------------------------------

export const guidedAllWhyPartsDrill: DrillRecord = withWhy(
  articleWithPartsDrill,
  "guided-all-why-parts",
  {
    "keyword:Fictional gizmo wiring":
      "Made-up reason: the fictional keyword names the made-up gizmo topic.",
    "chapter:Chapter 4":
      "Made-up reason: this fictional chapter covers made-up gizmo equipment.",
    "article:Article 481":
      "Made-up reason: this fictional article is titled for gizmo wiring.",
    "part:Part II":
      "Made-up reason: this fictional part holds the installation rules.",
    "section:481.12":
      "Made-up reason: this fictional section holds the one rule asked about.",
  },
);

export const guidedAllWhyNoPartsDrill: DrillRecord = withWhy(
  articleNoPartsDrill,
  "guided-all-why-no-parts",
  {
    "keyword:Fictional widget spacing":
      "Made-up reason: the fictional keyword names the made-up widget topic.",
    "chapter:Chapter 3":
      "Made-up reason: this fictional chapter covers made-up widget methods.",
    "article:Article 377":
      "Made-up reason: this fictional article is titled for widget spacing.",
    "section:377.20":
      "Made-up reason: this fictional section states the made-up spacing rule.",
  },
);

// ---- A why on only some Options --------------------------------------------

/** Keyword has a why; the Chapter, Article, and Part do not; the Section does. */
export const guidedSomeWhyWithKeywordDrill: DrillRecord = withWhy(
  articleWithPartsDrill,
  "guided-some-why-with-keyword",
  {
    "keyword:Fictional gizmo wiring":
      "Made-up reason: the fictional keyword is the first word to look up.",
    "section:481.12":
      "Made-up reason: this fictional section holds the made-up rule.",
  },
);

/** Keyword has no why; the Article and Part do. */
export const guidedSomeWhyNoKeywordDrill: DrillRecord = withWhy(
  articleWithPartsDrill,
  "guided-some-why-no-keyword",
  {
    "article:Article 481":
      "Made-up reason: this fictional article is titled for gizmo wiring.",
    "part:Part II":
      "Made-up reason: this fictional part holds the installation rules.",
  },
);

// ---- None at all -----------------------------------------------------------

export const guidedNoWhyDrill: DrillRecord = withoutWhy(
  articleNoPartsDrill,
  "guided-no-why",
);

// ---- Index drill with a why on each of the two Index clicks ----------------

/**
 * Index route "Gadgets, spare, 555.4" then "555.4" (the two Index clicks),
 * then the subdivisions. The toc tree of this drill carries no why.
 */
export const guidedIndexClicksWhyDrill: DrillRecord = withWhy(
  indexSubdivisionDrill,
  "guided-index-clicks-why",
  {
    "index:Gadgets, spare, 555.4":
      "Made-up reason: this fictional Index entry lists spare gadgets.",
    "section:555.4":
      "Made-up reason: the fictional number the Index gives leads to this section.",
  },
);

// ---- A why on the Keyword, a Section, and the Table -----------------------

/** Keyword and Table Options each carry a why (Chapter 9 table, no Article). */
export const guidedTableWhyDrill: DrillRecord = withWhy(
  chapter9TableDrill,
  "guided-table-why",
  {
    "keyword:Fictional sprocket sizes":
      "Made-up reason: the fictional keyword names the made-up sprocket topic.",
    "table:Table 99":
      "Made-up reason: this fictional table lists the made-up sprocket sizes.",
  },
);

/** Keyword and two Section subdivisions carry a why; the Index clicks do not. */
export const guidedKeywordSectionWhyDrill: DrillRecord = withWhy(
  indexSubdivisionDrill,
  "guided-keyword-section-why",
  {
    "keyword:Fictional gadgets":
      "Made-up reason: the fictional keyword names the made-up gadget topic.",
    "section:555.4(B)":
      "Made-up reason: this fictional lettered subdivision narrows the topic.",
    "section:555.4(B)(2)":
      "Made-up reason: this fictional numbered subdivision holds the made-up rule.",
  },
);

// ---- Fork sentences and why sentences together -----------------------------

/**
 * Sets both fork sentences and why sentences, so tests can prove the Guided
 * end screen shows only the why sentences and never the fork sentences.
 */
export const guidedForkAndWhyDrill: DrillRecord = {
  ...withWhy(articleWithPartsDrill, "guided-fork-and-why", {
    "keyword:Fictional gizmo wiring":
      "Made-up reason: the fictional keyword names the made-up gizmo topic.",
    "chapter:Chapter 4":
      "Made-up reason: this fictional chapter covers made-up gizmo equipment.",
    "article:Article 481":
      "Made-up reason: this fictional article is titled for gizmo wiring.",
    "part:Part II":
      "Made-up reason: this fictional part holds the installation rules.",
    "section:481.12":
      "Made-up reason: this fictional section holds the one rule asked about.",
  }),
  chapterForkSentence: "Made-up fork text: this fictional chapter beats its fictional neighbor.",
  articleForkSentence: "Made-up fork text: this fictional article beats its fictional neighbor.",
};

export const GUIDED_FIXTURE_DRILLS: readonly DrillRecord[] = [
  guidedAllWhyPartsDrill,
  guidedAllWhyNoPartsDrill,
  guidedSomeWhyWithKeywordDrill,
  guidedSomeWhyNoKeywordDrill,
  guidedNoWhyDrill,
  guidedIndexClicksWhyDrill,
  guidedTableWhyDrill,
  guidedKeywordSectionWhyDrill,
  guidedForkAndWhyDrill,
];
