# Requirements Document

## Introduction

`packages/skeleton-core` is the shared engine that powers both the Midnight Code Hunt and Dead Circuit Check applications. It contains no app-specific code and no NEC table data. It exports three things: the `CodeTrail` type system and trail-grading logic, the `defineCalcPlugin` contract for field calculators, and the `defineCodeTrail` contract for drill packs. Every value taken from an NEC table is expressed through the `TableValue` data shape, which carries a `source` field and an `nfpa_checked` flag so the founder can audit each entry before publishing.

## Glossary

- **Core**: The `packages/skeleton-core` package — shared engine and extension contracts only.
- **CodeTrail**: A keyword plus one or more legs that traces a path through the NEC code book to an answer. Each leg is an ordered, non-empty list of `{ level, value }` steps. Allowed levels: `chapter`, `article`, `part`, `section`, `table`, `notes`, `annex`, `index`. A trail may have more than one leg when a section cross-references another location in the book.
- **TrailGrader**: The Core module that evaluates a user's step-by-step picks against one or more valid `CodeTrail` values declared by a drill and returns a graded result.
- **CalcPlugin**: A calculator module that conforms to the `defineCalcPlugin` contract.
- **CalcInput**: The typed input descriptor declared by a `CalcPlugin`.
- **CalcOutput**: The typed output descriptor declared by a `CalcPlugin`.
- **Invariant**: A named check declared by a `CalcPlugin`. It carries an `id`, a `description`, and a pure `check: (input, output) => boolean`. The fast-check arbitrary that drives it is supplied by the test file, not stored in the plugin.
- **TrailLeg**: An ordered, non-empty array of `{ level, value }` steps within a `CodeTrail`.
- **TrailStep**: A single `{ level: TrailLevel; value: string }` object within a `TrailLeg`.
- **TrailLevel**: One of the string literals `"chapter" | "article" | "part" | "section" | "table" | "notes" | "annex" | "index"`.
- **ALLOWED_LEVELS**: The exported readonly tuple of all valid `TrailLevel` values, replacing the former `TRAIL_STEPS` constant.
- **NO_PARTS**: The exported string constant `"NONE"` used by a user to indicate they believe a trail has no part step.
- **movedFrom**: An optional `CodeTrail` on a `CodeTrailDef` recording where the same answer was located in the 2023 NEC edition.
- **CodeTrailDef**: A drill-pack module that conforms to the `defineCodeTrail` contract.
- **TableValue**: The data shape used to hold any value sourced from an NEC table. Contains the numeric value, a `source` string naming the table, and an `nfpa_checked` boolean flag.
- **Plugin Registry**: The runtime map that holds all registered `CalcPlugin` and `CodeTrailDef` instances keyed by their declared `id`.

---

## Requirements

### Requirement 1: CodeTrail Type and Structure

**User Story:** As a developer building either app, I want a single canonical type that models the NEC Navigation Method path through the code book, so that both apps and all calculators describe answers the same way regardless of which chapters or levels a particular answer passes through.

#### Acceptance Criteria

1. THE Core SHALL export a `TrailLevel` type defined as the union `"chapter" | "article" | "part" | "section" | "table" | "notes" | "annex" | "index"`.
2. THE Core SHALL export an `ALLOWED_LEVELS` constant typed as a `readonly` tuple listing every `TrailLevel` value in the order: `["chapter", "article", "part", "section", "table", "notes", "annex", "index"]`, such that the TypeScript compiler rejects any mutation or reordering of its elements.
3. THE Core SHALL export a `TrailStep` type defined as `{ level: TrailLevel; value: string }` where `value` is a non-empty string of 1–200 characters.
4. THE Core SHALL export a `TrailLeg` type defined as a `readonly` non-empty array of `TrailStep` values.
5. THE Core SHALL export a `CodeTrail` type defined as `{ keyword: string; legs: readonly TrailLeg[] }` where `keyword` is a non-empty string of 1–200 characters and `legs` contains at least one `TrailLeg`.
6. THE Core SHALL export a `validateCodeTrail` function that accepts a `CodeTrail` and returns a result indicating either success or a list of validation failures, without modifying the input.
7. WHEN `validateCodeTrail` is called on a `CodeTrail` whose `keyword` is an empty string, THE function SHALL return a failure identifying the `keyword` field as invalid.
8. WHEN `validateCodeTrail` is called on a `CodeTrail` whose `legs` array is empty, THE function SHALL return a failure indicating at least one leg is required.
9. FOR EACH leg in a `CodeTrail`, WHEN `validateCodeTrail` is called, THE function SHALL enforce these structural rules:
   a. A leg's first step MUST have level `"chapter"`, `"annex"`, `"index"`, or `"article"` (the last only when the article is the introduction that precedes Chapter 1 — illustrative example: Article 90).
   b. Within Chapters 1 through 8 (illustrative, unverified): a leg proceeds from `"chapter"` → `"article"` → optional `"part"` → one or more of `"section"` and/or `"table"` → optional `"notes"`. A leg MAY end at `"section"`, `"table"`, or `"notes"`.
   c. Within Chapter 9 (illustrative, unverified): a leg proceeds from `"chapter"` → `"table"` → optional `"notes"`. No `"article"`, `"part"`, or `"section"` steps are permitted.
   d. An annex leg proceeds from `"annex"` → `"table"` → optional `"notes"`.
   e. An index leg models looking the keyword up in the book's index and going straight to the answer. It proceeds from `"index"` → exactly one step of level `"section"` or `"table"` → optional `"notes"`. No `"chapter"`, `"article"`, or `"part"` steps and no repeated `"section"` or `"table"` steps are permitted in an index leg.
   f. Any leg that does not conform to rules (a)–(e) SHALL produce a failure identifying the leg index and the offending step.
