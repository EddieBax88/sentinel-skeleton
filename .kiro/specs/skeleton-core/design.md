# Design Document: skeleton-core

## Overview

`packages/skeleton-core` is a pure-TypeScript library package with zero runtime dependencies. It exports the shared engine contracts and utilities that power both the Midnight Code Hunt and Dead Circuit Check apps. Its responsibilities are:

1. The **CodeTrail** type system — the canonical representation of an NEC navigation path and the structural validation rules for it.
2. The **TrailGrader** — a pure function that evaluates user picks against one or more valid trails and returns per-step feedback.
3. The **defineCalcPlugin** contract — a typed identity function that forces every calculator to declare its inputs, outputs, `calculate` function, code-trail resolver, and property-based test invariants.
4. The **defineCodeTrail** contract — a typed identity function that forces every drill pack to declare its trails, optional previous-edition trail, and hint.
5. The **TableValue** data shape and `makeTableValue` helper — ensuring every NEC table value carries a source citation and an audit flag.
6. The **createRegistry** factory — a lightweight runtime map for plugins and drill packs keyed by id.

`fast-check` is a devDependency only. It is never imported in `src/`. The published `dist/` contains no fast-check import paths.

---

## Architecture

```
packages/skeleton-core/
├── src/
│   ├── trail/
│   │   ├── types.ts          # TrailLevel, ALLOWED_LEVELS, TrailStep, TrailLeg, CodeTrail
│   │   ├── validate.ts       # validateCodeTrail, per-leg structural rules
│   │   └── grade.ts          # NO_PARTS, GradeResult, gradeTrail
│   ├── plugin/
│   │   ├── types.ts          # CalcInput, CalcOutput, Invariant, CalcPluginDef, InvariantReport
│   │   ├── defineCalcPlugin.ts   # defineCalcPlugin identity function
│   │   └── runInvariants.ts  # REMOVED — moved to src-test-utils/
│   ├── drill/
│   │   ├── types.ts          # CodeTrailDef
│   │   └── defineCodeTrail.ts    # defineCodeTrail identity function
│   ├── table/
│   │   ├── types.ts          # TableValue
│   │   └── makeTableValue.ts # makeTableValue helper
│   ├── registry/
│   │   ├── types.ts          # PluginRegistry interface
│   │   └── createRegistry.ts # createRegistry factory
│   └── index.ts              # Barrel: re-exports everything except runInvariants
├── src-test-utils/
│   └── runInvariants.ts      # runInvariants — only file that imports fast-check
│                             # exported from a separate "test-utils" entry point
├── package.json
└── tsconfig.json
```

### Runtime boundary for fast-check

`runInvariants` calls fast-check's `fc.check` / `fc.property` APIs. If it lived in `src/` and was re-exported from `index.ts`, any bundler would pull `fast-check` into the consumer's production bundle. To prevent this:

- `runInvariants` lives in `src-test-utils/runInvariants.ts`.
- `package.json` declares a **second entry point** (`"test-utils"` export condition) pointing to that file's compiled output.
- The main `"."` entry point (`dist/index.js`) contains no reference to fast-check whatsoever.
- App packages and drill packs import `runInvariants` from `@sentinel/skeleton-core/test-utils` only inside `*.test.ts` files.

```jsonc
// package.json exports field (abbreviated)
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./test-utils": {
      "types": "./dist-test-utils/runInvariants.d.ts",
      "default": "./dist-test-utils/runInvariants.js"
    }
  }
}
```

The `build:test-utils` script (`tsc -p tsconfig.test-utils.json`) builds against the referenced main project: `tsconfig.test-utils.json` declares `"references": [{ "path": "./tsconfig.json" }]`, so the main project's declarations (`dist/`) must exist before the test-utils entry point is compiled.

### Build tooling

The package is built with **tsc only** (`tsconfig.json` with `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"declaration": true`, `"declarationMap": true`, `"outDir": "dist"`). No bundler is needed for a pure-TS library consumed via npm workspaces. A separate `tsconfig.test-utils.json` compiles `src-test-utils/` to `dist-test-utils/`.

---

## Components and Interfaces

### 1. Trail — types (`src/trail/types.ts`)

