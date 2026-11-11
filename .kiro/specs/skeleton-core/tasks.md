# Implementation Plan: skeleton-core

## Overview

Build the `packages/skeleton-core` pure-TypeScript library from scratch, starting with the repository-root `package.json` that declares the npm workspace (`packages/*` only; each app folder is added to the workspaces list when that app is created). The package exports the CodeTrail type system and grader (including the `"index"` trail level), the `defineCalcPlugin` and `defineCodeTrail` extension contracts (with the optional `editionNote` on drill definitions), the `TableValue` data shape, and the `createRegistry` factory. `fast-check` is a devDependency only — it is imported solely inside `src-test-utils/` and `*.test.ts` files. The build uses `tsc` only with `"module": "NodeNext"` and two entry points: `"."` and `"./test-utils"`.

## Tasks

- [x] 1. Root workspace package.json
  - [x] 1.1 Create `package.json` at the repository root
    - Set `"private": true` and `"workspaces": ["packages/*"]` only
    - Do NOT list `midnight-code-hunt` or `dead-circuit-check` in `workspaces`; each app is added when it is created
    - _Requirements: 8.7_

- [x] 2. Scaffold the package
  - [x] 2.1 Create the `packages/skeleton-core/` directory tree
    - Create `src/trail/`, `src/plugin/`, `src/drill/`, `src/table/`, `src/registry/`, and `src-test-utils/` directories with `.gitkeep` placeholders (remove once files are added)
    - _Requirements: 8.1, 8.4_

  - [x] 2.2 Write `packages/skeleton-core/package.json`
    - Set `"name": "@sentinel/skeleton-core"`, `"type": "module"`
    - Add `exports` field with two conditions: `"."` pointing to `dist/index.js` / `dist/index.d.ts` and `"./test-utils"` pointing to `dist-test-utils/runInvariants.js` / `dist-test-utils/runInvariants.d.ts`
    - List `vitest` and `fast-check` in `devDependencies` only — no runtime dependencies
    - Add `"scripts"`: `"build"`, `"build:test-utils"`, `"typecheck"`, `"test"` (using `vitest --run`)
    - _Requirements: 3.6, 8.3, 8.6_

  - [x] 2.3 Write `packages/skeleton-core/tsconfig.json` and `tsconfig.test-utils.json`
    - Main config: `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"declaration": true`, `"declarationMap": true`, `"outDir": "dist"`, `"rootDir": "src"`
    - Test-utils config: same compiler options, `"rootDir": "src-test-utils"`, `"outDir": "dist-test-utils"`, references `src/` for type imports
    - _Requirements: 8.4_