10. WHEN `validateCodeTrail` is called on a `CodeTrail` with more than one leg, THE function SHALL validate each leg independently using rules 9a–9f, and SHALL return all failures across all legs in a single result.
11. THE Core SHALL export an `extractFirstNumber` function that accepts a string and returns the first contiguous run of ASCII digit characters (`0`–`9`) found in the string as a `number`, or `null` if the string contains no digit characters. Only the first digit run is returned; any subsequent digit runs are ignored. (Illustrative examples, not NEC citations: `"Chapter 9"` → `9`; `"Article 90"` → `90`; `"no digits here"` → `null`; `"3-wire 12"` → `3`.)
12. THE Core SHALL use `extractFirstNumber` within `validateCodeTrail` to identify chapter number and article number from step values: a chapter step whose value yields `null` from `extractFirstNumber` is a validation failure; a leg may start at `"article"` only when `extractFirstNumber` applied to the article step's value returns `90` (illustrative, unverified); a chapter step is treated as Chapter 9 (illustrative, unverified) when `extractFirstNumber` returns `9`.
13. THE Core SHALL verify with fast-check the following three properties for `extractFirstNumber`: (a) for any string constructed as digits-only it returns those digits as a number; (b) for any string containing no ASCII digit characters it returns `null`; (c) for any string containing two or more digit runs separated by non-digit characters, it returns the value of the first run only.
14. THE Core SHALL verify with fast-check that `validateCodeTrail` accepts every generated valid trail, including trails containing index legs, and rejects generated invalid index legs (for example `"index"` followed by two `"section"` steps, `"index"` followed by an `"article"` step, or `"index"` with no following step).

---

### Requirement 2: TrailGrader — Step-by-Step Grading

**User Story:** As a developer building the Midnight Code Hunt drill UI, I want a pure function that grades a user's picks against one or more valid trails declared by a drill, so that the UI can show per-step feedback, distinguish old-edition answers from plain misses, and handle part-less trails gracefully — all without encoding grading logic in the UI.

#### Acceptance Criteria