```typescript
export type TrailLevel =
  | "chapter"
  | "article"
  | "part"
  | "section"
  | "table"
  | "notes"
  | "annex"
  | "index";

export const ALLOWED_LEVELS = [
  "chapter",
  "article",
  "part",
  "section",
  "table",
  "notes",
  "annex",
  "index",
] as const satisfies readonly TrailLevel[];

export type TrailStep = {
  readonly level: TrailLevel;
  readonly value: string; // 1–200 characters, non-empty
};

export type TrailLeg = readonly [TrailStep, ...TrailStep[]]; // non-empty

export type CodeTrail = {
  readonly keyword: string; // 1–200 characters, non-empty
  readonly legs: readonly [TrailLeg, ...TrailLeg[]]; // non-empty
};
```

The `as const satisfies` on `ALLOWED_LEVELS` guarantees the TypeScript compiler rejects any mutation or reordering of elements because the type is inferred as the specific tuple literal.

---

### 2. Trail — validateCodeTrail (`src/trail/validate.ts`)

#### Return type

```typescript
export type ValidationFailure = {
  field: string;      // e.g. "keyword", "legs[0].steps[2]"
  message: string;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; failures: ValidationFailure[] };
```

#### Per-leg structural rules

Each leg is validated as a sequence of `TrailStep` values. The validator walks the step sequence through a small state machine:

| Path kind | Required first step | Allowed subsequent steps | May end at |
|---|---|---|---|
| **Main chapters 1–8** | `"chapter"` whose `extractFirstNumber(value)` is 1–8 (or null — validation failure) | `article` → optional `part` → one or more of `section` / `table` → optional `notes` | `section`, `table`, `notes` |
| **Chapter 9** | `"chapter"` whose `extractFirstNumber(value) === 9` | `table` → optional `notes`. No `article`, `part`, or `section`. | `table`, `notes` |
| **Annex** | `"annex"` | `table` → optional `notes` | `table`, `notes` |
| **Article 90 intro** | `"article"` whose `extractFirstNumber(value) === 90` | `section` → optional `notes` | `section`, `notes` |
| **Index** | `"index"` | One or more `section` / `table` steps (repeats allowed, so lettered and numbered subdivisions are separate `section` steps), then optional `notes`. No `chapter`, `article`, or `part` steps. A lone `index` is invalid. Rationale: the Index route is the index entry path, then the section number the Index gives, then the subdivisions, in a single leg; the section number appears once. | `section`, `table`, `notes` |

#### extractFirstNumber helper

```typescript
// src/trail/validate.ts (also exported from src/index.ts)
export function extractFirstNumber(s: string): number | null {
  const m = s.match(/\d+/);
  return m ? Number(m[0]) : null;
}
```

Explanation: scans `s` for the first contiguous run of ASCII digit characters and returns it as a `number`. Returns `null` when no digits are present. Only the first run is used; any later digit runs are ignored. Used by `validateCodeTrail` to identify chapter and article numbers from step values without relying on string-prefix matching.

The path kind is determined by inspecting the first step. Unknown first steps are a validation failure. The failure message lists the valid starts: chapter, annex, index, and article (Article 90 only).

A `CodeTrail` with `keyword: ""` immediately fails. A `CodeTrail` with `legs: []` immediately fails. When a `CodeTrailDef` is passed, all `CodeTrail` values in `trails` and the optional `movedFrom` are validated and all failures are collected into a single result. When given a `CodeTrailDef`, validation also checks that `editionNote` (if present) is 1-300 characters; otherwise it reports a failure with field `"editionNote"`.

#### Algorithm sketch

```
function validateLeg(leg: TrailLeg, legIndex: number): ValidationFailure[]
  failures = []
  determine path kind from leg[0].level and leg[0].value
  walk through a state machine of (expected-next-levels, done-flag)
  for each step, if level not in expected-next → push failure
  return failures

function validateCodeTrail(trail: CodeTrail): ValidationResult
  failures = []
  if trail.keyword.trim() === "" → push failure for "keyword"
  if trail.legs.length === 0 → push failure for "legs"
  for each leg in trail.legs → failures.push(...validateLeg(leg, i))
  return ok if failures is empty, else { ok: false, failures }
```

---

### 3. Trail — gradeTrail (`src/trail/grade.ts`)

#### Exported constants and types

