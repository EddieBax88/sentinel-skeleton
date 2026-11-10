# Requirements Document

## Introduction

`packages/skeleton-core` is the shared engine that powers both the Midnight Code Hunt and Dead Circuit Check applications. It contains no app-specific code and no NEC table data. It exports three things: the `CodeTrail` type system and trail-grading logic, the `defineCalcPlugin` contract for field calculators, and the `defineCodeTrail` contract for drill packs. Every value taken from an NEC table is expressed through the `TableValue` data shape, which carries a `source` field and an `nfpa_checked` flag so the founder can audit each entry before publishing.

## Glossary

- **Core**: The `packages/skeleton-core` package — shared engine and extension contracts only.
- **CodeTrail**: An ordered five-step sequence (Keyword → Chapter → Article → Part → Section) that locates an NEC answer.
- **TrailGrader**: The Core module that evaluates a user's step-by-step picks against a correct `CodeTrail` and returns a per-step result.
- **CalcPlugin**: A calculator module that conforms to the `defineCalcPlugin` contract.
- **CalcInput**: The typed input descriptor declared by a `CalcPlugin`.
- **CalcOutput**: The typed output descriptor declared by a `CalcPlugin`.
- **InvariantSuite**: The set of fast-check property-based tests a `CalcPlugin` must declare and that the test runner must execute.
- **CodeTrailDef**: A drill-pack module that conforms to the `defineCodeTrail` contract.
- **TableValue**: The data shape used to hold any value sourced from an NEC table. Contains the numeric value, a `source` string naming the table, and an `nfpa_checked` boolean flag.
- **Plugin Registry**: The runtime map that holds all registered `CalcPlugin` and `CodeTrailDef` instances keyed by their declared `id`.

---

## Requirements

### Requirement 1: CodeTrail Type and Step Ordering

**User Story:** As a developer building either app, I want a single canonical type for the five-step NEC navigation path, so that both apps and all calculators describe answers the same way.

#### Acceptance Criteria

1. THE Core SHALL export a `CodeTrail` type whose fields are, in order: `keyword`, `chapter`, `article`, `part`, and `section`, each typed as a string between 1 and 200 characters inclusive.
2. THE Core SHALL enforce at the TypeScript type level that all five fields are present and non-optional on every `CodeTrail` value.
3. WHEN a developer omits any of the five `CodeTrail` fields, THE TypeScript compiler SHALL produce a type error at the call site.
4. THE Core SHALL export a `TRAIL_STEPS` constant typed as a `readonly` five-element tuple in the canonical order `["keyword", "chapter", "article", "part", "section"]`, such that the TypeScript compiler rejects any mutation or reordering of its elements.
5. WHEN `validateCodeTrail` is called with a `CodeTrail` value in which any field is an empty string, THE Core SHALL return a failure result identifying each field whose value has fewer than 1 character, without modifying the input value.

---

### Requirement 2: TrailGrader — Step-by-Step Grading

**User Story:** As a developer building the Midnight Code Hunt drill UI, I want a pure function that grades a user's picks against a correct trail one step at a time, so that the UI can display per-step feedback without knowing the grading logic itself.

#### Acceptance Criteria

1. THE Core SHALL export a `gradeTrail` function that accepts a correct `CodeTrail` and an array of user-pick strings (one per step, in `TRAIL_STEPS` order) and returns a `TrailResult` array of exactly five elements in `TRAIL_STEPS` order, where each `TrailResult` element contains the `step` key (a `TRAIL_STEPS` member) and a `verdict` field typed as `"correct" | "incorrect" | "unanswered"`.
2. WHEN a user pick exactly matches the corresponding step value in the correct `CodeTrail` (compared after trimming leading and trailing whitespace from both strings and folding both to lower-case), THE `gradeTrail` function SHALL set that element's `verdict` to `"correct"`.
3. WHEN a user pick is present at the corresponding index but does not match the corresponding step value after case-insensitive trimmed comparison, THE `gradeTrail` function SHALL set that element's `verdict` to `"incorrect"`.
4. WHEN the user picks array contains fewer than five entries, THE `gradeTrail` function SHALL set the `verdict` for every index beyond the last supplied pick to `"unanswered"`; WHEN the user picks array contains more than five entries, THE `gradeTrail` function SHALL ignore all entries at index five and beyond and still return exactly five `TrailResult` elements.
5. THE Core SHALL export a `TrailVerdict` type defined as the union `"correct" | "incorrect" | "unanswered"` and a `TrailResult` type defined as an object with a `step` field (a member of `TRAIL_STEPS`) and a `verdict` field of type `TrailVerdict`.
6. THE `gradeTrail` function SHALL be pure and deterministic: it SHALL read no module-level mutable state, write no module-level mutable state, and produce no observable effects beyond returning its value, such that identical inputs always produce identical outputs.
7. THE Core SHALL verify with fast-check that for all valid `CodeTrail` objects and all user-pick arrays of length five, calling `gradeTrail` twice with the same arguments returns arrays of length five whose `step` and `verdict` values are identical at every index (idempotence property).