1. THE Core SHALL export a `NO_PARTS` constant equal to the string `"NONE"`, which a user may pick at a part step to indicate they believe the trail has no part.
2. THE Core SHALL export a `TrailVerdict` type defined as the union `"correct" | "incorrect" | "unanswered"`.
3. THE Core SHALL export a `StepResult` type defined as `{ level: TrailLevel; verdict: TrailVerdict }`.
4. THE Core SHALL export a `GradeResult` type defined as `{ stepResults: StepResult[]; matched: boolean; matchedMovedFrom: boolean }`.
5. THE Core SHALL export a `gradeTrail` function that accepts a `DrillDef` (containing a non-empty `trails` array of `CodeTrail` values and an optional `movedFrom: CodeTrail`) and a `readonly { level: TrailLevel; value: string }[]` array of picks aligned to the steps of the trail being tested, and returns a `GradeResult`.
6. WHEN the user's picks match any one trail in the `trails` array (using case-insensitive trimmed comparison on each `value`), THE `gradeTrail` function SHALL return a `GradeResult` with `matched: true` and `matchedMovedFrom: false`.
7. WHEN the user's picks match no trail in the `trails` array AND a `movedFrom` trail is present AND the picks match the `movedFrom` trail, THE `gradeTrail` function SHALL return a `GradeResult` with `matched: false` and `matchedMovedFrom: true`, so the UI can distinguish an old-edition answer from a plain miss.
8. WHEN the user's picks match no trail in `trails` and either no `movedFrom` is present or the picks do not match `movedFrom`, THE `gradeTrail` function SHALL return a `GradeResult` with `matched: false` and `matchedMovedFrom: false`.
9. WHEN a valid trail in `trails` contains no step with level `"part"`, AND the user submits a pick `{ level: "part", value: NO_PARTS }` at the position where a part step would appear, THE `gradeTrail` function SHALL treat that pick as correct for that position.
10. WHEN a valid trail in `trails` contains no step with level `"part"`, AND the user provides no pick object at the part position (omits it entirely from the picks array), THE `gradeTrail` function SHALL also treat the omission as correct for that position.
11. WHEN a valid trail in `trails` DOES contain a step with level `"part"`, AND the user submits a pick `{ level: "part", value: NO_PARTS }` at that position, THE `gradeTrail` function SHALL mark that step's verdict as `"incorrect"`.
12. THE `gradeTrail` function SHALL be pure and deterministic: it SHALL read no module-level mutable state, write no module-level mutable state, and produce no observable effects beyond returning its value.
13. THE Core SHALL verify with fast-check that for all valid `DrillDef` inputs and corresponding user-pick arrays, calling `gradeTrail` twice with the same arguments returns `GradeResult` values that are structurally equal at every field (determinism property).
14. THE Core SHALL verify with fast-check that for any `CodeTrail` declared in `trails`, constructing user picks directly from that trail's step values (with the generated trails including trails with index legs) and passing them to `gradeTrail` always returns `matched: true` (any declared valid trail grades fully correct against itself).
15. THE Core SHALL verify with fast-check that for any `CodeTrail` in `trails` that contains no `"part"` step, a pick array that includes `{ level: "part", value: NO_PARTS }` at the part position produces the same `matched` result as a pick array that omits the part position entirely (`NO_PARTS` equivalence property).
16. WHEN grading against a trail that contains no `"part"` step, THE `gradeTrail` function SHALL first strip any pick whose `level` is `"part"` and whose `value` is `NO_PARTS` from the picks array before aligning remaining picks to the trail steps by index, so that subsequent picks remain correctly aligned without requiring the UI to reindex.

---

### Requirement 3: defineCalcPlugin — Calculator Contract

**User Story:** As a developer adding a new field calculator, I want a typed contract function that forces me to declare inputs, outputs, a pure calculate function, a code trail, and property-based test invariants, so that every calculator is self-describing and testable without modifying Core.

#### Acceptance Criteria