```typescript
export const NO_PARTS = "NONE" as const;

export type TrailVerdict = "correct" | "incorrect" | "unanswered";

export type StepResult = {
  level: TrailLevel;
  verdict: TrailVerdict;
};

export type GradeResult = {
  stepResults: StepResult[];
  matched: boolean;
  matchedMovedFrom: boolean;
};
```

On a trail with no `"part"` step, a `StepResult` with `level: "part"` is a synthetic entry that does not correspond to any step of the trail. `stepResults` normally has one entry per step of the graded trail; on a part-less trail it MAY additionally contain exactly one synthetic `{ level: "part", verdict: "incorrect" }` entry (see the algorithm below for its placement).

#### DrillDef (input to gradeTrail)

```typescript
// Lives in src/trail/grade.ts or a shared types file
export type DrillDef = {
  trails: readonly [CodeTrail, ...CodeTrail[]]; // non-empty
  movedFrom?: CodeTrail;
};
```

#### gradeTrail signature

```typescript
export type UserPick = {
  readonly level: TrailLevel;
  readonly value: string;
};

export function gradeTrail(
  drill: DrillDef,
  picks: readonly UserPick[]
): GradeResult
```

#### Algorithm

1. For each `CodeTrail` in `drill.trails`, flatten all legs into a single ordered array of `TrailStep` values.
2. Before aligning, when the flattened trail contains no step with level `"part"`, remove EVERY pick from the picks array whose `level` is `"part"`, regardless of its `value`. This keeps subsequent picks correctly index-aligned without requiring the UI to reindex. If any removed pick's `value` was not `NO_PARTS`, record a `partMisfire` flag for this trail attempt (see step 2a). A `NO_PARTS` pick, or the absence of any part pick, does not set the flag. When the trail has a `"part"` step, nothing is removed and the behavior is unchanged.
   - 2a. When `partMisfire` is set, the attempt cannot match that trail (`matched` is `false` for it), and `stepResults` for that trail MUST include exactly one synthetic `{ level: "part", verdict: "incorrect" }` entry. The remaining (real) steps are still graded on their own by index alignment against the remaining picks, so the synthetic entry never changes the verdict of any real step.
   - 2b. **Placement of the synthetic entry** (flattened sequence of the trail, all legs concatenated in order): insert it immediately after the first step with level `"article"`, which is where the part step would sit. If the flattened sequence has no `"article"`-level step (for example a Chapter 9 leg, annex leg, or index leg), insert it immediately after the last step that precedes the first `"section"` or `"table"` step, that is, directly before that first `"section"`/`"table"` step. If the flattened sequence also has no `"section"` or `"table"` step, append it at the end. With multiple legs the rule is applied once to the whole flattened sequence, so exactly one synthetic entry is produced, never one per leg. This placement rule is confirmed: the synthetic part entry goes after the first article-level step; if there is none, immediately before the first section/table step; if there is none, at the end. Article 90 intro legs start with an `"article"` step, so the primary rule applies to them and the synthetic entry lands directly after that article step, before the `section`.
3. Compare each remaining pick to the corresponding flattened step by index. A pick matches a step when `pick.level === step.level` AND the trimmed, lowercased `pick.value` equals the trimmed, lowercased `step.value`.
4. A pick whose `level` does not match the step's `level` at that index is `"incorrect"` (level mismatch counts as wrong).
5. If the trail does have a `"part"` step and the user submits a pick `{ level: "part", value: NO_PARTS }` at that index, that pick is `"incorrect"`.
6. If all steps match for any single trail after the strip-and-align process, return `{ matched: true, matchedMovedFrom: false, stepResults: [...] }`.
7. If no trail matches and `drill.movedFrom` is present, repeat steps 1–5 against `movedFrom`. If it matches, return `{ matched: false, matchedMovedFrom: true, stepResults: [...] }`.
8. If nothing matches, return `{ matched: false, matchedMovedFrom: false, stepResults: [...] }`.
9. `stepResults` is computed against the trail that best matched (most steps correct). Unmatched positions carry `verdict: "incorrect"`. Positions beyond the picks array carry `verdict: "unanswered"`.
10. The function reads no module-level mutable state and writes no module-level mutable state.

---

### 4. CalcPlugin — types (`src/plugin/types.ts`)