---

### Requirement 3: defineCalcPlugin — Calculator Contract

**User Story:** As a developer adding a new field calculator, I want a typed contract function that forces me to declare inputs, outputs, a pure calculate function, a code trail, and property-based test invariants, so that every calculator is self-describing and testable without modifying Core.

#### Acceptance Criteria

1. THE Core SHALL export a `defineCalcPlugin` function that accepts a `CalcPluginDef<I, O>` object and returns it unchanged (identity function at runtime, typed at compile time).
2. THE `CalcPluginDef<I, O>` type SHALL require the following fields: `id` (non-empty string of 1–100 characters, unique per plugin registration), `label` (non-empty string of 1–120 characters), `inputs` (non-empty array of `CalcInput` descriptors, where each `CalcInput` has a non-empty `name` string and a `type` of `"number" | "string" | "select"`), `outputs` (non-empty array of `CalcOutput` descriptors, where each `CalcOutput` has a non-empty `name` string and a `type` of `"number" | "string"`), `calculate` (a synchronous function typed as `(input: I) => O` that does not return a Promise), `trail` (a `CodeTrail` as defined by the Core), and `invariants` (a non-empty array of `Invariant<I, O>` descriptors containing at least one entry).
3. WHEN a `CalcPlugin` author omits any required field from `CalcPluginDef`, THE TypeScript compiler SHALL produce a type error.
4. THE `Invariant<I, O>` type SHALL require an `id` field (non-empty string of 1–100 characters), a `description` field (non-empty string of 1–200 characters), and a `property` field typed as `fc.IProperty<[I]>` from the fast-check library, so that the test runner can execute it without additional wiring.
5. THE Core SHALL export a `runInvariants` function that accepts a `CalcPluginDef<I, O>` and executes each declared invariant using fast-check with a minimum of 100 runs per invariant, returning an `InvariantReport` array with one entry per invariant in declaration order.
6. THE `InvariantReport` type SHALL require the following fields: `invariantId` (the `id` string of the corresponding `Invariant`), `status` (`"pass"` or `"fail"`), and `counterexample` (a string describing the failing input when `status` is `"fail"`, or `null` when `status` is `"pass"`).
7. WHEN all invariants pass, THE `runInvariants` function SHALL return an `InvariantReport` array where every entry has `status: "pass"` and `counterexample: null`.
8. WHEN any invariant fails, THE `runInvariants` function SHALL return an `InvariantReport` entry for that invariant with `status: "fail"` and `counterexample` set to the failing input serialized as a non-empty string by fast-check, without throwing an exception.
9. IF the `calculate` function throws an exception during invariant execution, THEN THE `runInvariants` function SHALL record that invariant's `InvariantReport` entry as `status: "fail"` with `counterexample` set to a string indicating the input that caused the throw, and SHALL continue executing remaining invariants.
10. WHEN a `CalcPluginDef` whose `calculate` function returns its input unchanged is passed to `runInvariants` with an invariant asserting output equals input, THE `runInvariants` function SHALL return all entries with `status: "pass"`.

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

**User Story:** As a developer building a drill pack for Midnight Code Hunt, I want a typed contract function that forces me to declare a unique id, a label, and a correct `CodeTrail`, so that drill packs are self-describing and can be registered without modifying Core.

#### Acceptance Criteria

1. THE Core SHALL export a `defineCodeTrail` function that accepts a `CodeTrailDef` object and returns it unchanged (identity function at runtime, typed at compile time).
2. THE `CodeTrailDef` type SHALL require: `id` (unique non-empty string), `label` (human-readable string), `trail` (a valid `CodeTrail`), and `hint` (a non-empty string that describes where to find the answer in the code book, without quoting NEC text).
3. WHEN a developer omits any required field from `CodeTrailDef`, THE TypeScript compiler SHALL produce a type error.
4. WHERE a `CodeTrailDef` includes an optional `tableValues` field, THE Core SHALL type that field as `ReadonlyArray<TableValue>` so that any table-sourced data in a drill pack conforms to the `TableValue` shape.

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
