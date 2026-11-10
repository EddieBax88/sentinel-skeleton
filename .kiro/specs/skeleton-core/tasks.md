# Implementation Plan: skeleton-core

## Overview

Build the `packages/skeleton-core` pure-TypeScript library from scratch. The package exports the CodeTrail type system and grader, the `defineCalcPlugin` and `defineCodeTrail` extension contracts, the `TableValue` data shape, and the `createRegistry` factory. `fast-check` is a devDependency only — it is imported solely inside `src-test-utils/` and `*.test.ts` files. The build uses `tsc` only with `"module": "NodeNext"` and two entry points: `"."` and `"./test-utils"`.

## Tasks

- [ ] 1. Scaffold the package
  - [ ] 1.1 Create the `packages/skeleton-core/` directory tree
    - Create `src/trail/`, `src/plugin/`, `src/drill/`, `src/table/`, `src/registry/`, and `src-test-utils/` directories with `.gitkeep` placeholders (remove once files are added)
    - _Requirements: 8.1, 8.4_

  - [ ] 1.2 Write `packages/skeleton-core/package.json`
    - Set `"name": "@sentinel/skeleton-core"`, `"type": "module"`
    - Add `exports` field with two conditions: `"."` pointing to `dist/index.js` / `dist/index.d.ts` and `"./test-utils"` pointing to `dist-test-utils/runInvariants.js` / `dist-test-utils/runInvariants.d.ts`
    - List `vitest` and `fast-check` in `devDependencies` only — no runtime dependencies
    - Add `"scripts"`: `"build"`, `"build:test-utils"`, `"typecheck"`, `"test"` (using `vitest --run`)
    - _Requirements: 3.6, 8.3, 8.6_

  - [ ] 1.3 Write `packages/skeleton-core/tsconfig.json` and `tsconfig.test-utils.json`
    - Main config: `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"declaration": true`, `"declarationMap": true`, `"outDir": "dist"`, `"rootDir": "src"`
    - Test-utils config: same compiler options, `"rootDir": "src-test-utils"`, `"outDir": "dist-test-utils"`, references `src/` for type imports
    - _Requirements: 8.4_