```typescript
export type CalcInput = {
  readonly name: string;         // non-empty, 1–100 chars
  readonly type: "number" | "string" | "select";
  readonly options?: readonly string[]; // required when type === "select"
};

export type CalcOutput = {
  readonly name: string;         // non-empty, 1–100 chars
  readonly type: "number" | "string";
};

export type Invariant<I, O> = {
  readonly id: string;           // non-empty, 1–100 chars
  readonly description: string;  // non-empty, 1–200 chars
  readonly check: (input: I, output: O) => boolean;
  // NOTE: No fc.Arbitrary here. The arbitrary is supplied externally by the test file.
};

export type CalcPluginDef<I, O> = {
  readonly id: string;                        // non-empty, 1–100 chars
  readonly label: string;                     // non-empty, 1–120 chars
  readonly inputs: readonly [CalcInput, ...CalcInput[]];   // non-empty
  readonly outputs: readonly [CalcOutput, ...CalcOutput[]]; // non-empty
  readonly calculate: (input: I) => O;        // synchronous, no Promise
  readonly trails: (input: I) => readonly [CodeTrail, ...CodeTrail[]]; // non-empty
  readonly invariants: readonly [Invariant<I, O>, ...Invariant<I, O>[]]; // non-empty
};

// CalcPlugin is an alias; kept for naming clarity at registration sites
export type CalcPlugin<I = unknown, O = unknown> = CalcPluginDef<I, O>;
```

---

### 5. CalcPlugin — defineCalcPlugin (`src/plugin/defineCalcPlugin.ts`)

```typescript
export function defineCalcPlugin<I, O>(
  def: CalcPluginDef<I, O>
): CalcPluginDef<I, O> {
  return def; // pure identity at runtime
}
```

The function is an identity at runtime. Its value is entirely in the TypeScript generic constraints, which force the author to provide all required fields correctly typed.

---

### 6. CalcPlugin — runInvariants (`src-test-utils/runInvariants.ts`)

This is the **only** file in the entire package that imports `fast-check`.

```typescript
import * as fc from "fast-check";
import type { CalcPluginDef, Invariant, InvariantReport } from "../src/plugin/types.js";

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
              `calculate threw for input ${JSON.stringify(input)}: ${String(err)}`
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
```

`InvariantReport` is defined in `src/plugin/types.ts` (no fast-check import needed there):

```typescript
export type InvariantReport = {
  readonly invariantId: string;
  readonly status: "pass" | "fail";
  readonly counterexample: string | null;
};
```

---

### 7. Drill — defineCodeTrail (`src/drill/`)

#### CodeTrailDef type (`src/drill/types.ts`)

```typescript
export type CodeTrailDef = {
  readonly id: string;           // non-empty, 1–128 chars
  readonly label: string;        // non-empty, 1–128 chars
  readonly trails: readonly [CodeTrail, ...CodeTrail[]]; // non-empty
  readonly hint: string;         // non-empty, 1–500 chars; no NEC text quotes
  readonly movedFrom?: CodeTrail;
  readonly editionNote?: string; // 1-300 chars; shown by the UI alongside matchedMovedFrom feedback
  readonly tableValues?: ReadonlyArray<TableValue>;
};
```

`gradeTrail` and `GradeResult` are unchanged. The UI reads `editionNote` from the drill definition and shows it alongside `matchedMovedFrom` feedback.

#### defineCodeTrail (`src/drill/defineCodeTrail.ts`)

```typescript
export function defineCodeTrail(def: CodeTrailDef): CodeTrailDef {
  return def; // pure identity at runtime
}
```

---

### 8. TableValue (`src/table/`)

#### TableValue type (`src/table/types.ts`)

```typescript
export type TableValue = {
  readonly value: number;
  readonly source: string;       // non-empty; names the NEC table
  readonly nfpa_checked: boolean; // default false at construction time
};
```

#### makeTableValue (`src/table/makeTableValue.ts`)

```typescript
export function makeTableValue(
  value: number,
  source: string,
  nfpa_checked = false
): TableValue {
  if (source.trim() === "") {
    throw new Error("makeTableValue: source must be a non-empty string");
  }
  return { value, source, nfpa_checked };
}
```

---

### 9. Registry (`src/registry/`)

#### PluginRegistry interface (`src/registry/types.ts`)

```typescript
export type RegistryEntry = CalcPlugin | CodeTrailDef;

export interface PluginRegistry {
  register(entry: RegistryEntry): void;
  lookup(id: string): RegistryEntry | undefined;
  list(): ReadonlyArray<RegistryEntry>;
}
```

