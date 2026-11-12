// Feature: midnight-code-hunt, Property 1: Display name follows the printed-name rule
// Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.7, 3.8
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { OptionNode, OptionRole } from "../model/types";
import {
  buildNamesIndex,
  type CheckedNameEntry,
  type CheckedNamesFile,
} from "./displayName";
import { resolveDisplay } from "./displayName";

const RUNS = { numRuns: 200 };

const arbKey = fc.stringMatching(/^[a-z0-9]{1,12}$/);
const arbShort = fc.stringMatching(/^[a-z0-9][a-z0-9 ,-]{0,30}$/);
// Printed wording: arbitrary text, including odd spacing and casing, that must survive untouched.
const arbPrinted = fc.string({ minLength: 1, maxLength: 60 });
const arbDesignator = fc.option(fc.stringMatching(/^[A-Za-z0-9.()]{1,8}$/), { nil: undefined });
const arbRole = fc.constantFrom<OptionRole>("correct", "moved", "wrong");

const arbEntry = (key: string): fc.Arbitrary<CheckedNameEntry> =>
  fc.record({
    key: fc.constant(key),
    shortDescription: arbShort,
    printed: fc.option(arbPrinted, { nil: undefined }),
    checked: fc.boolean(),
  });

type Scenario = {
  readonly node: OptionNode;
  readonly file2023: CheckedNamesFile;
  readonly file2026: CheckedNamesFile;
  readonly entry2023: CheckedNameEntry | undefined;
  readonly entry2026: CheckedNameEntry | undefined;
};

const arbScenario: fc.Arbitrary<Scenario> = fc
  .record({
    key: arbKey,
    value: fc.string({ minLength: 1, maxLength: 40 }),
    designator: arbDesignator,
    role: arbRole,
    has2023: fc.boolean(),
    has2026: fc.boolean(),
    others: fc.array(arbKey, { maxLength: 4 }),
  })
  .chain((s) =>
    fc
      .tuple(arbEntry(s.key), arbEntry(s.key))
      .map(([e23, e26]): Scenario => {
        const entry2023 = s.has2023 ? e23 : undefined;
        const entry2026 = s.has2026 ? e26 : undefined;
        const filler = (edition: 2023 | 2026): CheckedNameEntry[] =>
          s.others
            .filter((k) => k !== s.key)
            .map((k) => ({ key: k, shortDescription: "filler " + edition, checked: false }));
        const node = {
          level: "section",
          value: s.value,
          designator: s.designator,
          nameKey: s.key,
          role: s.role,
        } as OptionNode;
        return {
          node,
          entry2023,
          entry2026,
          file2023: {
            edition: 2023,
            entries: [...filler(2023), ...(entry2023 ? [entry2023] : [])],
          },
          file2026: {
            edition: 2026,
            entries: [...filler(2026), ...(entry2026 ? [entry2026] : [])],
          },
        };
      }),
  );

describe("Property 1: Display name follows the printed-name rule", () => {
  it("resolves per the decision table, using the 2023 file for moved nodes", () => {
    fc.assert(
      fc.property(arbScenario, (s) => {
        const names = buildNamesIndex({ y2023: s.file2023, y2026: s.file2026 });
        const res = resolveDisplay(s.node, names);
        const entry = s.node.role === "moved" ? s.entry2023 : s.entry2026;

        if (entry === undefined) {
          // Missing entry: raw value, key reported, no short-description fallback.
          expect(res.text).toBe(s.node.value);
          expect(res.source).toBe("raw");
          expect(res.unresolvedKey).toBe(s.node.nameKey);
          return;
        }
        expect(res.unresolvedKey).toBeUndefined();
        const fallback =
          s.node.designator !== undefined && s.node.designator !== ""
            ? s.node.designator + " " + entry.shortDescription
            : entry.shortDescription;
        if (entry.checked && entry.printed !== undefined) {
          // Printed word for word: no trimming, re-casing, or re-spacing.
          expect(res.text).toBe(entry.printed);
          expect(res.source).toBe("printed");
          expect(res.inconsistent).toBeUndefined();
        } else {
          expect(res.text).toBe(fallback);
          expect(res.source).toBe("short-description");
          expect(res.inconsistent).toBe(entry.checked ? true : undefined);
        }
      }),
      RUNS,
    );
  });

  it("never uses printed wording from an unchecked entry", () => {
    fc.assert(
      fc.property(arbKey, arbShort, arbPrinted, arbRole, (key, short, printed, role) => {
        const entry: CheckedNameEntry = { key, shortDescription: short, printed, checked: false };
        const names = buildNamesIndex({
          y2023: { edition: 2023, entries: [entry] },
          y2026: { edition: 2026, entries: [entry] },
        });
        const node = { level: "section", value: "raw", designator: "1", nameKey: key, role } as OptionNode;
        const res = resolveDisplay(node, names);
        expect(res.source).toBe("short-description");
        expect(res.text).toBe("1 " + short);
      }),
      RUNS,
    );
  });

  it("looks a moved node up in 2023 even when only 2026 has the key", () => {
    const names = buildNamesIndex({
      y2023: { edition: 2023, entries: [] },
      y2026: { edition: 2026, entries: [{ key: "k", shortDescription: "x", printed: "P", checked: true }] },
    });
    const node = { level: "section", value: "v", nameKey: "k", role: "moved" } as OptionNode;
    expect(resolveDisplay(node, names)).toEqual({ text: "v", source: "raw", unresolvedKey: "k" });
  });
});
