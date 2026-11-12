// The ONLY file that holds the banned-term list for the content scan.
// The scan (test/content/content-scan.test.ts) excludes this file by path.
// Covers Requirements 1.11, 16.4, 16.5, 16.6, 16.7, 16.8, 16.10, 16.12, 16.13.
// Matching is whole-word and case-insensitive, so "table" never reads as "tab".

export interface BannedRule {
  /** Short name of the rule, shown in failure reports. */
  readonly id: string;
  /** Global, case-insensitive pattern. */
  readonly pattern: RegExp;
  /** A sample the pattern must match. */
  readonly positive: string;
  /** A sample the pattern must ignore. */
  readonly negative: string;
}

const NUM = "(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";

function rule(id: string, source: string, positive: string, negative: string): BannedRule {
  return { id, pattern: new RegExp(source, "gi"), positive, negative };
}

export const BANNED_RULES: readonly BannedRule[] = [
  // nec-rules 3, 4, 8
  rule("exact page (rule 3)", "\\bexact\\s+pages?\\b", "Go to the exact page", "Go to the page"),
  rule("Codeology (rule 4)", "\\bcodeology\\b", "Try Codeology", "Try the code book"),
  rule("Code Compass (rule 8)", "\\bcode[\\s-]+compass\\b", "Code Compass", "a compass rose"),
  rule(
    "NEC Co-Pilot (rule 8)",
    "\\bnec[\\s-]+co[\\s-]?pilot\\b",
    "NEC Co-Pilot",
    "NEC Chapter 3",
  ),
  // nec-rules 9: step counts, and the retired method name
  rule("step count (rule 9)", `\\b${NUM}[\\s-]+steps?\\b`, "the 5-Step method", "the next step"),
  rule(
    "step count, steps N of M (rule 9)",
    "\\bsteps?\\s+\\d+\\s+of\\s+\\d+\\b",
    "Step 2 of 5",
    "Step by step",
  ),
  rule(
    "retired method name",
    "\\b(?:five|5)[\\s-]+step\\s+(?:method|lookup|trail)\\b",
    "Five-Step Method",
    "Index Keyword Lookup",
  ),
  // Requirement 16.5: tab words
  rule(
    "tab word (16.5)",
    "\\b(?:tabs?|tabbed|tabbing|tabber|tabmaker)\\b",
    "Put a tab on it",
    "See the table",
  ),
  // Requirement 16.6: pass guarantees
  rule(
    "pass guarantee (16.6)",
    "\\b(?:guaranteed?\\s+(?:to\\s+)?(?:pass|score|results?|success)|(?:you(?:'ll|\\s+will)|will\\s+help\\s+you)\\s+pass|pass\\s+(?:the|your)\\s+(?:exam|test)|ace\\s+(?:the|your)\\s+(?:exam|test)|(?:passing|perfect)\\s+score)\\b",
    "You will pass",
    "Find the answer in your code book",
  ),
  // Requirement 16.7: gendered pronouns and terms
  rule("gendered pronoun (16.7)", "\\b(?:he|him|his|she|her|hers|himself|herself)\\b", "Ask her", "the other"),
  rule(
    "gendered term (16.7)",
    "\\b(?:guys|gentlemen|ladies|manpower|mankind|businessman|salesman)\\b",
    "Hey guys",
    "Journeyman Electrician",
  ),
  // Requirement 16.8: invented testimonials, endorsements, user counts
  rule(
    "testimonial (16.8)",
    `\\b(?:testimonials?|what\\s+(?:our\\s+)?users\\s+say|\\d[\\d,]*\\+?\\s+(?:users|electricians|students|members))\\b`,
    "Read the testimonials",
    "Pick the right section",
  ),
  // Requirement 16.10: numeric time-savings figures
  rule(
    "time-savings figure (16.10)",
    "(?:\\b(?:save[sd]?|saving)\\s+(?:up\\s+to\\s+)?\\d|\\d+\\s*%\\s*(?:faster|quicker|less|time)|\\b\\d+\\s*(?:minutes?|mins?|hours?|seconds?|secs?)\\s+(?:saved|faster|quicker|less))",
    "Save 30 minutes",
    "Find answers in less time",
  ),
  // Requirement 16.13: fetch-style network calls
  rule(
    "network call (16.13)",
    "\\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\\b",
    "fetch('/x')",
    "prefetched",
  ),
];
