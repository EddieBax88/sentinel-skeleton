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

  describe("Guided and Timed mode copy (18.7, 19.16, 22.10, 16.11, 16.12)", () => {
    const guidedStrings = (): string[] => {
      const out: string[] = [FIXED.modeGuided];
      for (const [k, v] of Object.entries(PROSE)) if (/^guided/i.test(k)) out.push(v);
      for (const [k, v] of Object.entries(FIXED)) {
        if (/guided/i.test(k) && typeof v === "string") out.push(v);
      }
      return out;
    };

    it("uses the exact mode labels", () => {
      expect(FIXED.modeGuided).toBe("Guided");
      expect(FIXED.modeTimed).toBe("Timed");
    });

    it("never uses a mode word as a Method name", () => {
      for (const s of allStrings()) {
        expect(s, s).not.toMatch(/\b(?:Guided|Timed)\s+(?:Index Keyword Lookup|Table of Contents Lookup)\b/);
        expect(s, s).not.toMatch(/\b(?:Index Keyword Lookup|Table of Contents Lookup)\s+(?:Guided|Timed)\b/);
        expect(s, s).not.toMatch(/\b(?:Guided|Timed)\s+(?:Method|Lookup)\b/i);
      }
      expect(METHOD_LABELS).not.toContain(FIXED.modeGuided);
      expect(METHOD_LABELS).not.toContain(FIXED.modeTimed);
      expect(FIXED.methodIndex).not.toMatch(/guided|timed/i);
      expect(FIXED.methodToc).not.toMatch(/guided|timed/i);
    });

    it("has no step count or progress counter in any Guided string", () => {
      const list = guidedStrings();
      expect(list.length).toBeGreaterThan(5);
      for (const s of list) {
        expect(s, s).not.toMatch(STEP_COUNT);
        expect(s, s).not.toMatch(STEP_COUNT_ALT);
        expect(s, s).not.toMatch(/\b\d+\s+of\s+\d+\b/i);
        expect(s, s).not.toMatch(/\bsteps?\s+(?:\d+|one|two|three|four|five|six)\b/i);
        expect(s, s).not.toMatch(/\d+\s*\/\s*\d+/);
      }
    });

    it("leaves the Method labels unchanged", () => {
      expect(FIXED.methodIndex).toBe("Index Keyword Lookup");
      expect(FIXED.methodToc).toBe("Table of Contents Lookup");
    });
  });

  it("lists the index method first and the contents method second", () => {
    expect(PROSE.methodIndexDescription).toMatch(/main method/i);
    expect(PROSE.methodTocDescription).toMatch(/second method/i);
  });
});
