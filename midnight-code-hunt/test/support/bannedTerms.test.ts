// Proves each banned-term pattern matches its positive sample and ignores its negative one.
import { describe, expect, it } from "vitest";
import { BANNED_RULES } from "./bannedTerms";

describe("bannedTerms", () => {
  for (const r of BANNED_RULES) {
    it(`${r.id}: matches the positive sample and ignores the negative one`, () => {
      expect(r.pattern.flags).toContain("i");
      expect(r.positive.match(r.pattern)).not.toBeNull();
      expect(r.negative.match(r.pattern)).toBeNull();
    });
  }

  it("does not read table as tab", () => {
    const tab = BANNED_RULES.find((r) => r.id.startsWith("tab word"))!;
    expect("table".match(tab.pattern)).toBeNull();
    expect("TAB".match(tab.pattern)).not.toBeNull();
  });
});
