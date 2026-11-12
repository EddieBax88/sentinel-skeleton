import { describe, expect, it } from "vitest";
import { analyzeText, countSyllables, splitSentences } from "./readingLevel";

describe("readingLevel helpers", () => {
  it("counts syllables by vowel groups", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("table")).toBe(2);
    expect(countSyllables("make")).toBe(1);
    expect(countSyllables("electrical")).toBe(4);
    expect(countSyllables("NEC")).toBe(1);
  });

  it("splits sentences", () => {
    expect(splitSentences("One two. Three four! Five?")).toHaveLength(3);
  });

  it("computes the grade formula", () => {
    const s = analyzeText("The cat sat. The dog ran.");
    expect(s.words).toBe(6);
    expect(s.sentences).toBe(2);
    expect(s.averageSentenceLength).toBe(3);
    expect(s.grade).toBeCloseTo(0.39 * 3 + 11.8 * 1 - 15.59, 5);
  });
});
