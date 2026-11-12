import { extractFirstNumber } from "@sentinel/skeleton-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { OptionNode, OptionRole } from "../model/types";
import { CHAPTER_LABELS, completeChapterOptions } from "./chapters";
import { buildNamesIndex, resolveDisplay } from "./displayName";

// Feature: midnight-code-hunt, Property 2: Chapter options are always the nine fixed labels in order
// **Validates: Requirements 9.8, 3.9**

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});

const roleArb: fc.Arbitrary<OptionRole> = fc.constantFrom("correct", "moved", "wrong");

const childArb: fc.Arbitrary<OptionNode> = fc.record({
  level: fc.constant("article" as const),
  value: fc.constantFrom("Article 100", "Article 210"),
  role: roleArb,
  hasParts: fc.boolean(),
});

// Numbers span out of range (0, 10+), in range 1-9, and no-number values.
const chapterNodeArb: fc.Arbitrary<OptionNode> = fc
  .record({
    value: fc.oneof(
      fc.integer({ min: 0, max: 15 }).map((n) => `Chapter ${n}`),
      fc.constant("Chapter"),
    ),
    role: roleArb,
    next: fc.option(fc.tuple(childArb), { nil: undefined }),
  })
  .map(({ value, role, next }) => ({
    level: "chapter" as const,
    value,
    role,
    ...(next !== undefined ? { next } : {}),
  }));

// Arbitrary list: empty, duplicates, out-of-range, any order.
const authoredArb = fc.array(chapterNodeArb, { minLength: 0, maxLength: 25 });

describe("Property 2: chapter options are always the nine fixed labels in order", () => {
  it("returns nine ordered slots, authored nodes in their own slot, generated wrong nodes elsewhere", () => {
    fc.assert(
      fc.property(authoredArb, (authored) => {
        const result = completeChapterOptions(authored);
        expect(result).toHaveLength(9);

        for (let n = 1; n <= 9; n++) {
          const slot = result[n - 1] as OptionNode;
          const firstAuthored = authored.find((a) => extractFirstNumber(a.value) === n);

          expect(slot.level).toBe("chapter");
          expect(extractFirstNumber(slot.value)).toBe(n);

          if (firstAuthored !== undefined) {
            expect(slot).toBe(firstAuthored);
          } else {
            expect(slot.role).toBe("wrong");
            expect(slot.next).toBeUndefined();
          }

          expect(resolveDisplay(slot, names).text).toBe(CHAPTER_LABELS[n - 1]);
        }

        // Authored nodes outside 1-9 never appear.
        for (const node of result) {
          const num = extractFirstNumber(node.value);
          expect(num !== null && num >= 1 && num <= 9).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("returns the nine generated wrong nodes for an empty authored list", () => {
    const result = completeChapterOptions([]);
    expect(result).toHaveLength(9);
    expect(result.every((n) => n.role === "wrong" && n.next === undefined)).toBe(true);
    expect(result.map((n) => resolveDisplay(n, names).text)).toEqual([...CHAPTER_LABELS]);
  });
});