#### createRegistry (`src/registry/createRegistry.ts`)

```typescript
export function createRegistry(): PluginRegistry {
  const map = new Map<string, RegistryEntry>();
  const order: RegistryEntry[] = [];

  return {
    register(entry: RegistryEntry): void {
      const id: unknown = (entry as { id?: unknown } | null | undefined)?.id;
      if (typeof id !== "string" || id.length === 0) {
        throw new Error("PluginRegistry: entry id must be a non-empty string");
      }
      if (map.has(id)) {
        throw new Error(`PluginRegistry: duplicate id "${id}"`);
      }
      map.set(id, entry);
      order.push(entry);
    },
    lookup(id: string): RegistryEntry | undefined {
      return map.get(id);
    },
    list(): ReadonlyArray<RegistryEntry> {
      // Return a copy so callers cannot observe later mutations or affect internal order.
      return order.slice();
    },
  };
}
```

Behavior (Req 7):

- `register` first checks that `entry.id` is a non-empty string (absent, non-string, or empty throws an `Error` indicating an invalid id, and the registry is left unchanged), then checks for a duplicate. The duplicate error message contains the conflicting id. Both checks run before any mutation, so a failed `register` leaves `map` and `order` untouched.
- `lookup` returns the exact reference passed to `register`, or `undefined` when the id is not registered.
- `list` returns a NEW array (`order.slice()`) in insertion order on every call, so mutating the returned array does not alter the registry.

---

### 10. Barrel export (`src/index.ts`)

```typescript
// Trail
export type { TrailLevel, TrailStep, TrailLeg, CodeTrail } from "./trail/types.js";
export { ALLOWED_LEVELS } from "./trail/types.js";
export type { ValidationFailure, ValidationResult } from "./trail/validate.js";
export { validateCodeTrail, extractFirstNumber } from "./trail/validate.js";
export { NO_PARTS } from "./trail/grade.js";
export type { TrailVerdict, StepResult, GradeResult, DrillDef, UserPick } from "./trail/grade.js";
export { gradeTrail } from "./trail/grade.js";

// Plugin
export type { CalcInput, CalcOutput, Invariant, CalcPluginDef, CalcPlugin, InvariantReport } from "./plugin/types.js";
export { defineCalcPlugin } from "./plugin/defineCalcPlugin.js";
// NOTE: runInvariants is NOT exported here — it lives in the test-utils entry point only

// Drill
export type { CodeTrailDef } from "./drill/types.js";
export { defineCodeTrail } from "./drill/defineCodeTrail.js";

// Table
export type { TableValue } from "./table/types.js";
export { makeTableValue } from "./table/makeTableValue.js";

// Registry
export type { RegistryEntry, PluginRegistry } from "./registry/types.js";
export { createRegistry } from "./registry/createRegistry.js";
```

---

## Data Models

### CodeTrail state-machine for validation

The per-leg validator is a minimal state machine. Each state represents "which level is valid next."

```
State S0 (initial):
  chapter    → S1_main (or S1_ch9 if extractFirstNumber(value) === 9)
  annex      → S2_annex
  index      → S2_index
  article    → S3_art90 (only if extractFirstNumber(value) === 90)
  otherwise  → FAIL

State S1_main (after chapter, chapters 1–8):
  article    → S4_after_article
  otherwise  → FAIL

State S4_after_article:
  part       → S5_after_part
  section    → S6_body
  table      → S6_body
  otherwise  → FAIL

State S5_after_part:
  section    → S6_body
  table      → S6_body
  otherwise  → FAIL

State S6_body (repeating; leg may end here):
  section    → S6_body
  table      → S6_body
  notes      → S7_terminal
  [end]      → OK

State S7_terminal (after notes; leg must end here):
  [end]      → OK
  otherwise  → FAIL

State S1_ch9 (after chapter 9):
  table      → S6_ch9
  otherwise  → FAIL

State S6_ch9 (after table in ch9):
  notes      → S7_terminal
  [end]      → OK
  otherwise  → FAIL

State S2_annex (after annex):
  table      → S6_annex
  otherwise  → FAIL

State S6_annex:
  notes      → S7_terminal
  [end]      → OK
  otherwise  → FAIL

State S3_art90 (Article 90 intro):
  section    → S6_art90
  otherwise  → FAIL

State S6_art90:
  notes      → S7_terminal
  [end]      → OK
  otherwise  → FAIL

State S2_index (after index):
  section | table → S6_index
  otherwise  → FAIL

State S6_index (repeating; leg may end here):
  section | table → S6_index
  notes      → S7_terminal
  [end]      → OK
  otherwise  → FAIL
```

