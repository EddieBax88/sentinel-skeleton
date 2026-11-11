import type { CodeTrail } from "../trail/types.js";

export type CalcInput = {
  /** Non-empty, 1–100 chars. */
  readonly name: string;
  readonly type: "number" | "string" | "select";
  /** Required when `type === "select"`. */
  readonly options?: readonly string[];
};

export type CalcOutput = {
  /** Non-empty, 1–100 chars. */
  readonly name: string;
  readonly type: "number" | "string";
};

export type Invariant<I, O> = {
  /** Non-empty, 1–100 chars. */
  readonly id: string;
  /** Non-empty, 1–200 chars. */
  readonly description: string;
  readonly check: (input: I, output: O) => boolean;
  // No arbitrary here: the test file supplies it externally.
};

export type InvariantReport = {
  readonly invariantId: string;
  readonly status: "pass" | "fail";
  readonly counterexample: string | null;
};

export type CalcPluginDef<I, O> = {
  /** Non-empty, 1–100 chars. */
  readonly id: string;
  /** Non-empty, 1–120 chars. */
  readonly label: string;
  readonly inputs: readonly [CalcInput, ...CalcInput[]];
  readonly outputs: readonly [CalcOutput, ...CalcOutput[]];
  /** Synchronous and pure; no Promise. */
  readonly calculate: (input: I) => O;
  readonly trails: (input: I) => readonly [CodeTrail, ...CodeTrail[]];
  readonly invariants: readonly [Invariant<I, O>, ...Invariant<I, O>[]];
};

/** Alias kept for naming clarity at registration sites. */
export type CalcPlugin<I = unknown, O = unknown> = CalcPluginDef<I, O>;
