import * as fc from "fast-check";
import type {
  CalcPluginDef,
  Invariant,
  InvariantReport,
} from "../src/plugin/types.js";

/**
 * Runs every invariant of a calculator plug-in against its supplied
 * arbitrary. Never throws; failures (including throws from `calculate`)
 * are reported as `status: "fail"` with a non-empty counterexample.
 */
export function runInvariants<I, O>(
  plugin: CalcPluginDef<I, O>,
  arbitraries: Record<string, fc.Arbitrary<I>>,
  options?: { numRuns?: number }
): InvariantReport[] {
  const numRuns = options?.numRuns ?? 100;
  return plugin.invariants.map((inv: Invariant<I, O>): InvariantReport => {
    const arb = arbitraries[inv.id];
    if (!arb) {
      return {
        invariantId: inv.id,
        status: "fail",
        counterexample: `No arbitrary supplied for invariant "${inv.id}"`,
      };
    }
    try {
      const result = fc.check(
        fc.property(arb, (input: I) => {
          let output: O;
          try {
            output = plugin.calculate(input);
          } catch (err) {
            // calculate threw — record as failure
            throw new Error(
              `calculate threw for input ${fc.stringify(input)}: ${String(err)}`
            );
          }
          return inv.check(input, output);
        }),
        { numRuns }
      );
      if (result.failed) {
        return {
          invariantId: inv.id,
          status: "fail",
          counterexample: fc.stringify(result.counterexample),
        };
      }
      return { invariantId: inv.id, status: "pass", counterexample: null };
    } catch (err) {
      return {
        invariantId: inv.id,
        status: "fail",
        counterexample: String(err),
      };
    }
  });
}
