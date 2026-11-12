import { describe, expect, it } from "vitest";
import { PROSE } from "../../src/copy/strings";
import { analyzeText } from "../support/readingLevel";

// Validates: Requirements 16.9
// FIXED strings (footer, method labels, chapter labels, short labels) are exempt.
const entries = Object.entries(PROSE) as [string, string][];
const all = entries.map(([, v]) => v);

describe("PROSE reading level", () => {
  it("has prose strings to check", () => {
    expect(all.length).toBeGreaterThan(0);
  });

  it.each(entries)("%s has average sentence length of 15 words or fewer", (_key, text) => {
    expect(analyzeText(text).averageSentenceLength).toBeLessThanOrEqual(15);
  });

  it("whole PROSE set has average sentence length of 15 words or fewer", () => {
    expect(analyzeText(all).averageSentenceLength).toBeLessThanOrEqual(15);
  });

  it("whole PROSE set is Flesch-Kincaid grade 7.0 or lower", () => {
    expect(analyzeText(all).grade).toBeLessThanOrEqual(7.0);
  });
});
