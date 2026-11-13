import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arbDrill } from "../../test/support/arbitraries";
import { methodOf } from "../model/methods";
import type { DrillRecord, MethodId, OptionNode } from "../model/types";
import { judgePick } from "./guided";
import { optionsAt, treeFor } from "./stepEngine";

// Feature: midnight-code-hunt, Property 31: A Guided verdict is prefix membership, decided by the Core
// **Validates: Requirements 19.5, 19.13, 10.1, 10.11**

const norm = (s: string): string => s.trim().toLowerCase();

/** Declared trails of the Method as sequences: keyword, then every leg's steps flattened. */
function declaredSequences(drill: DrillRecord, method: MethodId): string[][] {
  return drill.def.trails
    .filter((t) => methodOf(t) === method)
    .map((t) => [norm(t.keyword), ...t.legs.flatMap((leg) => leg.map((s) => norm(s.value)))]);
}

/** Independent oracle: is `values` a prefix of some declared valid trail? movedFrom is never consulted. */
function oracleIsPrefix(drill: DrillRecord, method: MethodId, values: readonly string[]): boolean {
  const wanted = values.map(norm);
  return declaredSequences(drill, method).some(
    (seq) => wanted.length <= seq.length && wanted.every((v, i) => seq[i] === v),
  );
}

const arbCase = fc
  .record({
    drill: arbDrill,
    useIndex: fc.boolean(),
    walk: fc.array(fc.nat(), { minLength: 0, maxLength: 12 }),
    last: fc.nat(),
    upper: fc.boolean(),
    pad: fc.constantFrom("", " ", "\t "),
  })
  .map((c) => ({
    ...c,
    method: (c.useIndex && c.drill.trees.index !== undefined ? "index" : "toc") as MethodId,
  }));

describe("Property 31: A Guided verdict is prefix membership, decided by the Core", () => {
  it("judgePick is correct iff accepted picks plus the pick are a prefix of a declared trail", () => {
    fc.assert(
      fc.property(arbCase, ({ drill, method, walk, last, upper, pad }) => {
        const tree = treeFor(drill, method);

        // Build an accepted correct prefix by following only oracle-correct offered options.
        const accepted: string[] = [];
        for (const k of walk) {
          const options = optionsAt(tree, accepted, accepted.length);
          if (options === undefined) break;
          const good = options.filter((o) => oracleIsPrefix(drill, method, [...accepted, o.value]));
          if (good.length === 0) break;
          accepted.push((good[k % good.length] as OptionNode).value);
        }

        const depth = accepted.length;
        const options = optionsAt(tree, accepted, depth);
        if (options === undefined || options.length === 0) return;

        for (const option of options) {
          const typed = `${pad}${upper ? option.value.toUpperCase() : option.value}${pad}`;
          const expected = oracleIsPrefix(drill, method, [...accepted, option.value]);
          const judged = judgePick(drill, method, accepted, depth, typed);
          expect(judged.offered).toBe(true);
          if (judged.offered) {
            expect(judged.verdict).toBe(expected ? "correct" : "incorrect");
          }
        }

        // One random option as an explicit spot check at this depth.
        const chosen = options[last % options.length] as OptionNode;
        const judged = judgePick(drill, method, accepted, depth, chosen.value);
        expect(judged.offered && judged.verdict === "correct").toBe(
          oracleIsPrefix(drill, method, [...accepted, chosen.value]),
        );
      }),
      { numRuns: 200 },
    );
  });

  it("at depth 0 the verdict is correct iff the value matches a trail keyword; movedFrom never helps", () => {
    fc.assert(
      fc.property(arbCase, ({ drill, method }) => {
        const tree = treeFor(drill, method);
        const keywords = new Set(declaredSequences(drill, method).map((s) => s[0]));
        const movedKeyword = drill.def.movedFrom?.keyword;
        for (const option of tree) {
          const judged = judgePick(drill, method, [], 0, option.value);
          expect(judged.offered).toBe(true);
          if (!judged.offered) continue;
          expect(judged.verdict).toBe(keywords.has(norm(option.value)) ? "correct" : "incorrect");
          if (
            movedKeyword !== undefined &&
            norm(movedKeyword) === norm(option.value) &&
            !keywords.has(norm(option.value))
          ) {
            expect(judged.verdict).toBe("incorrect");
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});