### GradeResult computation

User picks are aligned to a **flattened step sequence**. Flattening: for each leg in order, append each step in order. Each pick is a `{ level, value }` object. Before alignment, when the flattened trail contains no `"part"` step, `gradeTrail` removes EVERY `"part"`-level pick from the picks array (whatever its value), so subsequent picks remain correctly index-aligned. If any removed pick's value was not `NO_PARTS`, the attempt cannot match that trail, and `stepResults` includes one synthetic `{ level: "part", verdict: "incorrect" }` entry inserted immediately after the `"article"` step (or, when the flattened sequence has no `"article"` step, immediately before the first `"section"`/`"table"` step; see algorithm step 2b, confirmed placement rule). The remaining steps are still graded on their own by index alignment. A `NO_PARTS` pick, or no part pick, adds no entry and leaves the attempt correct. When the trail has a `"part"` step, behavior is unchanged. Matching proceeds index-by-index: a pick matches its step when `level` values are equal and `value` strings are equal after trimming and lowercasing. A `level` mismatch at any index is `"incorrect"`. As a result, `stepResults` may contain one more entry than the trail has steps (the synthetic part entry) on part-less trails.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid CodeTrail passes validation

*For any* CodeTrail object whose keyword is non-empty, whose legs array is non-empty, and whose steps conform to the per-leg structural rules, `validateCodeTrail` SHALL return `{ ok: true }`. Generators include trails with index legs (`"index"` → one or more `section` and/or `table` steps, including repeated steps → optional `notes`).

**Validates: Requirements 1.1, 1.2, 1.6, 1.9, 1.10, 1.14**

---

### Property 2: Invalid CodeTrail always produces failures

*For any* CodeTrail object that violates at least one structural rule (empty keyword, empty legs, or a malformed step sequence), `validateCodeTrail` SHALL return `{ ok: false }` with a non-empty `failures` array identifying the offending field. Generators include invalid index legs: `"index"` followed by an `article` step, `"index"` followed by a `part` step, and a lone `"index"` with no following step. (`"index"` followed by a `section` and then another `section` is valid and is covered by Property 1.)

**Validates: Requirements 1.7, 1.8, 1.9, 1.14**

---

### Property 3: gradeTrail self-match (round-trip)

*For any* valid `CodeTrail` declared in a `DrillDef`'s `trails` array, constructing the user-pick array directly from that trail's flattened step values and passing them to `gradeTrail` SHALL return a `GradeResult` with `matched: true`. Generated trails include trails with index legs.

**Validates: Requirements 2.6, 2.14**

---

### Property 4: gradeTrail movedFrom discrimination

*For any* `DrillDef` whose `movedFrom` trail is structurally distinct from all entries in `trails`, constructing the user-pick array from `movedFrom`'s flattened step values and passing them to `gradeTrail` SHALL return a `GradeResult` with `matched: false` and `matchedMovedFrom: true`.

**Validates: Requirements 2.7**

---

### Property 5: gradeTrail determinism

*For any* `DrillDef` and any user-pick array, calling `gradeTrail` twice with the same arguments SHALL return `GradeResult` values that are structurally equal at every field.

**Validates: Requirements 2.12, 2.13, 4.2**

---

### Property 6: NO_PARTS equivalence

*For any* `CodeTrail` that contains no step with level `"part"`, a pick array that substitutes `NO_PARTS` at the part position and a pick array that omits that position entirely SHALL produce `GradeResult` values with identical `matched` outcomes and identical `stepResults` (neither contains a synthetic part entry).

**Validates: Requirements 2.9, 2.10, 2.15, 2.19**

---

### Property 7: defineCalcPlugin is identity

*For any* `CalcPluginDef` object, `defineCalcPlugin(def)` SHALL return a value that is the same reference as `def`.

**Validates: Requirements 3.1**

---

### Property 8: defineCodeTrail is identity

*For any* `CodeTrailDef` object, `defineCodeTrail(def)` SHALL return a value that is the same reference as `def`.

