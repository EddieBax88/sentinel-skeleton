// FICTIONAL FIXTURES. Not real NEC content.
// Every article, section, table, and number in this file is made up and
// unverified. Test-only: no production file under src/ imports this folder.
import { defineCodeTrail } from "@sentinel/skeleton-core";
import type { CodeTrail } from "@sentinel/skeleton-core";
import { defineDrill } from "../../src/model/types";
import type { DrillRecord } from "../../src/model/types";
import { treeFromTrails } from "../support/buildTree";

const FICTIONAL = "Fictional fixture. Not real NEC content.";

const fixtureText = {
  answer: `${FICTIONAL} Made-up paraphrase of a made-up rule.`,
  hint: `${FICTIONAL} Made-up hint.`,
};

/** Article with Parts (toc). */
const partsTrail: CodeTrail = {
  keyword: "Fictional gizmo wiring",
  legs: [
    [
      { level: "chapter", value: "Chapter 4" },
      { level: "article", value: "Article 481" },
      { level: "part", value: "Part II" },
      { level: "section", value: "481.12" },
    ],
  ],
};

export const articleWithPartsDrill: DrillRecord = defineDrill({
  def: defineCodeTrail({
    id: "fixture-article-with-parts",
    label: "Fixture: Article with Parts",
    trails: [partsTrail],
    hint: fixtureText.hint,
  }),
  question: `${FICTIONAL} Where is the made-up gizmo wiring rule?`,
  answer: fixtureText.answer,
  citation: "Fictional section 481.12",
  founder_checked: true,
  index_checked: false,
  wrongOptionsReviewed: true,
  chapterForkSentence: "This made-up fork sentence compares two fictional chapters.",
  articleForkSentence: "This made-up fork sentence compares two fictional articles.",
  trees: {
    toc: treeFromTrails([partsTrail], undefined, [
      ["Article 482", "Article 4820", "Article 483"],
    ]),
  },
});

/** Article with no Parts (toc). */
const noPartsTrail: CodeTrail = {
  keyword: "Fictional widget spacing",
  legs: [
    [
      { level: "chapter", value: "Chapter 3" },
      { level: "article", value: "Article 377" },
      { level: "section", value: "377.20" },
    ],
  ],
};

export const articleNoPartsDrill: DrillRecord = defineDrill({
  def: defineCodeTrail({
    id: "fixture-article-no-parts",
    label: "Fixture: Article with no Parts",
    trails: [noPartsTrail],
    hint: fixtureText.hint,
  }),
  question: `${FICTIONAL} Where is the made-up widget spacing rule?`,
  answer: fixtureText.answer,
  citation: "Fictional section 377.20",
  founder_checked: true,
  index_checked: false,
  wrongOptionsReviewed: true,
  trees: {
    toc: treeFromTrails([noPartsTrail], undefined, [
      ["Article 378", "Article 379"],
    ]),
  },
});

/** Chapter 9 table with a tableWalk (toc). */
const ch9Trail: CodeTrail = {
  keyword: "Fictional sprocket sizes",
  legs: [
    [
      { level: "chapter", value: "Chapter 9" },
      { level: "table", value: "Table 99" },
    ],
  ],
};

export const chapter9TableDrill: DrillRecord = defineDrill({
  def: defineCodeTrail({
    id: "fixture-chapter-9-table",
    label: "Fixture: Chapter 9 table",
    trails: [ch9Trail],
    hint: fixtureText.hint,
  }),
  question: `${FICTIONAL} Which made-up table lists sprocket sizes?`,
  answer: fixtureText.answer,
  citation: "Fictional Table 99",
  founder_checked: true,
  index_checked: false,
  wrongOptionsReviewed: true,
  tableWalk: { column: "Size 7", row: "Type Q", value: "0.123 in. (fictional)" },
  trees: {
    toc: treeFromTrails([ch9Trail], undefined, [["Table 98", "Table 100"]]),
  },
});

/** Index route with a subdivision (index). Also carries a toc trail. */
const subdivisionIndexTrail: CodeTrail = {
  keyword: "Fictional gadgets",
  legs: [
    [
      { level: "index", value: "Gadgets, spare, 555.4" },
      { level: "section", value: "555.4" },
      { level: "section", value: "555.4(B)" },
      { level: "section", value: "555.4(B)(2)" },
    ],
  ],
};
const subdivisionTocTrail: CodeTrail = {
  keyword: "Fictional gadgets",
  legs: [
    [
      { level: "chapter", value: "Chapter 5" },
      { level: "article", value: "Article 555" },
      { level: "section", value: "555.4" },
      { level: "section", value: "555.4(B)" },
      { level: "section", value: "555.4(B)(2)" },
    ],
  ],
};