1. THE Core SHALL export a `defineCalcPlugin` function that accepts a `CalcPluginDef<I, O>` object and returns it unchanged (identity function at runtime, typed at compile time).
2. THE `CalcPluginDef<I, O>` type SHALL require the following fields: `id` (non-empty string of 1–100 characters, unique per plugin registration), `label` (non-empty string of 1–120 characters), `inputs` (non-empty array of `CalcInput` descriptors, where each `CalcInput` has a non-empty `name` string and a `type` of `"number" | "string" | "select"`), `outputs` (non-empty array of `CalcOutput` descriptors, where each `CalcOutput` has a non-empty `name` string and a `type` of `"number" | "string"`), `calculate` (a synchronous function typed as `(input: I) => O` that does not return a Promise), `trails` (a function typed as `(input: I) => readonly CodeTrail[]` that returns a non-empty array of `CodeTrail` values representing the code-book references behind this calculation's answer; the array may vary with input), and `invariants` (a non-empty array of `Invariant<I, O>` descriptors containing at least one entry).
3. WHEN a `CalcPlugin` author omits any required field from `CalcPluginDef`, THE TypeScript compiler SHALL produce a type error.
4. THE `Invariant<I, O>` type SHALL require an `id` field (non-empty string of 1–100 characters), a `description` field (non-empty string of 1–200 characters), and a `check` field typed as `(input: I, output: O) => boolean`. THE `Invariant` type SHALL NOT include any fast-check `Arbitrary` or `IProperty` field; the arbitrary is supplied by the test file at the call site of `runInvariants`.
5. THE Core SHALL export a `runInvariants` function typed as `runInvariants<I, O>(plugin: CalcPluginDef<I, O>, arbitraries: Record<string, fc.Arbitrary<I>>, options?: { numRuns?: number }): InvariantReport[]`. The `arbitraries` parameter maps each invariant `id` to the fast-check `Arbitrary<I>` that generates inputs for it. The default `numRuns` SHALL be 100 when not specified.
6. THE Core's runtime entry point (the files included in the published `dist/`) SHALL NOT import `fast-check`. Fast-check SHALL appear only in `devDependencies` of `skeleton-core`'s `package.json` and SHALL be imported only in test files.
7. THE `InvariantReport` type SHALL require the following fields: `invariantId` (the `id` string of the corresponding `Invariant`), `status` (`"pass"` or `"fail"`), and `counterexample` (a string describing the failing input when `status` is `"fail"`, or `null` when `status` is `"pass"`).
8. WHEN all invariants pass, THE `runInvariants` function SHALL return an `InvariantReport` array where every entry has `status: "pass"` and `counterexample: null`.
9. WHEN any invariant fails, THE `runInvariants` function SHALL return an `InvariantReport` entry for that invariant with `status: "fail"` and `counterexample` set to the failing input serialized as a non-empty string by fast-check, without throwing an exception.
10. IF the `calculate` function throws an exception during invariant execution, THEN THE `runInvariants` function SHALL record that invariant's `InvariantReport` entry as `status: "fail"` with `counterexample` set to a string indicating the input that caused the throw, and SHALL continue executing remaining invariants.
11. WHEN a `CalcPluginDef` whose `calculate` function returns its input unchanged is passed to `runInvariants` with an invariant asserting output equals input, THE `runInvariants` function SHALL return all entries with `status: "pass"`.

---

### Requirement 4: defineCalcPlugin — Pure and Deterministic calculate Function

**User Story:** As a developer and test runner, I want every calculator's `calculate` function to be provably pure and deterministic, so that property-based tests can trust that 100 fast-check iterations reflect the function's actual behavior and not incidental state.

#### Acceptance Criteria

1. THE `CalcPluginDef` contract SHALL NOT include any field that allows the `calculate` function to receive or return a Promise, observable, or callback.
2. WHEN a `CalcPlugin`'s `calculate` function is called twice with the same input value, where "same" means recursive deep equality over all own enumerable properties, THE function SHALL return output values that are also recursively deeply equal over all own enumerable properties; this determinism property SHALL be verified by a fast-check property test running a minimum of 100 iterations.
3. THE TypeScript type signature of `calculate` SHALL be exactly `(input: I) => O` with no additional parameters, no overloads, and no use of generic constraints that introduce side-channel inputs.
4. IF the `calculate` function is called with input A, then called with a structurally different input B, then called again with input A, THEN THE function SHALL return an output for the third call that is recursively deeply equal to the output of the first call, confirming no external or module-level mutable state was read or written during execution.

---

### Requirement 5: TableValue Data Shape

**User Story:** As the founder auditing NEC table values before publishing, I want every value sourced from an NEC table to carry its table citation and an unchecked flag, so that I can find and verify every table-derived number before the app goes live.

#### Acceptance Criteria

1. THE Core SHALL export a `TableValue` type with three required fields: `value` (number), `source` (non-empty string naming the NEC table, e.g. `"Table 314.16(A)"`), and `nfpa_checked` (boolean, default `false`).
2. WHEN a developer creates a `TableValue` object, THE TypeScript compiler SHALL enforce that all three fields are present.
3. THE Core SHALL export a `makeTableValue` helper that accepts `value`, `source`, and an optional `nfpa_checked` argument (defaulting to `false`) and returns a `TableValue`.
4. IF a `makeTableValue` call receives an empty string for `source`, THEN THE `makeTableValue` function SHALL throw an `Error` with a message indicating that `source` must be non-empty.
5. FOR ALL numeric values and non-empty source strings, `makeTableValue(v, s).value` SHALL equal `v` and `makeTableValue(v, s).source` SHALL equal `s` (round-trip property, verified with fast-check).
6. THE Core SHALL NOT export any pre-populated NEC table data arrays or objects; table data files live in the consuming app packages only.

---

### Requirement 6: defineCodeTrail — Drill-Pack Contract

**User Story:** As a developer building a drill pack for Midnight Code Hunt, I want a typed contract function that forces me to declare one or more valid trails, an optional previous-edition trail, an optional edition note, and a hint, so that drill packs are self-describing, support multi-trail answers, and let the UI distinguish old-edition picks from plain misses.

#### Acceptance Criteria

1. THE Core SHALL export a `defineCodeTrail` function that accepts a `CodeTrailDef` object and returns the exact same object reference passed in, with no properties added, removed, or mutated.
2. THE `CodeTrailDef` type SHALL require: `id` (a non-empty string of 1–128 characters, intended to be unique per drill pack and enforced by convention at registration rather than by this function), `label` (a non-empty string of 1–128 characters), `trails` (a non-empty `readonly CodeTrail[]` array of valid trails any one of which is an acceptable answer), and `hint` (a non-empty string of 1–500 characters describing where to find the answer in the code book without quoting NEC text).
3. THE `CodeTrailDef` type SHALL include an optional `movedFrom` field typed as `CodeTrail`, recording where the same answer was located in the 2023 NEC edition.
4. WHEN a developer omits any required field from `CodeTrailDef`, THE TypeScript compiler SHALL produce a type error.
5. WHEN `validateCodeTrail` is called on a `CodeTrailDef`, THE function SHALL validate every `CodeTrail` in the `trails` array using the structural rules in Requirement 1, and SHALL return all failures across all trails in a single result.
6. WHEN `validateCodeTrail` is called on a `CodeTrailDef` that includes a `movedFrom` trail, THE function SHALL also validate the `movedFrom` trail using the structural rules in Requirement 1 and include any failures in the result.
7. WHERE a `CodeTrailDef` includes an optional `tableValues` field, THE Core SHALL type that field as `ReadonlyArray<TableValue>` so that any table-sourced data in a drill pack conforms to the `TableValue` shape.
8. THE `CodeTrailDef` type SHALL include an optional `editionNote` field typed as a string of 1–300 characters, for drills where the answer itself changed between editions, not only its location. THE UI SHALL show the `editionNote` alongside the `matchedMovedFrom` feedback; `gradeTrail` and `GradeResult` are unchanged, and the UI reads `editionNote` from the drill definition.
9. WHEN `validateCodeTrail` is called on a `CodeTrailDef` whose `editionNote` is present and is empty or longer than 300 characters, THE function SHALL return a failure identifying `editionNote` as invalid.
10. THE Core SHALL verify with fast-check that `editionNote` strings of 1–300 characters validate ok, and that `editionNote` strings of length 0 or over 300 characters are rejected.

---

### Requirement 7: Plugin Registry

**User Story:** As a developer wiring up either app, I want a lightweight registry that holds all registered plugins and drill packs keyed by id, so that either app can look up a plugin by id without knowing the full plugin list at compile time.

#### Acceptance Criteria

1. THE Core SHALL export a `createRegistry` function that returns a new, empty `PluginRegistry` instance.
2. THE `PluginRegistry` SHALL expose a `register` method that accepts a `CalcPlugin` or `CodeTrailDef` and stores it by its `id` field.
3. WHEN `register` is called with an `id` that already exists in the registry, THE `PluginRegistry` SHALL throw an `Error` indicating a duplicate `id`.
4. THE `PluginRegistry` SHALL expose a `lookup` method that accepts an `id` string and returns the registered plugin or drill pack, or `undefined` if not found.
5. THE `PluginRegistry` SHALL expose a `list` method that returns a read-only array of all registered entries in insertion order.
6. FOR ALL sequences of distinct-id registrations, `registry.list().length` SHALL equal the number of `register` calls made (invariant property, verified with fast-check).
7. FOR ALL registered entries, `registry.lookup(entry.id)` SHALL return the same object that was passed to `register` (round-trip property, verified with fast-check).

---

### Requirement 8: No App-Specific Code in Core

**User Story:** As a maintainer of the monorepo, I want the Core package to contain zero app-specific imports or references, so that either app can depend on Core without pulling in the other app's code or data.

#### Acceptance Criteria

1. THE Core package SHALL NOT import from `midnight-code-hunt/` or `dead-circuit-check/` at any level of its dependency graph.
2. THE Core package SHALL NOT export any React components, Tailwind class strings, or Vite plugin configurations.
3. THE Core `package.json` SHALL NOT list `midnight-code-hunt` or `dead-circuit-check` as dependencies or devDependencies.
4. WHEN the Core package is built in isolation (without the app packages present), THE build SHALL complete without errors.
5. THE Core package SHALL NOT contain any NEC table data files, drill pack definitions, or calculator plug-in implementations specific to either app.
6. IF the Core package's built output (e.g., `dist/`) contains any file that, when statically analyzed, includes an import of `fast-check`, THEN the build verification SHALL report a failure and exit with a non-zero status code.
7. THE repository root `package.json` SHALL be marked `"private": true` and SHALL declare npm workspaces containing `packages/*` only; each app folder (`midnight-code-hunt`, `dead-circuit-check`) is added to the workspaces list when that app is created.