**Validates: Requirements 6.1**

---

### Property 9: makeTableValue round-trip

*For any* finite number `v` and non-empty string `s`, `makeTableValue(v, s).value` SHALL equal `v` and `makeTableValue(v, s).source` SHALL equal `s` and `makeTableValue(v, s).nfpa_checked` SHALL equal `false`.

**Validates: Requirements 5.3, 5.5**

---

### Property 10: Registry lookup round-trip

*For any* `RegistryEntry` with a unique `id`, after calling `registry.register(entry)`, `registry.lookup(entry.id)` SHALL return the identical object reference that was passed to `register`.

**Validates: Requirements 7.5, 7.9**

---

### Property 11: Registry list length invariant

*For any* sequence of `register` calls with distinct ids, `registry.list().length` SHALL equal the number of `register` calls made.

**Validates: Requirements 7.7, 7.8**

---

### Property 12: calculate determinism

*For any* `CalcPluginDef` and any input value `i`, calling `plugin.calculate(i)` twice with the same input SHALL return outputs that are recursively deeply equal.

**Validates: Requirements 4.2, 4.4**

---

### Property 13: extractFirstNumber correctness

(a) *For any* string composed entirely of ASCII digit characters representing a number N, `extractFirstNumber` SHALL return N.
(b) *For any* string containing no ASCII digit characters, `extractFirstNumber` SHALL return `null`.
(c) *For any* string containing two or more digit runs separated by at least one non-digit character, `extractFirstNumber` SHALL return the value of the first run only.

**Validates: Requirements 1.11, 1.13**

---

### Property 14: editionNote validation

*For any* string of length 1-300 used as the `editionNote` of a `CodeTrailDef`, `validateCodeTrail` SHALL report no failure with field `"editionNote"`. *For any* `editionNote` string of length 0 or over 300, `validateCodeTrail` SHALL report a failure with field `"editionNote"`.

**Validates: Requirements 6.8, 6.9, 6.10**

---

### Property 15: Extra non-NO_PARTS part pick on a part-less trail

*For any* `CodeTrail` that contains no `"part"` step, and any pick array in which every pick matches the trail's steps except for one extra `"part"`-level pick whose `value` is not `NO_PARTS`, `gradeTrail` SHALL return `matched: false`, a verdict of `"correct"` for every real step of the trail, and exactly one `StepResult` with `level: "part"`, whose verdict is `"incorrect"`.

**Validates: Requirements 2.16, 2.17, 2.18**

---

## Error Handling

| Condition | Location | Behavior |
|---|---|---|
| `validateCodeTrail` on empty `keyword` | `src/trail/validate.ts` | Returns `{ ok: false, failures: [{ field: "keyword", message: "..." }] }` |
| `validateCodeTrail` on empty `legs` | `src/trail/validate.ts` | Returns `{ ok: false, failures: [{ field: "legs", message: "..." }] }` |
| `validateCodeTrail` on malformed step sequence | `src/trail/validate.ts` | Returns `{ ok: false, failures: [...] }` for each offending step, all legs validated independently |
| `validateCodeTrail` on malformed index leg (e.g. `"index"` followed by an `article` or `part` step, or a lone `"index"` with no following `section`/`table` step) | `src/trail/validate.ts` | Returns `{ ok: false, failures: [...] }` identifying the leg index and offending step; non-throwing |
| `validateCodeTrail` on `CodeTrailDef` with invalid `editionNote` (empty or over 300 characters) | `src/trail/validate.ts` | Returns `{ ok: false, failures: [{ field: "editionNote", message: "..." }] }`; non-throwing |
| `makeTableValue` called with empty `source` | `src/table/makeTableValue.ts` | Throws `Error("makeTableValue: source must be a non-empty string")` |
| `createRegistry().register` called with an absent, non-string, or empty `id` | `src/registry/createRegistry.ts` | Throws `Error("PluginRegistry: entry id must be a non-empty string")` (indicates an invalid id); registry unchanged |
| `createRegistry().register` called with duplicate `id` | `src/registry/createRegistry.ts` | Throws `Error('PluginRegistry: duplicate id "..."')`; message contains the conflicting id; registry unchanged |
| `runInvariants` — `calculate` throws | `src-test-utils/runInvariants.ts` | Records `status: "fail"` with `counterexample` describing the throwing input; continues with remaining invariants |
| `runInvariants` — no arbitrary supplied for an invariant `id` | `src-test-utils/runInvariants.ts` | Records `status: "fail"` with `counterexample` describing the missing arbitrary; continues |

