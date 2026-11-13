import { CHAPTER_LABELS } from "../logic/chapters";

/**
 * All user-facing copy lives here.
 *
 * PROSE: sentences that are checked for reading level (average sentence length of 15 words
 * or fewer, grade 5 to 7). FIXED: dictated text (footer, method names, chapter labels, short
 * labels and buttons) that is not scanned for reading level.
 *
 * Content rules apply to every string: no counts in method names, no numeric time-savings
 * figure, no outcome promises, no gendered terms, no NEC wording.
 */

/** Footer disclaimer, word for word. The registered mark is U+00AE. */
export const FOOTER_DISCLAIMER =
  "Sentinel Learning is an independent study aid, not affiliated with the NFPA or any licensing board. NEC\u00AE is a registered trademark of the NFPA.";

export const PROSE = {
  // Picker
  pickerBenefit: "Drills that help you find answers in your own code book in less time.",
  pickerNecNote: "You need a printed or digital copy of the 2026 NEC to use these drills.",
  pickerComingSoon: "New drills are coming soon.",
  pickerNoDrillsDev: "No drills available.",

  // Method descriptions: one sentence of 20 words or fewer each
  methodIndexDescription: "The main method. Start from the Index and follow it to the answer.",
  methodTocDescription: "The second method. Start from the Table of Contents and walk down.",

  // Result and time messages
  timeRanOut: "Time ran out. Steps with no pick are marked not answered.",
  newBest: "New best time for this drill and method.",
  movedArticle: "Your picks match where this answer was located in the 2023 NEC.",
  verdictsAgainst2023: "These marks compare your picks to the 2023 route.",

  // Storage note (100 characters or fewer)
  storageNote: "Best times will not be saved after this visit.",

  // Unavailable drill
  drillUnavailable: "That drill is not available. Go back and pick another drill.",

  // Row line for a table
  rowLineIntro: "Find the row in the table to read the value.",

  // Guided mode (each sentence 15 words or fewer)
  guidedDescription: "Pick at your own pace. You hear right away if a pick is right.",
  timedDescription: "Work the path against the clock. No hints along the way.",
  guidedCorrectLine: "That pick is correct. Go on to the next step.",
  guidedIncorrectLine: "That pick is not right.",
  guidedPickAgain: "That pick is not right. Pick again at this step.",
  guidedPathComplete: "You found the answer. The path is complete.",
  guidedEndIntro: "Here is the full path you followed, with the answer and its citation.",
} as const;

export const FIXED = {
  appTitle: "Midnight Code Hunt",
  pickerHeading: "Pick a drill",
  drillHeadingFallback: "Drill",
  resultHeading: "Result",

  // Methods
  methodIndex: "Index Keyword Lookup",
  methodToc: "Table of Contents Lookup",
  methodGroupLabel: "Method",

  // Chapter labels (nine, in order)
  chapterLabels: CHAPTER_LABELS,

  // Badges and labels
  draftBadge: "Draft",
  movedLabel: "Moved between the 2023 and 2026 editions",
  bestTimeLabel: "Best",

  // Step headings
  stepKeyword: "Keyword",
  stepIndex: "Index",
  stepChapter: "Chapter",
  stepAnnex: "Annex",
  stepArticle: "Article",
  stepPart: "Part",
  stepSection: "Section",
  stepTable: "Table",
  stepRow: "Row",
  indexEntryGroup: "Index entry",
  indexNumberGroup: "Number the Index gives",

  // Verdict labels
  verdictCorrect: "correct",
  verdictIncorrect: "incorrect",
  verdictNotAnswered: "not answered",

  // Overall state
  overallCorrect: "Correct",
  overallIncorrect: "Incorrect",

  // Buttons and links
  checkButton: "Check my answer",
  tryAgainButton: "Try again",
  backButton: "Back to drills",
  sentinelLinkText: "Learn more at Sentinel Learning",
  switcherLinkText: "Dead Circuit Check",

  // Result labels
  elapsedLabel: "Time",
  answerLabel: "Answer",
  citationLabel: "Citation",
  hintLabel: "Hint",
  rowLineLabel: "Row",
  tableWalkColumn: "Column",
  tableWalkRow: "Row",
  tableWalkValue: "Value",
  noPickText: "No pick",
  timerLabel: "Time left",

  // Guided mode. These are modes, never Method names.
  modeGuided: "Guided",
  modeTimed: "Timed",
  showFullPathButton: "Show the full path",
  runTimedButton: "Run this drill Timed",
  guidedEndHeading: "Your full path",
} as const;

/** Result URL for the Sentinel link. */
export const SENTINEL_URL = "https://sentinellearning.com";

/** Live-region text builders. Time arguments are already formatted as m:ss. */
export const ANNOUNCE = {
  /** Timer thresholds: 60, 30, 10, 0 seconds left. */
  timer(secondsLeft: number): string {
    return secondsLeft <= 0 ? "Time is up." : `${secondsLeft} seconds left.`;
  },
  /** Result announcement, for example "Correct. 1:05 elapsed." */
  result(correct: boolean, expired: boolean, elapsed: string): string {
    if (expired) {
      return correct ? "Correct. Time ran out." : "Incorrect. Time ran out.";
    }
    return `${correct ? "Correct" : "Incorrect"}. ${elapsed} elapsed.`;
  },
  /** Guided verdict for the newest pick, with the step's reason when one exists. */
  guided(verdict: "correct" | "incorrect", why?: string): string {
    if (verdict === "correct") {
      const base = PROSE.guidedCorrectLine;
      return why ? `${base} ${why}` : base;
    }
    return PROSE.guidedPickAgain;
  },
  /** Announced when the last step of the path is picked. */
  guidedDone: PROSE.guidedPathComplete,
} as const;