- [ ] 2. Trail types
  - [ ] 2.1 Implement `src/trail/types.ts`
    - Export `TrailLevel` as the union `"chapter" | "article" | "part" | "section" | "table" | "notes" | "annex"`
    - Export `ALLOWED_LEVELS` as `as const satisfies readonly TrailLevel[]` tuple in the canonical order
    - Export `TrailStep` as `{ readonly level: TrailLevel; readonly value: string }`
    - Export `TrailLeg` as `readonly [TrailStep, ...TrailStep[]]` (non-empty tuple)
    - Export `CodeTrail` as `{ readonly keyword: string; readonly legs: readonly [TrailLeg, ...TrailLeg[]] }`
    - Export `UserPick` as `{ readonly level: TrailLevel; readonly value: string }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 3. `extractFirstNumber` and `validateCodeTrail`
  - [ ] 3.1 Implement `extractFirstNumber` in `src/trail/validate.ts`
    - Export `extractFirstNumber(s: string): number | null` — returns the numeric value of the first contiguous ASCII digit run, or `null` if none
    - _Requirements: 1.11, 1.12_

  - [ ]* 3.2 Write property tests for `extractFirstNumber` in `src/trail/validate.test.ts`
    - **Property 13a: digits-only string returns its numeric value**
    - **Property 13b: no-digit string returns null**
    - **Property 13c: first-run-only for multi-run strings**
    - **Validates: Requirements 1.11, 1.13**

  - [ ] 3.3 Implement `validateCodeTrail` and its exported types in `src/trail/validate.ts`
    - Export `ValidationFailure` (`{ field: string; message: string }`) and `ValidationResult` (`{ ok: true } | { ok: false; failures: ValidationFailure[] }`)
    - Implement the per-leg state machine (S0 → S1_main / S1_ch9 / S2_annex / S3_art90 and their substates) exactly as specified in the design
    - Reject empty `keyword`, empty `legs`, and any step sequence that violates the state machine
    - Accept a `CodeTrail` or `CodeTrailDef` (validate `trails` array + optional `movedFrom` for the latter)
    - Use `extractFirstNumber` to identify chapter 9, article 90, etc.
    - _Requirements: 1.6, 1.7, 1.8, 1.9, 1.10, 1.12, 6.5, 6.6_

  - [ ]* 3.4 Write property tests for `validateCodeTrail` in `src/trail/validate.test.ts`
    - **Property 1: valid CodeTrail passes validation**
    - **Property 2: invalid CodeTrail always produces failures**
    - **Validates: Requirements 1.6, 1.7, 1.8, 1.9**
    - Also add unit tests: empty keyword fails, empty legs fails, each path kind (ch1–8, ch9, annex, article 90) produces a valid result with a correctly formed leg; malformed step sequences produce `ok: false`

- [ ] 4. `gradeTrail`
  - [ ] 4.1 Implement `src/trail/grade.ts`
    - Export `NO_PARTS` constant (`"NONE" as const`)
    - Export `TrailVerdict`, `StepResult`, `GradeResult`, and `DrillDef` types
    - Export `gradeTrail(drill: DrillDef, picks: readonly UserPick[]): GradeResult` following the flatten → strip-NO_PARTS → align-by-index → best-match algorithm from the design
    - Ensure level mismatches are always `"incorrect"`, unmatched positions are `"unanswered"`, and the function reads/writes no module-level mutable state
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.16_

  - [ ]* 4.2 Write property tests for `gradeTrail` in `src/trail/grade.test.ts`
    - **Property 3: gradeTrail self-match (round-trip)**
    - **Property 4: gradeTrail movedFrom discrimination**
    - **Property 5: gradeTrail determinism**
    - **Property 6: NO_PARTS equivalence**
    - **Validates: Requirements 2.6, 2.7, 2.9, 2.10, 2.12, 2.13, 2.14, 2.15**
    - Also add unit tests: NO_PARTS pick on part-less trail is correct (Req 2.9); omitting part pick on part-less trail is correct (Req 2.10); NO_PARTS on part-present trail is incorrect (Req 2.11); `NO_PARTS === "NONE"` (Req 2.1)

- [ ] 5. Checkpoint — trail layer
  - Ensure all tests pass for `src/trail/`. Run `vitest --run` scoped to `src/trail/`. Ask the user if any questions arise before continuing.

- [ ] 6. CalcPlugin types and `defineCalcPlugin`
  - [ ] 6.1 Implement `src/plugin/types.ts`
    - Export `CalcInput`, `CalcOutput`, `Invariant<I, O>`, `InvariantReport`, `CalcPluginDef<I, O>`, and `CalcPlugin<I, O>` exactly as specified in the design
    - `Invariant` MUST NOT include any `fc.Arbitrary` field
    - `CalcPluginDef.trails` is typed as `(input: I) => readonly [CodeTrail, ...CodeTrail[]]`
    - `CalcPluginDef.invariants` is a non-empty tuple type
    - _Requirements: 3.2, 3.3, 3.4, 4.1, 4.3_

  - [ ] 6.2 Implement `src/plugin/defineCalcPlugin.ts`
    - Export `defineCalcPlugin<I, O>(def: CalcPluginDef<I, O>): CalcPluginDef<I, O>` as a pure identity function
    - _Requirements: 3.1_

  - [ ]* 6.3 Write property test for `defineCalcPlugin` in `src/plugin/defineCalcPlugin.test.ts`
    - **Property 7: defineCalcPlugin is identity (same object reference)**
    - **Validates: Requirements 3.1**
    - Also add a unit test confirming the TypeScript compiler errors when a required field is omitted (use `@ts-expect-error` comments)

- [ ] 7. `runInvariants`
  - [ ] 7.1 Implement `src-test-utils/runInvariants.ts`
    - Import `fast-check` here and **only** here within the package
    - Export `runInvariants<I, O>(plugin, arbitraries, options?)` following the design's implementation exactly: map each invariant, look up its arbitrary, run `fc.check(fc.property(...))`, catch throws from `calculate`, return `InvariantReport[]` without throwing
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_

  - [ ]* 7.2 Write unit tests for `runInvariants` in `src/plugin/defineCalcPlugin.test.ts` (or a sibling `runInvariants.test.ts`)
    - Test: always-false invariant returns `status: "fail"` with non-empty `counterexample` (Req 3.8)
    - Test: identity `calculate` with output-equals-input invariant returns all `status: "pass"` (Req 3.11)
    - Test: throwing `calculate` records `status: "fail"` and continues remaining invariants (Req 3.10)
    - Test: missing arbitrary records `status: "fail"` with descriptive `counterexample`
    - **Property 12: calculate determinism** — for any `CalcPluginDef` and input, calling `calculate` twice returns recursively deeply equal outputs
    - **Validates: Requirements 3.7, 3.8, 3.9, 3.10, 3.11, 4.2, 4.4**

- [ ] 8. `TableValue` and `makeTableValue`
  - [ ] 8.1 Implement `src/table/types.ts` and `src/table/makeTableValue.ts`
    - Export `TableValue` type with `value: number`, `source: string`, `nfpa_checked: boolean`
    - Export `makeTableValue(value, source, nfpa_checked?)` — throw `Error` on empty `source`, default `nfpa_checked` to `false`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [ ]* 8.2 Write property test for `makeTableValue` in `src/table/makeTableValue.test.ts`
    - **Property 9: makeTableValue round-trip**
    - **Validates: Requirements 5.3, 5.5**
    - Also add unit tests: `makeTableValue("", …)` throws (Req 5.4); `nfpa_checked` defaults to `false` (Req 5.1)

- [ ] 9. `defineCodeTrail`
  - [ ] 9.1 Implement `src/drill/types.ts` and `src/drill/defineCodeTrail.ts`
    - Export `CodeTrailDef` type with `id`, `label`, `trails`, `hint`, optional `movedFrom`, optional `tableValues: ReadonlyArray<TableValue>`
    - Export `defineCodeTrail(def: CodeTrailDef): CodeTrailDef` as a pure identity function
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7_

  - [ ]* 9.2 Write property test for `defineCodeTrail` in `src/drill/defineCodeTrail.test.ts`
    - **Property 8: defineCodeTrail is identity (same object reference)**
    - **Validates: Requirements 6.1**
    - Also add a unit test confirming the TypeScript compiler errors when a required field is omitted

- [ ] 10. `createRegistry`
  - [ ] 10.1 Implement `src/registry/types.ts` and `src/registry/createRegistry.ts`
    - Export `RegistryEntry` as `CalcPlugin | CodeTrailDef`
    - Export `PluginRegistry` interface with `register`, `lookup`, and `list`
    - Implement `createRegistry()` using an internal `Map` + insertion-order array; throw `Error` on duplicate `id`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 10.2 Write property tests for `createRegistry` in `src/registry/createRegistry.test.ts`
    - **Property 10: Registry lookup round-trip**
    - **Property 11: Registry list length invariant**
    - **Validates: Requirements 7.4, 7.5, 7.6, 7.7**
    - Also add unit test: `register` throws on duplicate `id` (Req 7.3)

- [ ] 11. Barrel export and package entry points
  - [ ] 11.1 Implement `src/index.ts`
    - Re-export all public types and values from `trail/types`, `trail/validate`, `trail/grade`, `plugin/types`, `plugin/defineCalcPlugin`, `drill/types`, `drill/defineCodeTrail`, `table/types`, `table/makeTableValue`, `registry/types`, `registry/createRegistry`
    - Do NOT export `runInvariants` — it must remain behind the `./test-utils` entry point only
    - _Requirements: 3.6, 8.1, 8.2, 8.5_

  - [ ] 11.2 Verify the `./test-utils` entry point in `package.json` correctly resolves `src-test-utils/runInvariants.ts`
    - Confirm `runInvariants` is importable as `@sentinel/skeleton-core/test-utils` from a test file
    - _Requirements: 3.5, 3.6, 8.6_

- [ ] 12. Checkpoint — full package
  - Ensure `vitest --run` passes for all test files. Ask the user if any questions arise before continuing.

- [ ] 13. Build verification
  - [ ] 13.1 Run `tsc --noEmit` on the main `tsconfig.json`
    - Fix any type errors revealed; confirm no `fast-check` import path appears anywhere under `src/`
    - _Requirements: 8.4, 8.6_

  - [ ] 13.2 Run `tsc --noEmit` on `tsconfig.test-utils.json`
    - Confirm `src-test-utils/runInvariants.ts` compiles cleanly against the main types
    - _Requirements: 3.6, 8.4_

  - [ ] 13.3 Add a CI-friendly fast-check boundary check script
    - Write a small Node script (or `grep`-based npm script) that scans `dist/index.js` and all files it imports for the string `"fast-check"`; exits with non-zero status if found
    - _Requirements: 8.6, 3.6_

- [ ] 14. Final checkpoint
  - Ensure all tests pass and all build steps succeed. Ask the user if any questions arise before concluding.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP, but each one validates a correctness property or requirement acceptance criterion.
- Property test sub-tasks reference the property numbers from the design's "Correctness Properties" section.
- `runInvariants` (task 7.1) is the **only** file in the package that may import `fast-check`. All other source files under `src/` are forbidden from importing it.
- Table data files and app-specific code must never be added to this package (Req 8.5).
- NEC table values used in tests or examples must use `makeTableValue` with `nfpa_checked: false` and a named source string — never hardcoded inline.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1", "8.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "4.1", "9.1"] },
    { "id": 5, "tasks": ["4.2", "6.1"] },
    { "id": 6, "tasks": ["6.2", "8.2"] },
    { "id": 7, "tasks": ["6.3", "7.1", "9.2", "10.1"] },
    { "id": 8, "tasks": ["7.2", "10.2"] },
    { "id": 9, "tasks": ["11.1"] },
    { "id": 10, "tasks": ["11.2"] },
    { "id": 11, "tasks": ["13.1", "13.2"] },
    { "id": 12, "tasks": ["13.3"] }
  ]
}
```