export const indexSubdivisionDrill: DrillRecord = defineDrill({
  def: defineCodeTrail({
    id: "fixture-index-subdivision",
    label: "Fixture: Index route with a subdivision",
    trails: [subdivisionTocTrail, subdivisionIndexTrail],
    hint: fixtureText.hint,
  }),
  question: `${FICTIONAL} Where is the made-up spare gadget rule?`,
  answer: fixtureText.answer,
  citation: "Fictional section 555.4(B)(2)",
  founder_checked: true,
  index_checked: true,
  wrongOptionsReviewed: true,
  trees: {
    toc: treeFromTrails([subdivisionTocTrail], undefined, [["Article 556"]]),
    index: treeFromTrails([subdivisionIndexTrail], undefined, [
      ["Gadgets, spare, 556.4"],
    ]),
  },
});

/** Drill with movedFrom and editionNote (toc). */
const movedTrail: CodeTrail = {
  keyword: "Fictional doohickey",
  legs: [
    [
      { level: "chapter", value: "Chapter 6" },
      { level: "article", value: "Article 641" },
      { level: "section", value: "641.5" },
    ],
  ],
};
const movedFromTrail: CodeTrail = {
  keyword: "Fictional doohickey",
  legs: [
    [
      { level: "chapter", value: "Chapter 5" },
      { level: "article", value: "Article 541" },
      { level: "section", value: "541.5" },
    ],
  ],
};

export const movedArticleDrill: DrillRecord = defineDrill({
  def: defineCodeTrail({
    id: "fixture-moved-article",
    label: "Fixture: moved article",
    trails: [movedTrail],
    hint: fixtureText.hint,
    movedFrom: movedFromTrail,
    editionNote:
      "Fictional edition note: this made-up article moved to a different chapter.",
  }),
  question: `${FICTIONAL} Where is the made-up doohickey rule?`,
  answer: fixtureText.answer,
  citation: "Fictional section 641.5",
  founder_checked: true,
  index_checked: false,
  wrongOptionsReviewed: true,
  trees: {
    toc: treeFromTrails([movedTrail], movedFromTrail, [["Article 642"]]),
  },
});

/** Two valid trails of one method with different keywords (toc). */
const twoKeywordTrailA: CodeTrail = {
  keyword: "Fictional flange",
  legs: [
    [
      { level: "chapter", value: "Chapter 2" },
      { level: "article", value: "Article 211" },
      { level: "section", value: "211.3" },
    ],
  ],
};
const twoKeywordTrailB: CodeTrail = {
  keyword: "Fictional bracket",
  legs: [
    [
      { level: "chapter", value: "Chapter 7" },
      { level: "article", value: "Article 711" },
      { level: "section", value: "711.8" },
    ],
  ],
};

export const twoKeywordDrill: DrillRecord = defineDrill({
  def: defineCodeTrail({
    id: "fixture-two-keywords",
    label: "Fixture: two trails, different keywords",
    trails: [twoKeywordTrailA, twoKeywordTrailB],
    hint: fixtureText.hint,
  }),
  question: `${FICTIONAL} Where is the made-up flange or bracket rule?`,
  answer: fixtureText.answer,
  citation: "Fictional section 211.3 or 711.8",
  founder_checked: true,
  index_checked: false,
  wrongOptionsReviewed: true,
  trees: {
    toc: treeFromTrails([twoKeywordTrailA, twoKeywordTrailB], undefined, [
      ["Article 212", "Article 2120"],
    ]),
  },
});

/**
 * Decoy Article with hasParts: true on a part-less trail (toc). The decoy
 * "Article 6120" (even length) is generated with hasParts true and one wrong
 * Part option; "Article 612" is generated with hasParts false.
 */
const decoyTrail: CodeTrail = {
  keyword: "Fictional bobbin",
  legs: [
    [
      { level: "chapter", value: "Chapter 8" },
      { level: "article", value: "Article 801" },
      { level: "section", value: "801.2" },
    ],
  ],
};

export const decoyHasPartsDrill: DrillRecord = defineDrill({
  def: defineCodeTrail({
    id: "fixture-decoy-has-parts",
    label: "Fixture: decoy Article with hasParts",
    trails: [decoyTrail],
    hint: fixtureText.hint,
  }),
  question: `${FICTIONAL} Where is the made-up bobbin rule?`,
  answer: fixtureText.answer,
  citation: "Fictional section 801.2",
  founder_checked: true,
  index_checked: false,
  wrongOptionsReviewed: true,
  trees: {
    toc: treeFromTrails([decoyTrail], undefined, [["Article 612", "Article 6120"]]),
  },
});

export const FIXTURE_DRILLS: readonly DrillRecord[] = [
  articleWithPartsDrill,
  articleNoPartsDrill,
  chapter9TableDrill,
  indexSubdivisionDrill,
  movedArticleDrill,
  twoKeywordDrill,
  decoyHasPartsDrill,
];
