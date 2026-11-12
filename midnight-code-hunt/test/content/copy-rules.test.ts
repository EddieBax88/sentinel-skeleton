// Copy rules for src/copy/strings.ts. Covers Requirements 16.10, 16.11, 16.12.
import { describe, expect, it } from "vitest";
import { FIXED, FOOTER_DISCLAIMER, PROSE } from "../../src/copy/strings";
import { CHAPTER_LABELS } from "../../src/logic/chapters";

const METHOD_LABELS = ["Index Keyword Lookup", "Table of Contents Lookup"] as const;

/** Every string in PROSE and FIXED (chapter labels included), flattened. */
function allStrings(): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(PROSE);
  walk(FIXED);
  return out;
}

const NUMBER_WORDS =
  "(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\\d+)";
const STEP_COUNT = new RegExp(`\\b${NUMBER_WORDS}[\\s-]+steps?\\b`, "i");
const STEP_COUNT_ALT = /\bsteps?\s+\d+\s+of\s+\d+\b/i;

describe("copy rules", () => {
  it("has strings to scan", () => {
    expect(allStrings().length).toBeGreaterThan(30);
  });

  it("contains no numeric time-savings figure (16.10)", () => {
    const savings = [
      /\d+\s*%/,
      /\b\d+\s*(?:minutes?|mins?|hours?|seconds?|secs?)\s+(?:saved|faster|quicker|less)\b/i,
      /\b(?:save|saves|saving|saved)\b[^.]*\d/i,
      /\d[^.]*\b(?:saved|faster|quicker)\b/i,
    ];
    for (const s of [...Object.values(PROSE), ...allStrings()]) {
      for (const re of savings) expect(s, `"${s}" matches ${re}`).not.toMatch(re);
    }
  });

  it("contains no step count (16.12)", () => {
    for (const s of allStrings()) {
      expect(s, s).not.toMatch(STEP_COUNT);
      expect(s, s).not.toMatch(STEP_COUNT_ALT);
    }
  });

  it("names a method only with one of the two exact labels (16.11)", () => {
    for (const s of allStrings()) {
      // Any run of capitalized words ending in "Lookup" must be an exact label.
      const found = s.match(/(?:\b[A-Z][A-Za-z]*\s+(?:of\s+)?)*\bLookup\b/g) ?? [];
      for (const hit of found) {
        const ok = METHOD_LABELS.some((label) => hit.endsWith(label) || label === hit);
        expect(ok, `"${hit}" in "${s}"`).toBe(true);
      }
    }
    // Any "<x> method" mention in PROSE must not name a method otherwise.
    for (const s of Object.values(PROSE)) {
      expect(s).not.toMatch(/\b(?:index|contents|toc)\s+(?:method|lookup)\b(?<!Index Keyword Lookup)/i);
    }
  });

  it("uses the exact method labels, chapter labels, and footer", () => {
    expect(FIXED.methodIndex).toBe("Index Keyword Lookup");
    expect(FIXED.methodToc).toBe("Table of Contents Lookup");
    expect(FIXED.chapterLabels).toEqual([
      "Ch 1 General",
      "Ch 2 Plan: circuits, protection, grounding",
      "Ch 3 Build: wiring methods, raceways, cables, boxes",
      "Ch 4 Use: equipment",
      "Ch 5 Special occupancies",
      "Ch 6 Special equipment",
      "Ch 7 Special conditions",
      "Ch 8 Communications",
      "Ch 9 Tables",
    ]);
    expect(CHAPTER_LABELS).toBe(FIXED.chapterLabels);
    expect(FOOTER_DISCLAIMER).toBe(
      "Sentinel Learning is an independent study aid, not affiliated with the NFPA or any licensing board. NEC\u00AE is a registered trademark of the NFPA.",
    );
  });

  it("lists the index method first and the contents method second", () => {
    expect(PROSE.methodIndexDescription).toMatch(/main method/i);
    expect(PROSE.methodTocDescription).toMatch(/second method/i);
  });
});
