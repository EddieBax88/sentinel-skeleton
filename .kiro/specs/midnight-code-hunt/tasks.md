# Implementation Plan: midnight-code-hunt

## Overview

Build `midnight-code-hunt/` (App 1) as a standalone Vite + React + Tailwind + TypeScript workspace package that depends on `@sentinel/skeleton-core` without changing it. The order is: root workspace entry and app scaffold (pinned versions, a single alias to the Core's public `src/index.ts` so dev, test, and typecheck work after only `npm install`, and the `verify` pipeline scripts); then the pure logic modules; then data (Checked_Names_Files, Option_Tree validator, fictional fixtures, and an EMPTY Drill_Library); then React components, theme, Halloween SVG motifs, and accessibility; then the data test, content-scan test, static network-call check, bundle check, and a clean-clone proof.

All decisions live in pure functions under `src/logic/`; components only render and dispatch. Tests are Vitest, jsdom, Testing Library, and fast-check (devDependencies only, at least 100 runs per property).

Tasks 1 to 15 built the Timed app and are done. Tasks 16 to 18 add Guided mode as a new group at the end (requirements 18 to 22, design "Guided mode"). They add new modules beside the Timed code and change Timed files only in the three additive ways the design names: an optional `why` type field, two picker buttons, and an optional starting Method on `DrillScreen`. The waves for tasks 16 to 18 start after wave 12.

Test files: each property gets its own test file named `<module>.<topic>.property.test.ts` next to its module (a refinement of the design's file table, so property sub-tasks never write to the same file and can run in parallel). Each test carries the tag `// Feature: midnight-code-hunt, Property N: <title>`.

Content rules for every task: no drill content is written by any task (the founder supplies every question, answer, trail, hint, and Index entry), fictional fixtures live only in `test/fixtures/`, every NEC number in an example is illustrative and unverified, and no task edits anything under `packages/skeleton-core/` or requires the Core's `dist/` to exist.

## Tasks

- [x] 1. Root workspace entry and app scaffold
  - [x] 1.1 Add the app to the root workspaces
    - Edit the root `package.json` so `workspaces` is `["packages/*", "midnight-code-hunt"]`
    - Leave the root `verify` script as `npm run verify --workspaces --if-present`
    - _Requirements: 1.2, 1.5_

  - [x] 1.2 Create `midnight-code-hunt/package.json` and `.env.example`
    - Name `midnight-code-hunt`, `private`, `type: module`
    - Scripts: `dev` (`vite`), `build` (`vite build`), `typecheck` (`tsc -p tsconfig.json --noEmit`), `check:static` (`node scripts/check-static.mjs`), `check:bundle` (`node scripts/check-bundle.mjs`), `test` (`vitest --run`), `verify` (`npm run typecheck && npm run check:static && npm run test && npm run build && npm run check:bundle`)
    - `dependencies`: `@sentinel/skeleton-core` `0.1.0`, `react` `19.3.1`, `react-dom` `19.3.1`
    - `devDependencies`, all exact-pinned as in the design: `@tailwindcss/vite` 4.3.5, `@testing-library/dom` 10.4.2, `@testing-library/jest-dom` 6.9.1, `@testing-library/react` 16.3.3, `@testing-library/user-event` 14.6.9, `@types/node` 20.19.43, `@types/react` 19.3.0, `@types/react-dom` 19.3.0, `@vitejs/plugin-react` 5.2.0, `fast-check` 4.10.2, `jsdom` 27.4.0, `tailwindcss` 4.3.5, `typescript` 5.9.3, `vite` 7.3.8, `vitest` 3.2.7
    - `vitest` and `fast-check` appear in `devDependencies` only
    - If a pinned version is not on the registry at install time, pin the nearest compatible exact version and record the change in the Notes
    - Write `.env.example` containing only `VITE_DEAD_CIRCUIT_CHECK_URL=`
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 15.1_

  - [x] 1.3 Write the build, type, and test configuration
    - `vite.config.ts`: React and Tailwind plugins, `resolve.alias` mapping `@sentinel/skeleton-core` to `../packages/skeleton-core/src/index.ts` (via `fileURLToPath`), `build.modulePreload.polyfill = false`, and a `test` block (`environment: "jsdom"`, `setupFiles: ["test/support/setup.ts"]`, `include` covering `src/**/*.test.{ts,tsx}`, `test/**/*.test.{ts,tsx}`, and `scripts/**/*.test.ts`)
    - `tsconfig.json`: `strict`, `moduleResolution: "Bundler"`, `jsx: "react-jsx"`, `paths` for `@sentinel/skeleton-core` to `../packages/skeleton-core/src/index.ts`, `include` of `src`, `test`, and `vite.config.ts`; leave `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` off
    - `index.html` with `lang="en"`, a viewport meta tag of `width=device-width, initial-scale=1` (no zoom lock), and a root div
    - `src/vite-env.d.ts` declaring `ImportMetaEnv.VITE_DEAD_CIRCUIT_CHECK_URL`
    - `test/support/setup.ts` registering jest-dom matchers and Testing Library `cleanup` after each test
    - Only these two config files may name the Core's source path; application code imports `@sentinel/skeleton-core` only
    - _Requirements: 1.6, 1.9, 1.10, 13.3, 14.10, 17.19_

  - [x] 1.4 Write `scripts/check-static.mjs` and `scripts/check-bundle.mjs`
    - `check-static.mjs` walks `src/` (comments included) and exits non-zero, printing each offending file path, for: whole-word `fetch`, `XMLHttpRequest`, `WebSocket`, or `sendBeacon`; an import specifier containing `skeleton-core/` or `packages/skeleton-core`; an import that resolves into `test/` or a fixtures folder, checked in non-test files only; an import of `fast-check` from a non-test file
    - `check-bundle.mjs` scans `dist/` and exits non-zero, printing the path, if `fast-check` appears
    - Both exit zero on clean input; the walk skips `*.test.*` files (including `*.test.ts` and `*.test.tsx`) for both the test-import rule and the `fast-check` rule, because the co-located property and component tests import `test/support/*` and `test/fixtures/*`
    - _Requirements: 1.9, 1.11, 1.12, 17.19_

  - [x] 1.5 Create the minimal buildable app shell
    - `src/main.tsx` mounting `<App/>`, a placeholder `src/App.tsx` that renders one `<h1>`, and `src/styles/index.css` containing only `@import "tailwindcss";`
    - Purpose: let `vite build` and `tsc` succeed before the real screens exist
    - _Requirements: 1.1, 1.10_

  - [x] 1.6 Add the Core alias smoke test
    - Write `src/alias.smoke.test.ts` that imports `gradeTrail`, `validateCodeTrail`, and `NO_PARTS` from `@sentinel/skeleton-core` and asserts one fictional trail validates and grades `matched: true`
    - This proves the alias works with no Core `dist/` and gives `vitest --run` at least one test file
    - _Requirements: 1.6, 1.7_

  - [x] 1.7 Install and prove the scaffold
    - Run `npm install` at the repository root; confirm `node_modules/@sentinel/skeleton-core` links to `packages/skeleton-core`
    - Confirm `.gitignore` ignores `node_modules`, `dist`, and `dist-test-utils`; add any missing entry
    - Run `npm run typecheck` and `npm run build` in `midnight-code-hunt/` and fix any config error
    - Do not touch any file under `packages/skeleton-core/`
    - _Requirements: 1.5, 1.7, 1.8_

- [x] 2. Model types, methods, display names, and copy
  - [x] 2.1 Implement `src/model/types.ts` and `src/model/methods.ts`
    - `types.ts`: `MethodId`, `NodeLevel`, `OptionRole` (`correct`, `moved`, `wrong`), `ArticleNode` (required `hasParts`), `OtherNode`, `OptionNode`, `OptionTree`, `TableWalk`, `DrillRecord` (wrapping a Core `CodeTrailDef`, with `question`, `answer`, `citation`, `founder_checked`, `index_checked`, `wrongOptionsReviewed`, optional `chapterForkSentence`, `articleForkSentence`, `tableWalk`, and `trees: { toc, index? }`), and the typed-identity `defineDrill`
    - `methods.ts`: `METHOD_ORDER` (index first), `METHOD_LABELS` ("Index Keyword Lookup", "Table of Contents Lookup"), `methodOf(trail)` (first step `index` gives index; `chapter`, `annex`, `article` give toc), `availableMethods(drill)`, `defaultMethod(drill)`
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.15, 2.16, 2.17, 6.1, 6.2, 6.3, 6.4_

  - [x] 2.2 Write property test for method availability
    - File `src/model/methods.availability.property.test.ts`
    - **Property 7: Method availability follows `index_checked`**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

  - [x] 2.3 Implement `src/logic/chapters.ts`
    - Export `CHAPTER_LABELS` (the nine founder labels, word for word, in order) and `completeChapterOptions(authored)` that always returns nine nodes ordered Ch 1 to Ch 9, fills missing slots with generated `wrong` chapter nodes that have no `next`, and drops authored nodes whose number is outside 1 to 9
    - _Requirements: 9.8, 3.9_

  - [x] 2.4 Write property test for chapter options
    - File `src/logic/chapters.property.test.ts`
    - **Property 2: Chapter options are always the nine fixed labels in order**
    - **Validates: Requirements 9.8, 3.9**

  - [x] 2.5 Implement `src/logic/displayName.ts`
    - Export `Edition`, `CheckedNameEntry`, `CheckedNamesFile`, `CheckedNamesIndex`, `buildNamesIndex`, `editionOf` (role `moved` gives 2023, otherwise 2026), `DisplayResolution`, and `resolveDisplay` following the design's decision table: chapter label, printed wording word for word, `designator + " " + shortDescription` fallback (with `inconsistent` for a checked entry lacking wording), raw value with `unresolvedKey` for a missing entry
    - Never trim, re-case, or re-space `printed`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8, 3.9_

  - [x] 2.6 Write property test for the printed-name rule
    - File `src/logic/displayName.property.test.ts`
    - **Property 1: Display name follows the printed-name rule**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.7, 3.8**

  - [x] 2.7 Implement `src/copy/strings.ts`
    - Export `PROSE` (sentences checked for reading level), `FIXED` (footer, method labels, nine Chapter labels imported from `chapters.ts`, other dictated text), and `FOOTER_DISCLAIMER` set to the required footer word for word, including the ® symbol (U+00AE)
    - Define EVERY user-facing string used by any screen up front, so later tasks only import: picker copy (the one-line benefit, the 2026 NEC copy note, "new drills are coming" of 120 characters or fewer, the development "no drills available" message, the moved-between-editions label, the "Draft" badge), Method descriptions (one sentence of 20 words or fewer each), step headings, verdict labels ("correct", "incorrect", "not answered"), the time-ran-out message, the new-best message, the moved-article message, the storage note (100 characters or fewer), result headings and buttons ("Check my answer", "Try again", "Back to drills"), live-region announcements, the unavailable-drill message, and the Sentinel link text
    - No step count in any string, no numeric time-savings figure, no pass guarantee, no gendered terms
    - _Requirements: 4.7, 5.2, 5.6, 5.7, 5.8, 5.9, 6.5, 7.5, 10.8, 11.7, 11.9, 11.10, 11.12, 12.8, 14.8, 15.5, 15.6, 16.6, 16.9, 16.10, 16.11, 16.12_

- [x] 3. Founder-checked filter and switcher URL
  - [x] 3.1 Implement `src/logic/filterDrills.ts`
    - Export `BuildMode`, `DrillEntry`, `getBuildMode(env)` (`PROD` true always yields production), and `filterDrills(drills, mode)`; strict `founder_checked === true`; return a new array and never mutate input
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.9, 5.10_

  - [x] 3.2 Write property test for the production filter
    - File `src/logic/filterDrills.production.property.test.ts`
    - **Property 3: Production filter keeps only checked drills, in order**
    - **Validates: Requirements 4.1, 4.2, 4.4, 4.5**

  - [x] 3.3 Write property test for production filter idempotence
    - File `src/logic/filterDrills.idempotent.property.test.ts`
    - **Property 4: Production filter is idempotent**
    - **Validates: Requirements 4.6**

  - [x] 3.4 Write property test for the development and test filter
    - File `src/logic/filterDrills.development.property.test.ts`
    - **Property 5: Development and test filter keeps everything and flags drafts**
    - **Validates: Requirements 4.3, 4.4, 4.9**

  - [x] 3.5 Write property test for build mode
    - File `src/logic/filterDrills.buildMode.property.test.ts`
    - **Property 6: Build mode never publishes drafts**
    - **Validates: Requirements 4.2, 5.10**

  - [x] 3.6 Implement `src/logic/switcher.ts`
    - Export `parseSwitcherUrl(raw)`: return the raw value unchanged only when it is a string of 1 to 2048 characters starting with `https://`, `http://`, or `/`; otherwise `null`; no trimming or rewriting
    - _Requirements: 15.2, 15.3_

  - [x] 3.7 Write property test for switcher URL validation
    - File `src/logic/switcher.property.test.ts`
    - **Property 29: Switcher URL validation**
    - **Validates: Requirements 15.2, 15.3**

- [x] 4. Timer and best times
  - [x] 4.1 Implement `src/logic/timer.ts`
    - Export `TIME_LIMIT_SECONDS` (120), the `Clock` interface, `systemClock` (`performance.now` and `window.setInterval`), `remainingSeconds` (ceil of the monotonic difference, clamped 0 to 120), `elapsedSeconds`, `formatTime` (`m:ss`), `parseTime`, and `announcementFor` (smallest threshold in 60, 30, 10, 0 crossed)
    - No `fetch`-style words anywhere in comments
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.10, 7.11, 11.1, 14.7_

  - [x] 4.2 Implement `test/support/fakeClock.ts`
    - `createFakeClock()` returns a `Clock` plus `advance(ms)` that moves `nowMs` and fires due intervals synchronously, so tests never wait in real time
    - _Requirements: 7.11_

  - [x] 4.3 Write property test for time format round trip
    - File `src/logic/timer.format.property.test.ts`
    - **Property 8: Time format round trip**
    - **Validates: Requirements 7.10, 11.1**

  - [x] 4.4 Write property test for remaining and elapsed time
    - File `src/logic/timer.remaining.property.test.ts`
    - **Property 9: Remaining and elapsed time derive from the monotonic difference**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.6**

  - [x] 4.5 Write property test for announcement thresholds
    - File `src/logic/timer.announce.property.test.ts`
    - **Property 10: Announcements fire only at the thresholds**
    - **Validates: Requirements 14.7**

  - [x] 4.6 Implement `src/logic/bestTimes.ts`
    - Export `StorageLike`, `bestKey` (one item per drill-and-method pair, `mch.best.v1:${method}:${drillId}`), `updateBest`, `parseStoredSeconds`, `SubmitOutcome`, `BestTimesStore`, and `createBestTimesStore(storage)` with an in-memory shadow map, `persistent` flag, and no thrown errors from a missing or throwing storage
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6, 12.7, 12.8, 12.9_

  - [x] 4.7 Write property test for the best-time update
    - File `src/logic/bestTimes.update.property.test.ts`
    - **Property 11: Best-time update is the minimum and idempotent**
    - **Validates: Requirements 12.3, 12.4, 12.6, 11.10**

  - [x] 4.8 Write property test for the storage round trip
    - File `src/logic/bestTimes.roundtrip.property.test.ts`
    - **Property 12: Stored best times round trip**
    - **Validates: Requirements 12.1, 12.7**

  - [x] 4.9 Write property test for corrupt or failing storage
    - File `src/logic/bestTimes.corrupt.property.test.ts`
    - **Property 13: Corrupt or failing storage never breaks the store**
    - **Validates: Requirements 12.8, 12.9**

- [x] 5. Step engine and pick builder
  - [x] 5.1 Implement test generators in `test/support/buildTree.ts` and `test/support/arbitraries.ts`
    - `arbTrail(kind)` for main-chapter, Chapter 9 table, annex, Article 90, and index trails that pass `validateCodeTrail`; `treeFromTrails(trails, movedFrom?, decoys)` that derives a consistent Option_Tree, adds 0 to 6 wrong nodes per level, and sets the right `hasParts`; `arbDrill`, `arbStorage`, `arbBuildEnv`, `arbDrillList`, `arbUrl`
    - Generators import types only from src/model (task 2.1) and StorageLike from src/logic/bestTimes (task 4.6). arbBuildEnv returns plain { PROD, MODE } objects and arbDrillList returns plain DrillRecord arrays; neither imports from src/logic/filterDrills (task 3.1).
    - Test-only files; production code never imports them
    - _Requirements: 17.18, 17.19_

  - [x] 5.2 Write a unit test for the generators
    - File `test/support/arbitraries.test.ts`: every generated trail passes `validateCodeTrail`, and every generated tree/trail pair passes a route-equals-trail check
    - _Requirements: 17.18_

  - [x] 5.3 Implement `src/logic/stepEngine.ts`
    - Export `FlowState`, `OptionView`, `ClickView`, `StepLabel`, `StepView`, `FlowView`, `treeFor`, `optionsAt` (chapter level completed to nine), `resolvePath`, `nextStepLevel` (Article uses its has-Parts marker), `stepLabelAt`, `applyPick` (clears every later pick; the first Index click clears the second click, the second keeps the first), `canCheck`, and `viewFlow` (groups the first Index click and its follow-up click into one `index` step with one heading; sets `showRowNote` for a Chapter 9 table path)
    - Picks and depth are indexed by click
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.7, 8.8, 8.9, 8.10, 8.12, 8.13, 8.14, 9.1, 9.2, 9.4, 9.5, 9.6, 9.8, 9.10_

  - [x] 5.4 Write property test for changing an earlier pick
    - File `src/logic/stepEngine.applyPick.property.test.ts`
    - **Property 15: Changing an earlier pick clears every later pick**
    - **Validates: Requirements 8.10, 6.6**

  - [x] 5.5 Write property test for visible steps
    - File `src/logic/stepEngine.visible.property.test.ts`
    - **Property 16: Only the next click is visible after each pick**
    - **Validates: Requirements 8.1, 8.2, 8.3, 9.4, 9.5**

  - [x] 5.6 Write property test for the Check rule
    - File `src/logic/stepEngine.canCheck.property.test.ts`
    - **Property 17: Check is enabled if and only if the path ends**
    - **Validates: Requirements 8.8, 8.9, 9.6**

  - [x] 5.7 Write property test for has-Parts branching
    - File `src/logic/stepEngine.hasParts.property.test.ts`
    - **Property 18: Branches follow the has-Parts marker**
    - **Validates: Requirements 9.1, 9.2**

  - [x] 5.8 Write property test for the Chapter 9 Row line
    - File `src/logic/stepEngine.rowNote.property.test.ts`
    - **Property 19: Chapter 9 table branch shows a Row line but never a Row pick**
    - **Validates: Requirements 8.13, 9.1, 9.10**

  - [x] 5.9 Implement `src/logic/pickBuilder.ts`
    - Export `buildGradePicks(path)` (excludes the Keyword node, keeps click order, copies values verbatim, two picks for the Index step) and `keywordOf(path)`
    - _Requirements: 8.5, 8.6, 9.3, 9.7, 10.1_

  - [x] 5.10 Write property test for the pick builder
    - File `src/logic/pickBuilder.property.test.ts`
    - **Property 20: Picks passed to the Core exclude the Keyword, keep order, and never use NO_PARTS**
    - **Validates: Requirements 8.5, 8.6, 9.3, 9.7, 10.1**

- [x] 6. Grading adapter and attempt reducer
  - [x] 6.1 Implement `src/logic/grading.ts`
    - Export `Verdict`, `GradingSelection`, `selectGradingInput` (case (a) same-keyword trails with `movedFrom` only for toc and a matching keyword; case (b) all method trails, no `movedFrom`, keyword incorrect), `ResultRow`, `ResultModel`, `GradeDeps`, and `gradeAttempt` that calls `gradeTrail` exactly once (also with zero picks)
    - Build rows: Keyword row first; step rows in the Core's `stepResults` order including the synthetic Part row; `extra` rows for picks beyond the Core rows; `unanswered` for any step with no pick (Keyword included, also at expiry); `forkSentence` only on matching levels and only when present; `row-line` row only with a `tableWalk`; `matchedMovedFrom` yields `overall: "incorrect"`, `verdictsAgainst: "2023"`, and the `editionNote`
    - `pickText` comes from `resolveDisplay`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12, 10.13, 11.2, 11.6, 11.7, 11.8, 11.9, 11.13_

  - [x] 6.2 Write property test for grading input selection
    - File `src/logic/grading.selection.property.test.ts`; count `gradeTrail` calls through the `GradeDeps` seam
    - **Property 21: Grading input selection**
    - **Validates: Requirements 10.2, 10.3, 10.4, 10.5**

  - [x] 6.3 Write property test for grading determinism
    - File `src/logic/grading.deterministic.property.test.ts`
    - **Property 22: Grading is deterministic**
    - **Validates: Requirements 10.12**

  - [x] 6.4 Write property test for same-trail grading
    - File `src/logic/grading.sameTrail.property.test.ts`
    - **Property 23: Keyword and remaining picks must come from the same trail**
    - **Validates: Requirements 10.11, 10.13**

  - [x] 6.5 Write property test for result rows
    - File `src/logic/grading.rows.property.test.ts`
    - **Property 24: Result rows are built from the Core result**
    - **Validates: Requirements 10.5, 10.6, 10.7, 10.8, 11.2, 11.6, 11.9, 11.13**

  - [x] 6.6 Write property test for the overall result
    - File `src/logic/grading.overall.property.test.ts`
    - **Property 25: Overall result requires a matched same-trail path**
    - **Validates: Requirements 7.5, 10.9, 10.10, 10.11, 11.7, 11.8, 11.9**

  - [x] 6.7 Implement `src/logic/attempt.ts`
    - Export `AttemptState`, `AttemptEvent`, `createAttemptReducer(names, deps?)` with the design's rules for `START`, `PICK`, `SELECT_METHOD` (ignored when not offered, unchanged when same, clears picks and keeps the timer when different), `TICK`, `CHECK` (expiry wins when remaining is already 0), `RESTART` (keeps the method), and `LEAVE`; `checked` and `expired` ignore `PICK`, `SELECT_METHOD`, and `CHECK`
    - Also export the pure helper `bestTimeToSubmit(state)` returning `{ drillId, method, elapsedSeconds }` only for `checked` with `result.overall === "correct"`, otherwise `null`; `DrillScreen` calls the store through it
    - The reducer takes clock readings from event payloads and imports no DOM
    - _Requirements: 6.6, 6.7, 7.1, 7.5, 7.6, 7.7, 7.8, 7.9, 11.11, 11.14, 12.5_

  - [x] 6.8 Write property test for method switching
    - File `src/logic/attempt.switch.property.test.ts`
    - **Property 27: Method switch keeps the timer and clears picks**
    - **Validates: Requirements 6.6, 6.7**

  - [x] 6.9 Write property test for expiry
    - File `src/logic/attempt.expiry.property.test.ts`
    - **Property 28: Expiry freezes the attempt**
    - **Validates: Requirements 7.5, 7.6, 10.5, 10.8**

  - [x] 6.10 Write property test for best-time writes
    - File `src/logic/attempt.bestTimes.property.test.ts`; drive generated event sequences through the reducer and `bestTimeToSubmit` into an in-memory store
    - **Property 14: Best times change only for correct, checked attempts**
    - **Validates: Requirements 7.7, 7.8, 11.14, 12.5**

- [x] 7. Checkpoint — pure logic
  - From the repository root run `npm run verify`; it must pass for both `packages/skeleton-core` and `midnight-code-hunt`. Fix any failure in the app only. Ensure all tests pass, ask the user if questions arise.

- [x] 8. Data layer and test fixtures
  - [x] 8.1 Create the Checked_Names_Files
    - `src/data/checkedNames2023.ts` and `src/data/checkedNames2026.ts`, each exporting one `CheckedNamesFile` with the right `edition` and an EMPTY `entries` array
    - The founder adds entries (all `checked: false` until the founder confirms the printed wording against the matching edition); no task invents a printed heading
    - _Requirements: 3.1, 3.5, 3.6_

  - [x] 8.2 Create the EMPTY Drill_Library
    - `src/data/drillLibrary.ts` exporting `DRILL_LIBRARY: readonly DrillRecord[] = []`
    - Header comment (no `fetch`-style words, no NEC text): the founder supplies every question, answer, trail, hint, Index entry, and citation; every new record starts with `founder_checked`, `index_checked`, and `wrongOptionsReviewed` all `false`; Kiro may draft only wrong options, only when the founder asks, and a record with drafted wrong options keeps `wrongOptionsReviewed: false`; any table-sourced value uses `makeTableValue` with a `source` naming the table and `nfpa_checked: false`
    - Do NOT add any real or sample drill, Index entry, or NEC citation
    - _Requirements: 2.1, 2.9, 2.10, 4.7, 16.2, 16.3_

  - [x] 8.3 Implement `src/data/validateDrillData.ts`
    - Export `DataIssue` and `validateDrillData(drills, names)`; pure, total, never throws; used only by tests
    - Rules: duplicate ids (R2.13), field lengths (R2.14), `validateCodeTrail` (R17.2), every declared trail graded `matched` against its own method's same-keyword trails (R17.4), `movedFrom` is a toc trail and grades `matchedMovedFrom` (R17.6), every trail reachable through the tree and no phantom all-`correct` route (R17.9), `moved` nodes only on the `movedFrom` route and never in the Index tree, every path ends at a node with no `next`, non-empty Keyword level, one level per sibling group, wrong-option values never equal to a valid or `movedFrom` value at the same position (R2.12), cap of 0 to 6 wrong nodes per level with the toc Chapter level exempt and holding the nine fixed options (R2.5), has-Parts marker present and consistent (R17.9-hasParts), `founder_checked` with `wrongOptionsReviewed` false (R2.11), `nameKey` resolution by edition (R3.8), checked entry with no printed wording (R3.4), names-file key and description limits (R3.1/R3.6), no node value that normalizes to `none`, `trees.index` present exactly when `index_checked` (R6.4)
    - _Requirements: 2.5, 2.11, 2.12, 2.13, 2.14, 2.16, 3.4, 3.8, 6.4, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9_

  - [x] 8.4 Create the fictional drill fixtures
    - Files under `test/fixtures/` (never imported by non-test files in `src/`), each marked fictional in its content: an Article with Parts; an Article with no Parts; a Chapter 9 table with a `tableWalk`; an Index route with a subdivision; a drill with `movedFrom` and `editionNote`; a drill with two valid trails of one method and different keywords; a decoy Article with `hasParts: true` on a part-less trail
    - All NEC-looking numbers are made up and unverified; `founder_checked`, `index_checked`, and `wrongOptionsReviewed` as each case needs; trees built with `treeFromTrails`
    - _Requirements: 2.15, 2.17, 17.19, 17.20_

  - [x] 8.5 Create the fictional names files and broken-drill fixtures
    - Files under `test/fixtures/`: fictional 2023 and 2026 `CheckedNamesFile` values with checked, unchecked, and inconsistent entries; one deliberately broken drill per validator rule, each recording the expected rule code and drill `id`
    - _Requirements: 3.4, 3.8, 17.19_

  - [x] 8.6 Write property test for trail and tree agreement
    - File `test/data/drillData.agreement.property.test.ts`
    - **Property 26: Declared trails and Option_Trees agree**
    - **Validates: Requirements 17.1, 17.3, 17.4, 17.5, 17.6, 17.9, 2.12, 2.16**

  - [x] 8.7 Write property test for the Chapter cap exemption
    - File `test/data/drillData.cap.property.test.ts`
    - **Property 30: The Chapter step is exempt from the wrong-option cap**
    - **Validates: Requirements 2.5, 9.8**

- [x] 9. Theme, shell, Halloween motifs, and shared UI
  - [x] 9.1 Implement `src/config.ts` and `src/ui/providers.tsx`
    - `config.ts` reads `import.meta.env` once and exports `SWITCHER_URL` (via `parseSwitcherUrl`) and `BUILD_MODE` (via `getBuildMode`)
    - `providers.tsx` exports `ClockContext`, `BestTimesContext`, `NamesContext`, and `AnnouncerContext` with hooks, so tests can inject a fake clock
    - _Requirements: 4.2, 7.11, 12.8, 15.1, 15.2, 15.3_

  - [x] 9.2 Implement the theme and base styles
    - `src/styles/theme.css`: a Tailwind `@theme` block that is the ONLY place `#050607` and `oklch(0.83 0.185 88)` appear, plus derived surface, ink, muted, danger, and ok tokens
    - Edit `src/styles/index.css`: import the theme; add the `prefers-reduced-motion: reduce` rule that disables animation and transition; add a `:focus-visible` outline of 3px in the primary color with a 2px offset; system font stack, no external font or image
    - _Requirements: 13.4, 13.6, 13.7, 13.8, 14.3_

  - [x] 9.3 Create the Halloween SVG motifs
    - `src/ui/motifs/Moon.tsx`, `Bat.tsx`, `Cobweb.tsx` as inline SVG, `aria-hidden`, `pointer-events-none`, positioned behind content
    - _Requirements: 13.5, 13.6, 13.9_

  - [x] 9.4 Implement `Footer.tsx` and `SwitcherLink.tsx`
    - `Footer` renders `FOOTER_DISCLAIMER` unchanged; `SwitcherLink` takes `href: string | null` and renders an anchor with text "Dead Circuit Check" or renders nothing for `null`
    - _Requirements: 15.2, 15.3, 15.5, 15.6, 15.7_

  - [x] 9.5 Implement `src/ui/Shell.tsx`
    - One `<h1>` per screen via a `title` prop, motifs on every screen, `SwitcherLink`, `Footer`, the single polite live region mounted before any announcement, and a `<main>` landmark; mobile-first Tailwind layout (`max-w-3xl`, reflow with `md:`), 44 px minimum targets and 8 px gaps via shared classes
    - _Requirements: 13.1, 13.2, 13.5, 14.8, 14.10, 15.2, 15.3, 15.4, 15.5, 15.7_

  - [x] 9.6 Write tests for the footer and switcher link
    - File `src/ui/Footer.test.tsx`: footer text equals `FOOTER_DISCLAIMER`, the constant equals the required string character for character, and the footer shows on the picker, drill, and result screens; file `src/ui/SwitcherLink.test.tsx`: set, unset, empty, whitespace, over-length, and wrong-prefix values
    - _Requirements: 15.2, 15.3, 15.5, 15.6, 17.17_

- [x] 10. Timer, method selector, and step flow components
  - [x] 10.1 Implement `src/ui/TimerDisplay.tsx` with `useCountdown`
    - Visible `m:ss` text (`aria-hidden`), polling every 250 ms from the injected `Clock`, re-render only on a whole-second change, `TICK` dispatched with the clock reading, announcements posted to the app live region only at 60, 30, 10, and 0
    - _Requirements: 7.1, 7.2, 7.3, 14.7_

  - [x] 10.2 Implement `src/ui/MethodSelector.tsx`
    - `role="radiogroup"` with `role="radio"`, `aria-checked`, roving `tabIndex`; arrow keys move and select with wrap; a check-mark glyph marks the selected choice; Index Keyword Lookup first; one plain description sentence per method
    - _Requirements: 6.1, 6.5, 6.8, 6.9, 14.3, 14.4, 14.9_

  - [x] 10.3 Implement `src/ui/StepFlow.tsx`
    - One `<section>` and `<h2>` per labeled step; the Index step has one heading and two ordered option groups; options are buttons showing `resolveDisplay` text; answered clicks stay visible with the pick marked and can be changed; the Row line is plain text with no option; focus moves to the new step heading (or to the second Index group) within the same commit; no `NO_PARTS` control
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.8, 8.9, 8.10, 9.4, 9.7, 9.8, 9.10, 14.5, 14.11_

  - [x] 10.4 Write component tests for the Timer
    - File `src/ui/TimerDisplay.test.tsx` with the fake clock: starts at 2:00, display changes after each 1000 ms advance, stops on Check, expiry behavior, `m:ss` at 120, 61, 60, 9, and 0 seconds, live-region text only at 60, 30, 10, and 0
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 14.7, 17.13_

  - [x] 10.5 Write component tests for the Method_Selector
    - File `src/ui/MethodSelector.test.tsx`: `index_checked` true lists Index Keyword Lookup first and selected; false offers only Table of Contents Lookup and selected; arrow keys wrap and move focus; non-color selected marker
    - _Requirements: 6.1, 6.2, 6.3, 6.8, 6.9, 14.4, 17.12_

  - [x] 10.6 Write component tests for Index Keyword Lookup
    - File `src/ui/StepFlow.index.test.tsx`: Keyword, Index, and Section order; the Index step as one labeled step with two clicks and two core picks; a repeated Section step for a subdivision; changing the first Index click clears the second click and every later pick; changing the second keeps the first; Check disabled until the latest pick ends its path
    - _Requirements: 8.1, 8.3, 8.5, 8.8, 8.9, 8.10, 8.12, 17.10_

  - [x] 10.7 Write component tests for Table of Contents Lookup
    - File `src/ui/StepFlow.toc.test.tsx`: the branch with Parts, the branch without Parts, the Chapter 9 table branch with a non-interactive Row line, the nine Chapter labels word for word and in order, and no option or pick named `NO_PARTS`
    - _Requirements: 9.1, 9.2, 9.7, 9.8, 9.10, 17.11_

- [x] 11. Screens, app wiring, and flow tests
  - [x] 11.1 Implement `src/ui/DrillPicker.tsx`
    - Lists filtered entries with their labels, best times per method, the moved-between-editions label for `movedFrom`, the "Draft" text badge only for draft entries outside production, the empty message, the benefit line, and the 2026 NEC copy note; each drill is a `<button>`
    - _Requirements: 4.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [x] 11.2 Implement `src/ui/DrillScreen.tsx`
    - Question, `TimerDisplay`, `MethodSelector`, `StepFlow`, and a "Check my answer" button that is natively `disabled` unless `canCheck`; submits to the best-times store through `bestTimeToSubmit` when the state becomes `checked`
    - _Requirements: 7.4, 7.5, 7.8, 7.9, 8.8, 8.9, 12.3, 12.4, 14.5_

  - [x] 11.3 Implement `src/ui/ResultScreen.tsx`
    - Elapsed time, Keyword row, per-step rows with text verdicts, answer and citation, hint, the `https://sentinellearning.com` link above the action buttons, fork sentences only on their rows and only when present, the Table_Walk on the Row line, the moved-article message with `editionNote`, the time-ran-out message, the new-best message only for a correct result, "Try again" and "Back to drills"; focus moves to the heading on mount; no pass or score promise
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13, 11.14, 14.6, 14.8, 15.4_

  - [x] 11.4 Wire `src/App.tsx`
    - Replace the placeholder: providers (`systemClock`, the best-times store over `localStorage`, the names index from the two data files, the announcer), `useReducer` with `createAttemptReducer`, the screen switch for picker, drill, and result, the storage-unavailable note, and an error boundary that shows the unavailable-drill message with a "Back to drills" button
    - _Requirements: 1.10, 5.1, 7.9, 12.8, 14.6, 14.8, 17.9_

  - [x] 11.5 Write component tests for the Drill_Picker
    - File `src/ui/DrillPicker.test.tsx`: lists filtered drills, best times per method, the moved label, the Draft badge in test mode and none in production, and the empty-library messages
    - _Requirements: 4.7, 5.1, 5.2, 5.3, 5.4, 5.8, 5.9, 5.10, 17.16_

  - [x] 11.6 Write component tests for the grading flow
    - File `src/ui/App.grading.test.tsx` (full app, fake clock, fixtures): correct Keyword_Pick with a wrong path; wrong Keyword_Pick with a matching path (incorrect, no best time written); `movedFrom` used only under Table of Contents Lookup; a synthetic Part row shown as incorrect
    - _Requirements: 10.2, 10.3, 10.4, 10.7, 10.11, 12.5, 17.14_

  - [x] 11.7 Write component tests for the Result_Screen
    - File `src/ui/ResultScreen.test.tsx`: elapsed time, Keyword row, per-step verdicts with text labels, answer with citation, hint, the sentinellearning.com link, fork sentences only when present, the Table_Walk, and the moved-article message with `editionNote`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.13, 17.15_

  - [x] 11.8 Write component tests for two valid trails of one method
    - File `src/ui/App.twoTrails.test.tsx` using the two-trail fixture: either keyword gives a correct Keyword row; keyword of trail A with the steps of trail B gives an incorrect overall result and saves no best time; one trail's keyword and steps give a correct overall result; a Keyword_Pick equal to the `movedFrom` keyword only gives an incorrect Keyword row and no moved-article message
    - _Requirements: 10.3, 10.11, 10.13, 12.5, 17.21_

  - [x] 11.9 Write focus and accessibility tests
    - File `src/ui/App.a11y.test.tsx`: Tab and Shift+Tab reach every control in reading order; Enter and Space operate buttons; focus moves to the next step heading and to the Result heading; exactly one `<h1>` per screen; `<html lang="en">`; disabled controls are natively `disabled`; accessible names contain visible text; the result announcement is posted to the live region; no Switcher_Link element and no error when the URL is unset
    - _Requirements: 13.1, 13.2, 14.1, 14.2, 14.5, 14.6, 14.8, 14.9, 14.10, 14.11, 15.3_

- [x] 12. Checkpoint — components
  - From the repository root run `npm run verify`; it must pass for both workspaces. Ensure all tests pass, ask the user if questions arise.

- [x] 13. Data test, content scan, static and bundle checks
  - [x] 13.1 Write the data test
    - File `test/data/drillData.test.ts`: run `validateDrillData` over `DRILL_LIBRARY` (zero issues; on failure print drill `id`, rule, and message) and over the valid fixtures; the library assertion passes while the library is empty and the fixture assertions still run; runs whatever `founder_checked` is
    - _Requirements: 2.11, 2.12, 2.13, 2.14, 3.8, 4.8, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.20_

  - [x] 13.2 Write the broken-fixture test
    - File `test/data/drillData.broken.test.ts`: each deliberately broken fixture must produce exactly its expected rule code and drill `id`; include a fixture with eight generated wrong Chapter nodes that passes and one with seven wrong nodes at a Section level that fails R2.5
    - _Requirements: 17.2, 17.4, 17.6, 17.7, 17.8, 17.9_

  - [x] 13.3 Write the content-scan test and banned-term list
    - `test/support/bannedTerms.ts` is the ONLY file holding the banned-term list (the terms barred by rules 3, 4, 8, and 9 of the nec-rules steering file, the retired method name, the tab words, gendered pronouns, pass-guarantee phrases, numeric time-savings figures); `test/content/content-scan.test.ts` scans every non-test file under `src/` plus `index.html`, `README.md`, `.env.example`, and `public/` when present, whole-word and case-insensitive, excluding the list file by path, and reports each file path and matched phrase; `test/support/bannedTerms.test.ts` proves each pattern matches a positive sample and ignores a negative one (for example "table")
    - _Requirements: 1.11, 16.1, 16.4, 16.5, 16.6, 16.7, 16.8, 16.13_

  - [x] 13.4 Write the reading-level test
    - `test/support/readingLevel.ts` (Flesch-Kincaid grade with a documented vowel-group syllable counter, plus average sentence length) with its own unit test `test/support/readingLevel.test.ts`; `test/content/reading-level.test.ts` asserts every `PROSE` string set has average sentence length of 15 words or fewer and grade 7.0 or lower; `FIXED` strings are exempt
    - _Requirements: 16.9_

  - [x] 13.5 Write the token, contrast, motion, and external-request tests
    - `test/content/tokens.test.ts`: `#050607` and `oklch(0.83 0.185 88)` each appear in exactly one file under `src/`, `styles/theme.css`; `test/support/contrast.ts` and `test/content/contrast.test.ts`: WCAG ratios at least 4.5:1 for body and muted text and verdict text, at least 3:1 for the focus outline and interface boundaries; `test/content/motion.test.ts`: `index.css` contains the reduced-motion rule; `test/content/external.test.ts`: no external image or font URL in `index.html` or `src/`, and the only absolute URL in source is the Sentinel link
    - _Requirements: 13.4, 13.6, 13.7, 13.8, 14.3_

  - [x] 13.6 Write tests for the static and bundle scripts
    - File `scripts/check-static.test.ts` and `scripts/check-bundle.test.ts`: run each script against temp directories and assert non-zero exit naming each offending file for a network word, a deep Core import, and a `fast-check` import in a non-test file, and zero exit for clean source
    - `check-static.test.ts` asserts the test-import rule in both directions: a non-test file under `src/` that imports `test/` (or a fixtures folder) fails and is named in the output; a `*.test.ts` or `*.test.tsx` file under `src/` that imports `test/support` or `test/fixtures` passes
    - _Requirements: 1.9, 1.11, 1.12, 17.19_

  - [x] 13.7 Write the root verify propagation test
    - File `scripts/rootVerify.test.ts`: build a temp workspace whose app `verify` script exits non-zero and assert the root `npm run verify --workspaces --if-present` exits non-zero; assert a passing workspace exits zero
    - _Requirements: 1.5, 1.12_

  - [x] 13.8 Write the copy-rules test
    - File `test/content/copy-rules.test.ts`: no `PROSE` or `FIXED` string contains a numeric time-savings figure or a step count; every place a Method is named uses one of the two exact labels; the Method labels, Chapter labels, and footer equal their required text
    - _Requirements: 16.10, 16.11, 16.12_

- [x] 14. Final checkpoint — whole repository
  - From the repository root run `npm run verify`; it must pass for `packages/skeleton-core` and `midnight-code-hunt` (typecheck, static check, tests, build, bundle check). Confirm `git status` shows no change under `packages/skeleton-core/`. Ensure all tests pass, ask the user if questions arise.

- [x] 15. Clean-clone proof
  - [x] 15.1 Prove the repository verifies from a clean copy
    - Copy the repository to a temp folder, excluding `node_modules`, `dist`, `dist-test-utils`, and any other build output (for example with `rsync` and excludes)
    - In the temp folder run `npm install` and then `npm run verify`; confirm the root command passes for both workspaces without any pre-built `packages/skeleton-core/dist/`
    - Show the command results in the task output, then delete the temp folder
    - _Requirements: 1.5, 1.12_

- [ ] 16. Guided mode
  - [ ] 16.1 Add the optional `why` field to the Option type
    - Edit only `src/model/types.ts`: add `readonly why?: string` to `NodeBase` with the comment from the design (founder content, one sentence of 1 to 300 characters, only on `correct` Options, not a fork sentence)
    - Change nothing else; every existing builder and test keeps compiling because the field is optional
    - _Requirements: 20.1, 20.2, 20.4_

  - [ ] 16.2 Define every Guided string up front
    - Edit only `src/copy/strings.ts`. FIXED: the labels "Guided", "Timed", "Show the full path", "Run this drill Timed", and the Guided_End_Screen heading. PROSE (each sentence at most 15 words, grade 7.0 or lower): the one-sentence mode descriptions for the picker, the "correct" and "incorrect" verdict lines, the "incorrect, pick again" sentence, the path-complete text, and the end-screen intro. Add `ANNOUNCE.guided(verdict, why?)` and `ANNOUNCE.guidedDone`
    - Reuse the existing verdict labels ("correct", "incorrect"), `backButton`, `sentinelLinkText`, `answerLabel`, `citationLabel`, `hintLabel`, and the step headings; do not copy them
    - No string holds a step count or a progress counter, a pass or score promise, a gendered term, or a numeric time-savings figure; "Guided" and "Timed" are never used as Method names; write no Why_Sentence (those are founder content)
    - _Requirements: 18.1, 18.7, 19.4, 19.7, 19.9, 19.16, 21.2, 21.6, 21.7_

  - [ ] 16.3 Let `DrillScreen` start with a chosen Method
    - Edit only `src/ui/DrillScreen.tsx` and add two tests to `src/ui/DrillScreen.test.tsx`: an optional `initialMethod?: MethodId` prop; when set and offered by the drill, the lazy initializer dispatches `START` then `SELECT_METHOD(initialMethod)`; when absent the code path is exactly as today
    - Tests: with `initialMethod` set the selected Method is that Method, picks are empty, and the timer shows 2:00; without it the default Method is selected (the existing assertions stay as they are)
    - _Requirements: 18.5, 21.6, 7.1, 6.2_

  - [ ] 16.4 Validate Why_Sentences in the data validator
    - Edit only `src/data/validateDrillData.ts`: walk both trees for every node; rule codes `R20.2-length` (string, 1 to 300 after trim), `R20.2-sentence` (the same one-sentence test the fork sentences use; extract it to one shared helper inside the file), and `R20.4-role` (`why` only on `correct` nodes); each issue names the drill `id`, the field, and the node value
    - A drill with no `why` anywhere yields no issue from these rules
    - _Requirements: 20.2, 20.4, 20.6, 22.1_

  - [ ] 16.5 Implement `src/logic/guided.ts`
    - Export `PickJudgement`, `judgePick`, `GuidedFeedback`, `GuidedState`, `GuidedEvent`, `createGuidedReducer(deps?)`, `GuidedView`, `viewGuided`, `PathRow`, and `guidedPathRows`, exactly as the design gives them
    - `PathRow` keyword and step rows carry an optional `why`; `guidedPathRows` resolves the accepted path once and copies each node's `why` onto its row (property absent when the node has none, never an empty string); the row-line has none; it reads no fork sentence and builds no moved-article text
    - `judgePick` uses `treeFor`, `optionsAt`, `resolvePath`, `selectGradingInput`, `buildGradePicks`, and one `deps.gradeTrail` call per pick at depth 1 or more, with `movedFrom` dropped; depth 0 uses `keywordCorrect`; correct means the first N results are all correct
    - The reducer follows the rules in the design: depth must equal `picks.length`, a wrong pick is never stored, `SELECT_METHOD` clears picks and feedback, `FINISH` only when the path has ended, `LEAVE` goes to `idle`
    - Import neither `timer.ts` nor `bestTimes.ts`, no React, no DOM; no network-call words in comments
    - _Requirements: 19.1, 19.3, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10, 19.13, 19.17, 20.11, 21.3, 10.1_

  - [ ] 16.6 Let the test generators add Why_Sentences
    - Edit `test/support/buildTree.ts`, `test/support/arbitraries.ts`, and `test/support/arbitraries.test.ts`: an option to give any subset of `correct` nodes (Keyword nodes included) a one-sentence `why` of 1 to 300 characters; default output stays as it is today so existing property tests are unaffected; add the broken-why generators (empty, over 300, two sentences, `why` on a `wrong` or `moved` node)
    - Extend the generator unit test: generated drills with `why` still pass `validateDrillData`; generated broken-why drills do not
    - _Requirements: 20.1, 20.2, 20.4, 22.9_

  - [ ] 16.7 Create the fictional Guided fixtures
    - New file `test/fixtures/guidedDrills.ts` (marked fictional, never imported by non-test files in `src/`): derive from the existing fixture drills (an Article with Parts, an Article with no Parts, a Chapter 9 table with a `tableWalk`, an Index route with a subdivision) with these variants: a `why` on every correct Option; a `why` on only some Options, one case with a Keyword `why` and one without; none at all; an Index drill with a `why` on each of the two Index clicks; at least one variant with a `why` on the Keyword Option, on a Section Option, and on the Table Option, and one drill that sets both `chapterForkSentence` and `articleForkSentence` as well as `why` sentences, so tests can prove the end screen shows only the `why` sentences
    - Every sentence says it is made up; all NEC-looking numbers are fictional and unverified
    - _Requirements: 20.5, 20.6, 22.2_

  - [ ] 16.8 Create the broken Why_Sentence fixtures
    - Edit only `test/fixtures/brokenDrills.ts`: one broken case per rule code `R20.2-length` (empty or whitespace-only, and over 300 characters), `R20.2-sentence` (two sentences), and `R20.4-role` (a `why` on a `wrong` Option and a `why` on a `moved` Option), each recording its expected rule code and drill `id`, built by minimally mutating an existing fixture
    - _Requirements: 22.3_

  - [ ] 16.9 Add the two mode buttons to the Drill_Picker
    - Edit only `src/ui/DrillPicker.tsx`: `onOpen(drillId, mode)` with `mode` `"guided" | "timed"`; per drill, one label, one Draft badge, one moved label, and one best-time list, then two native buttons, "Guided" first and "Timed" second; each button's accessible name contains its visible text and names the drill (for example `aria-labelledby` with the drill label's id and the button's own id); 44 px targets and 8 px gaps through the shared layout classes
    - No change to filtering, best-time display, empty messages, or notes
    - _Requirements: 18.1, 18.2, 18.6, 5.1, 5.3, 5.8, 5.9, 13.2, 14.9_

  - [ ] 16.10 Extend the copy-rules test for Guided
    - Edit only `test/content/copy-rules.test.ts`: the labels "Guided" and "Timed" are exact; neither word appears next to a Method label as its name; no Guided string matches a step count or a progress counter such as "2 of 5" or "step 2"; the Method labels are unchanged. The reading-level and content-scan tests already cover every `PROSE` string and every file under `src/`, so no edit is needed there
    - _Requirements: 18.7, 19.16, 22.10, 16.11, 16.12_

  - [ ] 16.11 Implement `src/ui/GuidedStepFlow.tsx`
    - One `<section>` and `<h2>` per labeled step with the same headings as `StepFlow`; an answered click shows only the accepted pick with a check mark, the text "correct", and its Why_Sentence as plain text when present; the open click shows its Options as enabled buttons with the tried wrong Option marked in text; the newest verdict is a text line with a non-color marker; the Index step is one heading with two ordered groups; the Row line is plain text; no `NO_PARTS` control; focus moves to the new step heading or to the second Index group in the same commit, and stays on the Option after an incorrect pick
    - _Requirements: 19.3, 19.4, 19.6, 19.7, 19.8, 19.15, 20.10, 14.5, 13.2_

  - [ ] 16.12 Implement `src/ui/GuidedEndScreen.tsx`
    - Heading focused on mount, path rows from `guidedPathRows` where each row shows the step label, the pick text, and, only when the row has a `why`, that sentence as plain text under the pick (no placeholder element and no empty space when it has none; the Keyword row and both Index rows included), the Row line only with a Table_Walk and with no sentence, the answer and citation, the hint, the `https://sentinellearning.com` link above the buttons, "Run this drill Timed" before "Back to drills", the path-complete announcement; no timer, elapsed time, overall result, fork sentence, or moved-article message; no best-times context use
    - _Requirements: 20.10, 20.11, 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 14.6, 15.4_

  - [ ] 16.13 Write property test for Why_Sentence validation
    - File `test/data/drillData.why.property.test.ts`
    - **Property 37: Why sentences are optional and validated**
    - **Validates: Requirements 20.2, 20.4, 20.6, 22.1**

  - [ ] 16.14 Extend the data tests for Guided fixtures
    - Edit `test/data/drillData.test.ts`: run `validateDrillData` over the valid Guided fixtures (with all, some, and no `why`) and expect zero issues; the library assertion still runs and still passes with founder drills that have no `why`
    - Edit `test/data/brokenFixtures.test.ts`: each broken Why_Sentence fixture produces exactly its expected rule code and drill `id`
    - _Requirements: 20.6, 22.1, 22.2, 22.3_

  - [ ] 16.15 Write property test for the Guided verdict
    - File `src/logic/guided.verdict.property.test.ts`; the oracle is an independent prefix check against the declared trails that does not call the Core
    - **Property 31: A Guided verdict is prefix membership, decided by the Core**
    - **Validates: Requirements 19.5, 19.13, 10.1, 10.11**

  - [ ] 16.16 Write property tests for the Guided reducer
    - File `src/logic/guided.flow.property.test.ts`
    - **Property 32: A wrong pick changes nothing that was accepted**
    - **Property 33: A correct pick appends one pick and opens the next click**
    - **Property 34: Accepted picks are final and finished screens are frozen**
    - **Validates: Requirements 19.6, 19.7, 19.8, 19.9, 20.3, 20.6**

  - [ ] 16.17 Write property test for the Guided Method choice
    - File `src/logic/guided.switch.property.test.ts`
    - **Property 35: Guided Method choice follows the same rule as Timed, without a timer**
    - **Validates: Requirements 19.10, 19.1**

  - [ ] 16.18 Write property test for the end-screen rows
    - File `src/logic/guided.rows.property.test.ts`; generate drills with `why` on any subset of correct Options (Keyword and both Index clicks included) and with both fork fields set; assert each row's `why` equals its Option's `why` or is absent, the Row line has none, and no fork text appears in any row
    - **Property 36: Guided end rows equal the accepted path**
    - **Validates: Requirements 21.3, 20.11**

  - [ ] 16.19 Write property test that Why_Sentences never change Timed
    - File `src/logic/guided.timedUnchanged.property.test.ts`; compare `viewFlow`, `gradeAttempt`, `selectGradingInput`, `canCheck`, and the attempt reducer output on a drill with and without `why` fields
    - **Property 38: Why sentences never change Timed**
    - **Validates: Requirements 18.5, 20.8**

  - [ ] 16.20 Write the Guided isolation test
    - File `src/logic/guided.isolation.test.ts`: the source of `src/logic/guided.ts` imports neither `timer` nor `bestTimes`, and a fast-check property shows the reducer result depends only on the events and the drill
    - **Property 39: Guided reads no clock and no store**
    - **Validates: Requirements 19.1, 19.11**

  - [ ] 16.21 Update the Drill_Picker tests
    - Edit only `src/ui/DrillPicker.test.tsx`: the two buttons per drill in the order Guided then Timed; distinct accessible names that contain the visible text; one Draft badge, one moved label, and one best-time list per drill; `onOpen` receives the drill id and the right mode; change only the queries that find the drill button, and keep every other assertion
    - _Requirements: 18.1, 18.2, 18.6, 22.7, 22.11_

  - [ ] 16.22 Implement `src/ui/GuidedScreen.tsx`
    - Find the entry as `DrillScreen` does (with the same unavailable-drill message and Back button); own `useReducer(createGuidedReducer())`; in `guiding` show the Draft rule, the question, the unchanged `MethodSelector`, `GuidedStepFlow`, and, when the path ended, an enabled "Show the full path" button that takes focus; in `finished` render `GuidedEndScreen`; post verdict announcements to the live region; no `TimerDisplay`, no Check button, no best-times context use; `onRunTimed(method)` and `onBack` go to the parent
    - _Requirements: 19.1, 19.2, 19.4, 19.6, 19.9, 19.10, 19.11, 19.12, 19.14, 21.1, 21.6, 14.8_

  - [ ] 16.23 Write component tests for the Guided step flow
    - File `src/ui/GuidedStepFlow.test.tsx` with the Guided fixtures: a correct pick shows verdict, Why_Sentence when present (only the verdict when absent), and opens the next step; a wrong pick shows "incorrect", no Why_Sentence, no correct answer, and allows a second pick; the Keyword Why_Sentence; the Index step with a Why_Sentence on each of its two clicks; with Parts, without Parts, and the Chapter 9 table with its non-interactive Row line; the nine Chapter labels; no `NO_PARTS`; accepted picks have no Option to change
    - _Requirements: 19.3, 19.4, 19.6, 19.7, 19.8, 19.17, 22.4_

  - [ ] 16.24 Write component tests for the Guided end screen
    - File `src/ui/GuidedEndScreen.test.tsx` with the Guided fixtures: the Keyword row and one row per accepted pick in order; each row's `why` shown under its pick when the Option has one (Keyword row and both Index rows included) and nothing extra, with no placeholder element, when it has none; no `why` on the Row line; the Row line only with a Table_Walk; answer, citation, hint; the sentinellearning.com link above the action buttons; both buttons call their handlers; no elapsed time, overall result, fork sentence (using the fixture that sets both fork fields), or moved-article message
    - _Requirements: 20.11, 21.3, 21.4, 21.5, 21.6, 21.7, 22.5_

  - [ ] 16.25 Wire Guided into `App`
    - Edit only `src/App.tsx`: split into `App` (reads the library, builds the names index, provides `NamesContext`) and an exported `AppView({ entries, buildMode })` that holds `{ drillId, mode, initialMethod }` and the screen switch, so tests can render the whole picker-to-screen wiring with fixture entries; `mode "guided"` renders `GuidedScreen`, `mode "timed"` renders `DrillScreen` with `initialMethod`; `onRunTimed(method)` sets `{ drillId, mode: "timed", initialMethod: method }`; the error boundary key includes the mode; the Shell title follows the drill label; the storage note stays on the picker only
    - _Requirements: 18.3, 18.4, 18.8, 19.12, 21.6, 17.9_

  - [ ] 16.26 Write component tests for the Guided screen
    - File `src/ui/GuidedScreen.test.tsx` with the Guided fixtures and a spy best-times store: for both Methods a full run from the first step to "Show the full path"; no Timer and no Check button; the Method choice clears picks and keeps working with arrow-key wrap; Index Keyword Lookup offered only when `index_checked`; a pick that matches only the `movedFrom` route is "incorrect" with no moved-article message; the spy store sees zero calls
    - _Requirements: 19.1, 19.2, 19.3, 19.9, 19.10, 19.11, 19.13, 22.4_

  - [ ] 16.27 Write the app-level Guided flow test
    - File `src/ui/App.guided.test.tsx` rendering `AppView` with fixture entries, a fake clock, and a counting `localStorage`: picker to Guided to end screen writes no item; "Run this drill Timed" opens the Drill_Screen for the same drill and Method at 2:00; a correct, checked Timed attempt then saves a best time and an incorrect one does not; "Back to drills" from each screen returns to the picker; the Switcher_Link rule and the footer text show on the Guided screen and the end screen
    - _Requirements: 18.3, 18.4, 18.8, 19.11, 21.6, 21.8, 15.2, 15.5, 22.6_

  - [ ] 16.28 Extend the accessibility and footer tests
    - Edit `src/ui/accessibility.test.tsx` (switch its Harness to `AppView`, keep every Timed assertion) and `src/ui/Footer.test.tsx` (add the Guided screen and the end screen): Tab order and Enter or Space on the Guided screen and end screen; focus moves to the next step heading, to the second Index group, to "Show the full path", and to the end-screen heading; focus stays on the Option after an incorrect pick; exactly one `<h1>` per screen; the verdict and path-complete text reach the live region; disabled controls are natively `disabled`; the footer text is identical on both new screens
    - _Requirements: 19.14, 19.15, 21.2, 21.9, 14.1, 14.2, 14.5, 14.8, 14.10, 15.5, 22.8_

- [ ] 17. Checkpoint — Guided mode
  - [ ] 17.1 Verify the whole repository
    - From the repository root run `npm run verify`; it must pass for `packages/skeleton-core` and `midnight-code-hunt` (typecheck, static check, tests, build, bundle check)
    - Confirm `git status` shows no change under `packages/skeleton-core/` and no change under `.kiro/steering/` other than the `product.md` update already made before the build (no task edits steering)
    - Confirm the Timed tests still assert everything they asserted before, apart from the picker queries (Requirement 22 criterion 11); ensure all tests pass, ask the user if questions arise
    - _Requirements: 1.5, 1.7, 18.5, 22.11_

- [ ] 18. Clean-clone proof for Guided mode
  - [ ] 18.1 Prove the repository verifies from a clean copy
    - Copy the repository to a temp folder, excluding `node_modules`, `dist`, `dist-test-utils`, and other build output
    - In the temp folder run `npm install` and then `npm run verify`; confirm the root command passes for both workspaces without any pre-built `packages/skeleton-core/dist/`
    - Show the command results in the task output, then delete the temp folder
    - _Requirements: 1.5, 1.12_

## Notes

- Every sub-task is required; there are no optional `*` markers in this plan.
- The founder supplies all drill content (questions, answers, trails, hints, Index entries, citations, printed names). Kiro may draft only wrong options, only when the founder asks, and a record with drafted wrong options keeps `wrongOptionsReviewed: false` and `founder_checked: false`. Founder review of content, printed names, Index entries, and NEC citations happens outside this task list; every NEC number and table value stays unverified until the founder confirms it against the NFPA 2026 source.
- The Drill_Library ships empty; tests use fictional fixtures in `test/fixtures/`, which no non-test file under `src/` imports.
- Property test files are split one per property, a refinement of the design's file table, so tasks never share a file within a wave.
- `bestTimeToSubmit` in `src/logic/attempt.ts` is a small pure helper added so Property 14 can be tested without rendering; the design's rule (save only from `checked` with a correct result) is unchanged.
- If a pinned version in task 1.2 is not on the registry at install time, record the substitute exact pin here.
- Guided (tasks 16 to 18): the Why_Sentences are founder content. No task writes one; fixtures hold made-up, marked-fictional sentences only. The founder-entered drills in `src/data/drillLibrary.ts` have no `why`, so Guided on them shows only verdicts until the founder adds sentences; the data test still passes for them.
- Guided changes no Timed behavior. The only edits to Timed files are `types.ts` (an optional field), `DrillPicker.tsx` (two buttons), and `DrillScreen.tsx` (an optional starting Method), plus the picker queries in existing tests. `chapterForkSentence` and `articleForkSentence` are not touched and stay separate from `why`.
- `.kiro/steering/product.md` was already updated, at the founder's request and outside this task list, to describe Guided and Timed for every drill, with the hand-holding and countdown wording kept for Timed. No task edits steering.
- No task changes `packages/skeleton-core`; the app resolves the Core's public `src/index.ts` through the alias in `vite.config.ts` and `tsconfig.json`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["1.7"] },
    { "id": 3, "tasks": ["1.6", "2.1", "3.6", "4.1", "4.6", "9.2", "9.3", "13.6", "13.7"] },
    { "id": 4, "tasks": ["2.3", "3.1", "4.2", "4.3", "4.4", "4.5", "5.1", "5.9", "8.2"] },
    { "id": 5, "tasks": ["2.2", "2.5", "2.7", "3.2", "3.3", "3.4", "3.5", "3.7", "4.7", "4.8", "4.9", "5.2", "5.10", "8.4"] },
    { "id": 6, "tasks": ["2.4", "2.6", "5.3", "6.1", "8.1", "9.1", "9.4", "10.2", "13.4", "13.8"] },
    { "id": 7, "tasks": ["5.4", "5.5", "5.6", "5.7", "5.8", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "8.3", "9.5", "10.3", "10.5"] },
    { "id": 8, "tasks": ["6.8", "6.9", "6.10", "8.5", "8.6", "8.7", "10.1", "10.7", "11.1", "11.3"] },
    { "id": 9, "tasks": ["11.2", "11.5", "11.7", "13.1", "13.2"] },
    { "id": 10, "tasks": ["10.4", "10.6", "11.4"] },
    { "id": 11, "tasks": ["9.6", "11.6", "11.8", "11.9", "13.3", "13.5"] },
    { "id": 12, "tasks": ["15.1"] },
    { "id": 13, "tasks": ["16.1", "16.2", "16.3"] },
    { "id": 14, "tasks": ["16.4", "16.5", "16.6", "16.7", "16.8", "16.9", "16.10"] },
    { "id": 15, "tasks": ["16.11", "16.12", "16.13", "16.14", "16.15", "16.16", "16.17", "16.18", "16.19", "16.20", "16.21"] },
    { "id": 16, "tasks": ["16.22", "16.23", "16.24"] },
    { "id": 17, "tasks": ["16.25", "16.26"] },
    { "id": 18, "tasks": ["16.27", "16.28"] },
    { "id": 19, "tasks": ["17.1"] },
    { "id": 20, "tasks": ["18.1"] }
  ]
}
```