All errors from `validateCodeTrail` are non-throwing (returned as structured values). All errors from `gradeTrail` are non-throwing. Throwing errors are reserved for programmer-error situations (`makeTableValue`, `register`).

---

## Testing Strategy

### Framework and configuration

- **Vitest** for all tests (`vitest --run` for single execution in CI).
- **fast-check** for property-based tests, imported only inside `*.test.ts` files via the `@sentinel/skeleton-core/test-utils` entry point or directly from the `fast-check` package.
- Minimum **100 iterations** per property test.
- Each property test is tagged with a comment in the format:
  `// Feature: skeleton-core, Property N: <property text>`

### Test file locations

```
packages/skeleton-core/
└── src/
    ├── trail/
    │   ├── validate.test.ts      # Properties 1, 2, 14 + edge cases (generators include index legs)
    │   └── grade.test.ts         # Properties 3, 4, 5, 6, 15 + unit examples (incl. part-less trail with extra part pick)
    ├── plugin/
    │   └── defineCalcPlugin.test.ts  # Property 7 + runInvariants unit tests
    ├── drill/
    │   └── defineCodeTrail.test.ts   # Property 8
    ├── table/
    │   └── makeTableValue.test.ts    # Property 9 + edge cases (empty source)
    └── registry/
        └── createRegistry.test.ts    # Properties 10, 11 + duplicate-id unit test
```

### Dual testing approach

**Property-based tests** cover:
- Properties 1–15 as universally quantified assertions across generated inputs. Trail generators for Properties 1, 2, and 3 include index legs (valid, including repeated `section`/`table` steps, and invalid: article, part, or lone `index`); Property 14 generates `editionNote` strings of length 0, 1-300, and over 300.
- Each property test references its property number in a comment.

**Unit / example tests** cover:
- `NO_PARTS` exported value equals `"NONE"` (Req 2.1).
- Part-less trail with an extra `"part"` pick whose value is not `NO_PARTS` (Req 2.16–2.18): a main-chapter trail (chapter → article → section) yields `matched: false`, all real steps `"correct"`, and one synthetic `{ level: "part", verdict: "incorrect" }` entry immediately after the article entry.
- Same scenario on a trail with no article step (an index leg and a Chapter 9 leg): the synthetic entry sits directly before the first `section`/`table` entry (Req 2.17, confirmed placement rule in algorithm step 2b).
- Same scenario on an Article 90 intro leg (starts with an article step): the primary rule applies and the synthetic entry sits directly after the article entry.
- Same scenario on a multi-leg trail: exactly one synthetic part entry is produced, not one per leg.
- Part-less trail with an extra `NO_PARTS` pick, and with no part pick: no synthetic entry, `matched: true` (Req 2.17, 2.19).
- Trail that has a `"part"` step with a `NO_PARTS` pick: the part step is `"incorrect"` and no synthetic entry is added (Req 2.11).
- `ALLOWED_LEVELS` exact tuple value (Req 1.2).
- `makeTableValue` throws on empty source (Req 5.4).
- `register` throws on an absent, non-string, or empty id (Req 7.3).
- `register` throws on duplicate id, with the id in the message (Req 7.4).
- `runInvariants` with always-false invariant returns `status: "fail"` with non-empty `counterexample` (Req 3.8).
- `runInvariants` with identity `calculate` and output-equals-input invariant returns all `status: "pass"` (Req 3.10).
- `runInvariants` with throwing `calculate` records failure and continues (Req 3.9).

### Structural / build checks

- `tsc --noEmit` on the main `tsconfig.json` verifies no forbidden imports in `src/`.
- A simple grep or static-analysis check in CI verifies `dist/index.js` and all files it imports contain no reference to the string `"fast-check"` (Req 8.6, 3.5a).
- `tsc --noEmit` on a minimal consumer `tsconfig` verifies compile errors when required fields are missing from `CalcPluginDef` and `CodeTrailDef` (Reqs 3.3, 6.4).

### PBT library

Property-based tests use **fast-check** (already in devDependencies). Arbitraries are defined inline in each test file. The `runInvariants` test-utils entry point wraps fast-check for use by consuming app test files.