- [x] 3. Trail types
  - [x] 3.1 Implement `src/trail/types.ts`
    - Export `TrailLevel` as the union `"chapter" | "article" | "part" | "section" | "table" | "notes" | "annex" | "index"`
    - Export `ALLOWED_LEVELS` as `as const satisfies readonly TrailLevel[]` tuple in the canonical order, with `"index"` appended last: `["chapter", "article", "part", "section", "table", "notes", "annex", "index"]`
    - Export `TrailStep` as `{ readonly level: TrailLevel; readonly value: string }`
    - Export `TrailLeg` as `readonly [TrailStep, ...TrailStep[]]` (non-empty tuple)
    - Export `CodeTrail` as `{ readonly keyword: string; readonly legs: readonly [TrailLeg, ...TrailLeg[]] }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 4. `extractFirstNumber` and `validateCodeTrail`
  - [x] 4.1 Implement `extractFirstNumber` in `src/trail/validate.ts`
    - Export `extractFirstNumber(s: string): number | null` — returns the numeric value of the first contiguous ASCII digit run, or `null` if none
    - _Requirements: 1.11_

  - [x] 4.2 Write property tests for `extractFirstNumber` in `src/trail/validate.test.ts`
    - **Property 13a: digits-only string returns its numeric value**
    - **Property 13b: no-digit string returns null**
    - **Property 13c: first-run-only for multi-run strings**
    - **Validates: Requirements 1.11, 1.13**

  - [x] 4.3 Implement `validateCodeTrail` and its exported types in `src/trail/validate.ts`
    - Export `ValidationFailure` (`{ field: string; message: string }`) and `ValidationResult` (`{ ok: true } | { ok: false; failures: ValidationFailure[] }`)
    - Implement the per-leg state machine (S0 → S1_main / S1_ch9 / S2_annex / S2_index / S3_art90 and their substates) exactly as specified in the design
    - Add the index start state: `"index"` → one or more `"section"` and/or `"table"` steps (repeats allowed; S6_index loops) → optional `"notes"`; reject `"chapter"`, `"article"`, or `"part"` steps and an `"index"` step with no following `"section"` / `"table"` step
    - Unknown first step is a validation failure; its message lists the valid starts: chapter, annex, index, and article (Article 90 only). A leg that starts with `"index"` is never an unknown first step; it is routed to S2_index
    - Reject empty `keyword`, empty `legs`, and any step sequence that violates the state machine
    - Accept a `CodeTrail` or `CodeTrailDef` (use a type-only import of `CodeTrailDef`); for the latter validate every trail in `trails` plus the optional `movedFrom`, collecting all failures into one result
    - When given a `CodeTrailDef`, check that `editionNote` (if present) is 1-300 characters; otherwise report a failure with field `"editionNote"`
    - Use `extractFirstNumber` to identify chapter 9, article 90, etc.
    - _Requirements: 1.6, 1.7, 1.8, 1.9, 1.10, 1.12, 6.5, 6.6, 6.9_

  - [x] 4.4 Write property tests for `validateCodeTrail` in `src/trail/validate.test.ts`
    - **Property 1: valid CodeTrail passes validation** — generators include valid index legs (`"index"` → one or more `section` and/or `table` steps, including repeated steps → optional `notes`)
    - **Property 2: invalid CodeTrail always produces failures** — generators include invalid index legs: `"index"` followed by an `article` step, `"index"` followed by a `part` step, and a lone `"index"` with no following step; `"index"` followed by a `section` then another `section` is valid
    - **Validates: Requirements 1.6, 1.7, 1.8, 1.9, 1.10, 1.14**
    - Also add unit tests: empty keyword fails, empty legs fails, each path kind (ch1–8, ch9, annex, article 90, index) produces a valid result with a correctly formed leg; malformed step sequences produce `ok: false`; unknown first step fails with a message listing the valid starts

- [x] 5. `gradeTrail`
  - [x] 5.1 Implement `src/trail/grade.ts`
    - Export `NO_PARTS` constant (`"NONE" as const`)
    - Export `TrailVerdict`, `StepResult`, `GradeResult`, `DrillDef`, and `UserPick` (`{ readonly level: TrailLevel; readonly value: string }`) types
    - Export `gradeTrail(drill: DrillDef, picks: readonly UserPick[]): GradeResult` following the flatten → strip-NO_PARTS → align-by-index → best-match algorithm from the design
    - Ensure level mismatches are always `"incorrect"`, unmatched positions are `"unanswered"`, and the function reads/writes no module-level mutable state
    - Index legs flatten like any other leg (`index`, then one or more `section` / `table` steps, then optional `notes`) with no special-casing
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.16_

  - [x] 5.2 Write property tests for `gradeTrail` in `src/trail/grade.test.ts`
    - **Property 3: gradeTrail self-match (round-trip)** — generated trails include trails with index legs
    - **Property 4: gradeTrail movedFrom discrimination**
    - **Property 5: gradeTrail determinism**
    - **Property 6: NO_PARTS equivalence**
    - **Validates: Requirements 2.6, 2.7, 2.9, 2.10, 2.12, 2.13, 2.14, 2.15**
    - Also add unit tests: NO_PARTS pick on part-less trail is correct (Req 2.9); omitting part pick on part-less trail is correct (Req 2.10); NO_PARTS on part-present trail is incorrect (Req 2.11); `NO_PARTS === "NONE"` (Req 2.1)

- [x] 6. Checkpoint — trail layer
  - Ensure all tests pass for `src/trail/`. Run `vitest --run` scoped to `src/trail/`. Ask the user if any questions arise before continuing.

- [x] 7. CalcPlugin types and `defineCalcPlugin`
  - [x] 7.1 Implement `src/plugin/types.ts`
    - Export `CalcInput`, `CalcOutput`, `Invariant<I, O>`, `InvariantReport`, `CalcPluginDef<I, O>`, and `CalcPlugin<I, O>` exactly as specified in the design
    - `Invariant` MUST NOT include any `fc.Arbitrary` field
    - `CalcPluginDef.trails` is typed as `(input: I) => readonly [CodeTrail, ...CodeTrail[]]`
    - `CalcPluginDef.invariants` is a non-empty tuple type
    - _Requirements: 3.2, 3.3, 3.4, 3.7, 4.1, 4.3_

  - [x] 7.2 Implement `src/plugin/defineCalcPlugin.ts`
    - Export `defineCalcPlugin<I, O>(def: CalcPluginDef<I, O>): CalcPluginDef<I, O>` as a pure identity function
    - _Requirements: 3.1_

  - [x] 7.3 Write property test for `defineCalcPlugin` in `src/plugin/defineCalcPlugin.test.ts`
    - **Property 7: defineCalcPlugin is identity (same object reference)**
    - **Validates: Requirements 3.1**
    - Also add a unit test confirming the TypeScript compiler errors when a required field is omitted (use `@ts-expect-error` comments) (Req 3.3)

- [x] 8. `runInvariants`
  - [x] 8.1 Implement `src-test-utils/runInvariants.ts`
    - Import `fast-check` here and **only** here within the package
    - Export `runInvariants<I, O>(plugin, arbitraries, options?)` following the design's implementation exactly: map each invariant, look up its arbitrary, run `fc.check(fc.property(...))`, catch throws from `calculate`, return `InvariantReport[]` without throwing; default `numRuns` is 100
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_

  - [x] 8.2 Write tests for `runInvariants` in `src/plugin/runInvariants.test.ts`
    - Test: always-false invariant returns `status: "fail"` with non-empty `counterexample` (Req 3.9)
    - Test: identity `calculate` with output-equals-input invariant returns all `status: "pass"` with `counterexample: null` (Reqs 3.8, 3.11)
    - Test: throwing `calculate` records `status: "fail"` and continues remaining invariants (Req 3.10)
    - Test: missing arbitrary records `status: "fail"` with descriptive `counterexample`
    - **Property 12: calculate determinism** — for any `CalcPluginDef` and input, calling `calculate` twice returns recursively deeply equal outputs
    - **Validates: Requirements 3.8, 3.9, 3.10, 3.11, 4.2, 4.4**

- [x] 9. `TableValue` and `makeTableValue`
  - [x] 9.1 Implement `src/table/types.ts` and `src/table/makeTableValue.ts`
    - Export `TableValue` type with `value: number`, `source: string`, `nfpa_checked: boolean`
    - Export `makeTableValue(value, source, nfpa_checked?)` — throw `Error` on empty `source`, default `nfpa_checked` to `false`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [x] 9.2 Write property test for `makeTableValue` in `src/table/makeTableValue.test.ts`
    - **Property 9: makeTableValue round-trip**
    - **Validates: Requirements 5.3, 5.5**
    - Also add unit tests: `makeTableValue("", …)` throws (Req 5.4); `nfpa_checked` defaults to `false` (Req 5.1)

- [x] 10. `defineCodeTrail`
  - [x] 10.1 Implement `src/drill/types.ts` and `src/drill/defineCodeTrail.ts`
    - Export `CodeTrailDef` type with `id`, `label`, `trails`, `hint`, optional `movedFrom`, optional `editionNote` (string of 1-300 characters, shown by the UI alongside `matchedMovedFrom` feedback), optional `tableValues: ReadonlyArray<TableValue>`
    - `gradeTrail` and `GradeResult` are unchanged by `editionNote`
    - Export `defineCodeTrail(def: CodeTrailDef): CodeTrailDef` as a pure identity function
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7, 6.8_

  - [x] 10.2 Write property test for `defineCodeTrail` in `src/drill/defineCodeTrail.test.ts`
    - **Property 8: defineCodeTrail is identity (same object reference)**
    - **Validates: Requirements 6.1**
    - Also add a unit test confirming the TypeScript compiler errors when a required field is omitted (Req 6.4)

  - [x] 10.3 Write property test for `editionNote` validation in `src/trail/validate.test.ts`
    - **Property 14: editionNote validation** — generate `editionNote` strings of length 0, 1-300, and over 300 on an otherwise valid `CodeTrailDef`; lengths 1-300 produce no failure with field `"editionNote"`, lengths 0 and over 300 produce a failure with field `"editionNote"`
    - **Validates: Requirements 6.8, 6.9, 6.10**

- [x] 11. `createRegistry`
  - [x] 11.1 Implement `src/registry/types.ts` and `src/registry/createRegistry.ts`
    - Export `RegistryEntry` as `CalcPlugin | CodeTrailDef`
    - Export `PluginRegistry` interface with `register`, `lookup`, and `list`
    - Implement `createRegistry()` using an internal `Map` + insertion-order array; throw `Error` on duplicate `id`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 11.2 Write property tests for `createRegistry` in `src/registry/createRegistry.test.ts`
    - **Property 10: Registry lookup round-trip**
    - **Property 11: Registry list length invariant**
    - **Validates: Requirements 7.4, 7.5, 7.6, 7.7**
    - Also add unit test: `register` throws on duplicate `id` (Req 7.3)

- [x] 12. Barrel export and package entry points
  - [x] 12.1 Implement `src/index.ts`
    - Re-export all public types and values from `trail/types`, `trail/validate`, `trail/grade`, `plugin/types`, `plugin/defineCalcPlugin`, `drill/types`, `drill/defineCodeTrail`, `table/types`, `table/makeTableValue`, `registry/types`, `registry/createRegistry`
    - Do NOT export `runInvariants` — it must remain behind the `./test-utils` entry point only
    - _Requirements: 3.5, 3.6, 8.1, 8.2, 8.5_

  - [x] 12.2 Verify the `./test-utils` entry point in `package.json` correctly resolves `src-test-utils/runInvariants.ts`
    - Confirm `runInvariants` is importable as `@sentinel/skeleton-core/test-utils` from a test file
    - _Requirements: 3.5, 3.6, 8.6_

- [x] 13. Checkpoint — full package
  - Ensure `vitest --run` passes for all test files. Ask the user if any questions arise before continuing.

- [x] 14. Build verification
  - [x] 14.1 Run `tsc --noEmit` on the main `tsconfig.json`
    - Fix any type errors revealed; confirm no `fast-check` import path appears anywhere under `src/`
    - _Requirements: 8.4, 8.6_

  - [x] 14.2 Run `tsc --noEmit` on `tsconfig.test-utils.json`
    - Confirm `src-test-utils/runInvariants.ts` compiles cleanly against the main types
    - _Requirements: 3.6, 8.4_

  - [x] 14.3 Add a CI-friendly fast-check boundary check script
    - Write a small Node script (or `grep`-based npm script) that scans `dist/index.js` and all files it imports for the string `"fast-check"`; exits with non-zero status if found
    - _Requirements: 3.6, 8.6_

- [x] 15. Final checkpoint
  - Ensure all tests pass and all build steps succeed. Ask the user if any questions arise before concluding.

## Notes

- Property test sub-tasks are required and reference the property numbers from the design's "Correctness Properties" section.
- `runInvariants` (task 8.1) is the **only** file in the package that may import `fast-check`. All other source files under `src/` are forbidden from importing it.
- Table data files and app-specific code must never be added to this package (Req 8.5).
- NEC table values used in tests or examples must use `makeTableValue` with `nfpa_checked: false` and a named source string — never hardcoded inline.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["4.1", "9.1"] },
    { "id": 4, "tasks": ["4.2", "4.3"] },
    { "id": 5, "tasks": ["4.4", "5.1", "10.1"] },
    { "id": 6, "tasks": ["5.2", "7.1", "10.3"] },
    { "id": 7, "tasks": ["7.2", "9.2"] },
    { "id": 8, "tasks": ["7.3", "8.1", "10.2", "11.1"] },
    { "id": 9, "tasks": ["8.2", "11.2"] },
    { "id": 10, "tasks": ["12.1"] },
    { "id": 11, "tasks": ["12.2"] },
    { "id": 12, "tasks": ["14.1", "14.2"] },
    { "id": 13, "tasks": ["14.3"] }
  ]
}
```
