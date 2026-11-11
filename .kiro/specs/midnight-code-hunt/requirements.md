# Requirements Document

## Introduction

Midnight Code Hunt is App 1 of sentinel-skeleton, the Kiroween 2026 Skeleton Crew entry by Sentinel Learning Inc. It is a static React + Vite + Tailwind app in `midnight-code-hunt/` that trains electricians to find answers fast in their own 2026 NEC code book. The audience is exam takers who already know electrical terms, so the app gives no beginner hand-holding. The user picks a drill, reads one exam-style question, and works against a 2-minute countdown using one of two public methods:

- **Index Keyword Lookup** (the main method, always listed first and selected by default): pick the keyword (the Index heading word alone), pick the Index entry path and the number it gives, then walk the headings down, including lettered and numbered subdivisions, to the item that holds the answer.
- **Table of Contents Lookup** (the second method): pick the keyword, then the Chapter, the Article, the Part (only when the Article has Parts), and the Section. For a Chapter 9 table the steps are Keyword, Chapter, Table, and Row.

Each answer is shown as a code-path trail, and only the steps the user actually took are shown. No method name and no copy in the app carries a step count.

The app is built on `@sentinel/skeleton-core` and does not change it. Grading uses `gradeTrail`; drill structure is checked with `validateCodeTrail`; each drill wraps a `CodeTrailDef` built with `defineCodeTrail`. All app-specific types and data live in `midnight-code-hunt/`.

The Core's index leg was relaxed separately in the skeleton-core spec; this spec makes no Core changes.

The founder supplies every question, answer, trail, hint, and Index entry. Kiro may draft only the wrong options, and those stay marked for founder review. This document contains no real drill content and no verified NEC citations. Every NEC article, section, or table number that appears below is an illustrative example only and is unverified until the founder confirms it against the founder's NFPA 2026 source.

The grading semantics below come from the built core (`packages/skeleton-core/src/trail/grade.ts`, `validate.ts`, `types.ts`, `drill/types.ts`). The founder decisions that shaped this document are listed under "Founder decisions recorded" at the end. Every decision is resolved, including how the keyword is graded when a drill has several valid trails, and no question is open.

## Glossary

- **Midnight_Code_Hunt**: App 1, the static app in `midnight-code-hunt/`.
- **Core**: The `@sentinel/skeleton-core` package (`packages/skeleton-core`). This spec makes no change to it.
- **Drill_Record**: The app-level type in `midnight-code-hunt/` that wraps a Core `CodeTrailDef` and adds the app fields listed in Requirement 2. (Named Drill_Record to avoid confusion with the Core `DrillDef` type, which is the input type of `gradeTrail`.)
- **Drill_Library**: The data file in `midnight-code-hunt/` that exports every Drill_Record.
- **Grading_Input**: A Core `DrillDef` value (`trails` plus optional `movedFrom`) that Midnight_Code_Hunt builds from a Drill_Record for one Method and passes to `gradeTrail`.
- **Index_Keyword_Lookup**: The main method. Steps: Keyword (the Index heading word alone), Index (the entry path and the number it gives), then Section (walk the headings down). Lettered and numbered subdivisions are further Section steps.
- **Table_of_Contents_Lookup**: The second method. Steps for an Article with Parts: Keyword, Chapter, Article, Part, Section. Steps for an Article with no Parts: Keyword, Chapter, Article, Section. Steps for a Chapter 9 table: Keyword, Chapter, Table, Row. Lettered and numbered subdivisions are further Section steps.
- **Method**: Either Index_Keyword_Lookup or Table_of_Contents_Lookup.
- **Method_Selector**: The control that lets the user choose a Method for a drill.
- **Drill_Picker**: The screen that lists available drills.
- **Drill_Screen**: The screen that shows one question, the countdown, and the active Method's steps.
- **Timer**: The countdown on the Drill_Screen. Its limit is `TIME_LIMIT_SECONDS`, defined as 120.
- **Step_Flow**: The ordered sequence of choices a Method presents on the Drill_Screen. Its length varies with the options the user picks.
- **Option**: One choice the user can click at a step. It has a graded `value` (compared after trimming and lowercasing), a display text, a number-or-letter designator, an optional checked-names key, and, when the path continues, a next level in the drill data. An Article Option also carries a has-Parts marker.
- **Option_Tree**: The Option data of one Method for one drill. Each Option that has a next level points to the Options of that next level, so the data forms a tree (design hint).
- **Keyword_Pick**: The user's pick at the Keyword step. The app, not `gradeTrail`, grades it.
- **Overall_Result**: The outcome shown to the user. It is correct only when the Keyword_Pick is correct AND `gradeTrail` returns `matched` true for the Grading_Input defined in Requirement 10 criterion 2.
- **Wrong_Option**: An Option that is not the graded value of any valid trail at that step. Wrong options are the only drill content Kiro may draft.
- **Result_Screen**: The screen shown after the user checks an answer or the Timer reaches zero.
- **Chapter_Fork_Sentence**: An optional field (`chapterForkSentence`) on a Drill_Record holding one plain sentence that says why this Chapter.
- **Article_Fork_Sentence**: An optional field (`articleForkSentence`) on a Drill_Record holding one plain sentence that says why this Article, by title.
- **Table_Walk**: An optional field on a Drill_Record that holds a column, a row, and a value from a table. It is shown on the Result_Screen and is never a graded pick.
- **founder_checked**: A boolean on every Drill_Record. It starts `false`. It means the founder confirmed the drill content.
- **index_checked**: A boolean on a Drill_Record. It means the founder confirmed the bold heading and entry words in a printed Index for the Index route. It starts `false`.
- **Checked_Names_File**: A data file in `midnight-code-hunt/` that holds the Checked_Name_Entry values for one edition. There is exactly one per edition (2023 and 2026), shared by all drills.
- **Checked_Name_Entry**: A record in a Checked_Names_File with a key, a Short_Description, an optional printed wording, and a checked flag.
- **Short_Description**: A plain lowercase description of an item, shown with its number or letter when no checked printed name is available (for example "article 590, temporary power").
- **Draft_Badge**: A visible "Draft" label shown on a drill whose `founder_checked` is not `true`, in development and test builds only.
- **Best_Times_Store**: The module that reads and writes best times in browser `localStorage`.
- **Switcher_Link**: The link from Midnight_Code_Hunt to App 2 (Dead Circuit Check).
- **Footer_Disclaimer**: The Sentinel footer text given word for word in `product.md` and Requirement 15.
- **Sentinel_Dark_Theme**: Background `#050607`, primary `oklch(0.83 0.185 88)`.
- **Production_Build**: A build made with the Vite production mode.
- **Content_Scan_Test**: An automated test that scans UI copy, drill data, and docs in `midnight-code-hunt/` for banned words and phrases.

---

## Requirements

### Requirement 1: Workspace Setup and Build-on-Core Boundary

**User Story:** As a developer, I want Midnight_Code_Hunt to be its own workspace package that depends on Core without changing it, so that both apps share one engine and Core stays free of app code.

#### Acceptance Criteria

1. THE Midnight_Code_Hunt package SHALL live in the `midnight-code-hunt/` folder at the repository root as a standalone Vite + React + Tailwind + TypeScript workspace package with the name `midnight-code-hunt`.
2. THE repository root `package.json` SHALL list `midnight-code-hunt` in its `workspaces` array alongside `packages/*`.
3. THE Midnight_Code_Hunt `package.json` SHALL declare `@sentinel/skeleton-core` as a dependency, SHALL declare `vitest` and `fast-check` in `devDependencies` only, and SHALL NOT list `vitest` or `fast-check` in `dependencies`.
4. THE Midnight_Code_Hunt package SHALL provide `dev`, `build`, `test`, and `verify` scripts, where the `test` script runs once and exits without watch mode.
5. WHEN the root `npm run verify` command runs, THE root `verify` script SHALL invoke the Midnight_Code_Hunt `verify` script and SHALL exit with a non-zero status if the Midnight_Code_Hunt `verify` script exits with a non-zero status.
6. THE Midnight_Code_Hunt source SHALL import Core only through the public `@sentinel/skeleton-core` entry point, with zero imports that use a deep path into `packages/skeleton-core/`.
7. THE work for this spec SHALL make zero changes to any file under `packages/skeleton-core/`.
8. THE Midnight_Code_Hunt package SHALL hold all drill data, both Checked_Names_Files, and any table-sourced values, and SHALL add zero table data files or table values to Core.
9. WHEN `build` completes, THE Midnight_Code_Hunt production bundle SHALL contain zero imports or references to `fast-check`.
10. WHEN `build` completes, THE Midnight_Code_Hunt output SHALL consist of static files only, with no server code, no backend call, and no runtime AI call.
11. IF a static check finds `fetch`, `XMLHttpRequest`, `WebSocket`, or `sendBeacon` in any file under the `midnight-code-hunt/src` folder, THEN THE `verify` script SHALL exit with a non-zero status and SHALL print the path of each offending file.
12. IF the `build`, `test`, or static check step fails, THEN THE Midnight_Code_Hunt `verify` script SHALL exit with a non-zero status and SHALL NOT report success.

---

### Requirement 2: Drill Data Model and Data File

**User Story:** As the founder, I want each drill stored as one typed record in one data file, so that I can review and confirm every question, answer, trail, and flag in one place.

#### Acceptance Criteria

1. THE Drill_Library SHALL export a readonly array of Drill_Record values from a single data file in `midnight-code-hunt/`.
2. THE Drill_Record type SHALL wrap a Core `CodeTrailDef` (built with `defineCodeTrail`) so that `id`, `label`, `trails`, `hint`, optional `movedFrom`, and optional `editionNote` keep the Core meaning and limits.
3. THE Drill_Record type SHALL require these app fields: `question` (string of 1 to 500 characters after trimming), `answer` (plain paraphrase of 1 to 500 characters after trimming), `citation` (string of 1 to 200 characters after trimming that names an article, section, or table), `founder_checked` (boolean), and `index_checked` (boolean).
4. THE Drill_Record type SHALL include an optional `chapterForkSentence` field and an optional `articleForkSentence` field, each holding exactly one plain sentence of 1 to 300 characters, and SHALL include no other fork field.
5. THE Drill_Record type SHALL include, for each Method and each step of that Method's Option_Tree (the Keyword step included), the correct Option plus a list of 0 to 6 Wrong_Options, so that the Step_Flow can show the correct value together with the wrong ones.
6. THE Drill_Record type SHALL include a `wrongOptionsReviewed` boolean, and every Drill_Record whose Wrong_Options were drafted by Kiro SHALL have `wrongOptionsReviewed` set to `false` until the founder sets it to `true`.
7. THE Drill_Record type SHALL reference Checked_Name_Entry values by key from its Options, as defined in Requirement 3, and SHALL hold no checked-name marker inside the Drill_Record.
8. THE Midnight_Code_Hunt SHALL assign each valid trail to a Method by the level of its first step: a first step of level `"index"` belongs to Index_Keyword_Lookup, and a first step of level `"chapter"`, `"annex"`, or `"article"` belongs to Table_of_Contents_Lookup, so that the Drill_Record holds no separate field that lists trails per Method.
9. THE Drill_Library SHALL set `founder_checked` and `index_checked` to `false` on every Drill_Record that the founder has not confirmed.
10. THE Drill_Library SHALL contain no question, answer, trail, hint, Index entry, or NEC citation that the founder did not supply, and SHALL contain no NEC text quotations.
11. IF the Drill_Library contains a Drill_Record with `founder_checked` set to `true` and `wrongOptionsReviewed` set to `false`, THEN THE data test SHALL fail and name the drill `id`.
12. IF a Wrong_Option has the same value (after trimming and lowercasing) as the graded value of any valid trail or of `movedFrom` at the same step, THEN THE data test SHALL fail and name the drill `id` and step.
13. IF two Drill_Records share the same `id`, THEN THE data test SHALL fail and name the repeated `id`.
14. IF a Drill_Record has an empty or whitespace-only `question`, `answer`, or `citation`, or a value that exceeds the length limit in criterion 3, THEN THE data test SHALL fail and name the drill `id` and the offending field.
15. THE Drill_Record type SHALL include an optional Table_Walk holding a column, a row, and a value, each a string of 1 to 100 characters after trimming, and THE Midnight_Code_Hunt SHALL NOT treat any part of the Table_Walk as a graded pick.
16. THE Drill_Record type SHALL carry a has-Parts boolean marker on every Article Option in an Option_Tree, including each decoy Article Option.
17. THE Drill_Record type SHALL support trails that start with a step of level `"annex"` and Article 90 trails that start with a step of level `"article"`, and THE Midnight_Code_Hunt SHALL build no special screen for them until a drill needs one.

---

### Requirement 3: Printed-Name Display Rule and Fallback

**User Story:** As the founder, I want printed headings, Part names, and table titles shown word for word only when I have checked them for that edition, so that learners are never shown a printed name I have not confirmed.

#### Acceptance Criteria

1. THE Midnight_Code_Hunt SHALL store Checked_Name_Entry values in exactly one Checked_Names_File for edition 2023 and exactly one Checked_Names_File for edition 2026, each entry holding a key (1 to 80 characters, unique within its file), a Short_Description (1 to 80 characters), an optional printed wording (1 to 200 characters), and a checked flag (boolean).
2. WHEN the app displays a heading, Part, or table title for an edition, and the Checked_Name_Entry for that edition exists, its checked flag is `true`, and a printed wording is present, THE Midnight_Code_Hunt SHALL show the printed wording word for word, with no change to its characters, spacing, or capitalization.
3. WHEN the app displays a heading, Part, or table title for an edition, and the Checked_Name_Entry for that edition does not exist or its checked flag is `false`, THE Midnight_Code_Hunt SHALL show the Option's number or letter, a single space, and the Short_Description.
4. WHEN the app displays a heading, Part, or table title for an edition, and the Checked_Name_Entry has its checked flag `true` but holds no printed wording, THE Midnight_Code_Hunt SHALL show the number or letter, a single space, and the Short_Description, and the data test SHALL report the entry as inconsistent.
5. THE Midnight_Code_Hunt SHALL use the 2026 Checked_Names_File for every step of a valid trail and the 2023 Checked_Names_File for every step of `movedFrom`.
6. THE Short_Description SHALL contain only lowercase letters, digits, spaces, hyphens, and commas, SHALL contain no NEC text quotation, and SHALL be a plain trade-language label of 80 characters or fewer.
7. FOR ALL Checked_Name_Entry values and editions, THE Midnight_Code_Hunt SHALL display text equal to the printed wording only when the entry exists, its checked flag is `true`, and a printed wording is present, and SHALL display text equal to the number or letter, a single space, and the Short_Description in every other case (verified with fast-check, minimum 100 generated cases).
8. IF a drill references a checked-names key that has no entry in the Checked_Names_File of the right edition, THEN THE Midnight_Code_Hunt SHALL show the raw step value from the trail unchanged and continue the drill without interruption, and THE data test SHALL fail and report the drill `id`, the trail step, and the unresolved key.
9. THE Midnight_Code_Hunt SHALL show the nine Chapter Options of Table_of_Contents_Lookup with the founder-supplied labels given in Requirement 9 criterion 8, and SHALL NOT subject those labels to this printed-name rule, because they are founder labels and not printed names.

---

### Requirement 4: Founder-Checked Filter

**User Story:** As the founder, I want only drills I have confirmed to reach the public site, and drafts to be clearly marked in my own builds, so that no unverified content is published.

#### Acceptance Criteria

1. THE Midnight_Code_Hunt SHALL provide a pure, deterministic function that takes a list of Drill_Record values (0 to 1,000 items) and a build mode (one of production, development, or test) and returns a new list of entries, each holding one Drill_Record and a `draft` boolean, without modifying the input list or any Drill_Record in it.
2. WHILE the build mode is production, THE function SHALL return only entries for Drill_Records whose `founder_checked` is exactly `true`, in the same relative order as the input list, each with `draft` set to `false`.
3. WHILE the build mode is development or test, THE function SHALL return one entry for every Drill_Record in the input list, in the input order, with `draft` set to `true` when `founder_checked` is not exactly `true` and `false` otherwise.
4. IF a Drill_Record has a `founder_checked` value that is missing or is not exactly `true`, THEN THE function SHALL treat that Drill_Record as unchecked, SHALL exclude it from the production result, and SHALL set `draft` to `true` for it in the development and test results.
5. FOR ALL lists of Drill_Records, the production result SHALL be a subset of the input list, SHALL keep the input order, and SHALL contain no Drill_Record whose `founder_checked` is not exactly `true` (verified with fast-check).
6. FOR ALL lists of Drill_Records, applying the production filter to the Drill_Records of a production result SHALL return the same result (idempotence, verified with fast-check).
7. WHILE the build mode is production and the function returns an empty list, THE Drill_Picker SHALL show a message stating that new drills are coming, with a maximum length of 120 characters, and SHALL show zero drills.
8. THE data test SHALL run `validateCodeTrail` and the `gradeTrail` checks of Requirement 17 on every Drill_Record in the Drill_Library, whatever the value of `founder_checked`, and SHALL fail with an error that names the `id` of each Drill_Record that does not pass.
9. FOR ALL lists of Drill_Records, the development and test result SHALL have the same length and order as the input list, and each entry's `draft` value SHALL be `true` if and only if the matching Drill_Record's `founder_checked` is not exactly `true` (verified with fast-check).

---

### Requirement 5: Drill Picker

**User Story:** As an electrician, I want to see the available drills and pick one, so that I can practice the kind of question I need.

#### Acceptance Criteria

1. WHEN the app loads, THE Drill_Picker SHALL list every drill returned by the founder-checked filter, each showing its `label`, in the order the filter returns them.
2. IF the founder-checked filter returns zero drills, THEN THE Drill_Picker SHALL show the message required by Requirement 4 criterion 7 (or a short "no drills available" message when the build mode is not production) and SHALL show no drill entries.
3. WHEN a drill has a saved best time for a Method, THE Drill_Picker SHALL show that best time, in minutes and seconds, next to the drill label and labeled with its Method name, for each Method that has a saved best time.
4. WHEN a drill has no saved best time for a Method, THE Drill_Picker SHALL show no best time for that Method on that drill.
5. WHEN the user activates a drill in the Drill_Picker by pointer click, touch tap, or the Enter or Space key while the drill is focused, THE Midnight_Code_Hunt SHALL open the Drill_Screen for that drill.
6. THE Drill_Picker SHALL show one line of copy, no longer than 120 characters, stating that the drills help the user find answers in the user's own code book in less time.
7. THE Drill_Picker SHALL state that the user needs a printed or digital copy of the 2026 NEC to use the drills.
8. WHERE a drill has `movedFrom`, THE Drill_Picker SHALL mark that drill with a visible label stating that the article moved between the 2023 and 2026 editions, and SHALL show no such label on drills without `movedFrom`.
9. WHILE the build mode is development or test and a returned entry has `draft` set to `true`, THE Drill_Picker SHALL show the Draft_Badge with the visible text "Draft" on that drill, and the badge SHALL be readable as text and not as color alone.
10. WHILE the build mode is production, THE Drill_Picker SHALL show zero Draft_Badge elements.

---

### Requirement 6: Method Selector

**User Story:** As an electrician, I want to choose between Index Keyword Lookup and Table of Contents Lookup, so that I can use the main way first and the second way when I want it.

#### Acceptance Criteria

1. THE Method_Selector SHALL list Index_Keyword_Lookup in the first position and Table_of_Contents_Lookup in the second position, using the exact labels "Index Keyword Lookup" and "Table of Contents Lookup".
2. WHEN a drill with `index_checked` set to `true` is loaded, THE Method_Selector SHALL offer both Methods and SHALL select Index_Keyword_Lookup by default.
3. WHEN a drill with `index_checked` set to `false` is loaded, THE Method_Selector SHALL offer only Table_of_Contents_Lookup, SHALL select Table_of_Contents_Lookup, and SHALL NOT render Index_Keyword_Lookup as a choice.
4. WHILE a drill has `index_checked` set to `false`, THE Midnight_Code_Hunt SHALL display zero Index entries, zero Index heading words, and zero Index route steps for that drill.
5. THE Method_Selector SHALL describe Index_Keyword_Lookup as the main method and Table_of_Contents_Lookup as the second method, using exactly one plain sentence of at most 20 words for each Method.
6. WHEN the user chooses a Method that differs from the selected Method while the Timer is running, THE Midnight_Code_Hunt SHALL clear all picks made so far (the Keyword_Pick included), display the first step of the chosen Method, and continue the Timer without resetting or pausing it.
7. WHEN the user chooses the Method that is already selected, THE Midnight_Code_Hunt SHALL keep all picks made so far and leave the Timer unchanged.
8. THE Method_Selector SHALL expose each offered Method as a radio-style choice, exactly one of which is selected at any time, with a selected state that is distinguishable from the unselected state by a non-color indicator (such as a check mark or filled marker) in addition to any color change.
9. WHEN the user operates the Method_Selector with the keyboard, THE Method_Selector SHALL allow the arrow keys to move the selection between offered Methods and SHALL show a visible focus indicator on the focused choice.

---

### Requirement 7: Two-Minute Countdown

**User Story:** As an electrician, I want a visible 2-minute clock, so that I practice finding answers at exam and job-site speed.

#### Acceptance Criteria

1. WHEN the Drill_Screen opens, THE Timer SHALL start counting down from `TIME_LIMIT_SECONDS` (120 seconds) at the same moment the question is first displayed, and THE Timer SHALL display 2:00 at that moment.
2. WHILE the Timer is running, THE Timer SHALL update its display once per second in the form `m:ss`, showing whole seconds rounded up from the remaining time, from 2:00 down to 0:00.
3. WHILE the Timer is running, THE Timer SHALL compute remaining time from a monotonic clock reading taken at start, so that a browser tab that was hidden or throttled shows a remaining time within 1 second of the true value when the tab is visible again.
4. WHEN the user checks an answer before the remaining time reaches zero, THE Timer SHALL stop and THE Result_Screen SHALL show the elapsed time, defined as `TIME_LIMIT_SECONDS` minus the remaining whole seconds at the moment of the check, as a value from 0:00 through 2:00.
5. WHEN the remaining time reaches zero, THE Timer SHALL stop, THE Drill_Screen SHALL disable all step choices while keeping the picks already made unchanged, THE Midnight_Code_Hunt SHALL grade the picks made so far (the Keyword step and every other step with no pick count as incorrect), and THE Result_Screen SHALL show a message indicating that time ran out.
6. WHEN the remaining time reaches zero, THE Result_Screen SHALL show the elapsed time as 2:00.
7. IF the remaining time reaches zero, THEN THE Midnight_Code_Hunt SHALL save no best time for that attempt.
8. WHEN the user leaves the Drill_Screen before checking an answer, THE Timer SHALL stop and THE Midnight_Code_Hunt SHALL save no best time.
9. WHEN the user starts the same drill again, THE Timer SHALL begin again at 120 seconds, display 2:00, and show all picks cleared.
10. FOR ALL elapsed whole-second values from 0 through 120, the function that formats time SHALL return a string in the form `m:ss` (seconds always two digits, minutes one digit) that parses back to the same value (round trip, verified with fast-check).
11. THE Midnight_Code_Hunt SHALL accept the time source as an injected dependency, so that component tests can advance time by a chosen number of milliseconds without waiting in real time.

---

### Requirement 8: Index Keyword Lookup Step Flow

**User Story:** As an electrician, I want to practice the Index route from the keyword to the Index entry to the answer, so that I learn to go the way I do in the real book.

#### Acceptance Criteria

1. WHEN Index_Keyword_Lookup is the selected Method, THE Step_Flow SHALL present these steps in this order: Keyword (pick the Index heading word alone), Index (pick the entry path and the number it gives), then Section (walk the headings down to the item that holds the answer), where the Section step repeats once for each further subdivision the Option_Tree holds.
2. WHEN a drill starts with Index_Keyword_Lookup selected, THE Step_Flow SHALL show only the Options for the Keyword step and SHALL hide the Options for every later step.
3. WHEN the user picks an Option at a step and that Option has a next level in the drill data, THE Step_Flow SHALL show the Options for the next step within 300 milliseconds and SHALL keep the Options of earlier steps visible with the user's pick marked.
4. THE Step_Flow SHALL show each Option as a button whose graded value is the Core trail step value and whose display text follows Requirement 3.
5. THE Midnight_Code_Hunt SHALL map the steps onto Core trail levels and picks as follows: the Keyword step is the trail `keyword`, is graded by the app (Requirement 10 criterion 11), and is not passed to `gradeTrail`; the Index step produces a pick of level `"index"`; the number the Index gives produces the next pick, of level `"section"` or `"table"`; each lettered or numbered subdivision produces a further pick of level `"section"`.
6. THE Midnight_Code_Hunt SHALL build the picks passed to a Core `gradeTrail` call in the order the user chose them, with no reordering, no omitted picks, and no added picks.
7. THE Midnight_Code_Hunt SHALL hold each Index trail as a single leg (the `"index"` step, then the number the Index gives, then the subdivisions as further `"section"` steps), with the number the Index gives appearing exactly once in the trail, so that the trail passes `validateCodeTrail` with the Core as it is today.
8. WHEN the latest pick ends its path, meaning the picked Option has no next level in the drill data, THE Drill_Screen SHALL enable a "Check my answer" button.
9. WHILE no pick has been made, or the latest pick is an Option that has a next level in the drill data, THE Drill_Screen SHALL keep the "Check my answer" button disabled.
10. WHEN the user activates a step already answered, THE Step_Flow SHALL let the user change that pick, SHALL clear every later pick, SHALL hide the Options of every step after the changed step until the user picks again, SHALL disable the "Check my answer" button, and SHALL keep the Timer running without resetting its elapsed value.
11. THE Midnight_Code_Hunt SHALL show Index entry words only from Option data on a Drill_Record whose `index_checked` is `true`.
12. THE Midnight_Code_Hunt SHALL present each lettered or numbered subdivision as its own Section step in both Methods (illustrative only and unverified: 210.52, then (C), then (1)).
13. THE Midnight_Code_Hunt SHALL NOT present a Row step, or any table walk inside a section, as a graded pick in either Method.
14. WHEN the word in the question is not the Code's word, THE Step_Flow SHALL list the trail keyword among the Keyword Options and SHALL show no text that explains the switch.

---

### Requirement 9: Table of Contents Lookup Step Flow

**User Story:** As an electrician, I want the Table of Contents route Keyword, Chapter, Article, Part (when the Article has Parts), and Section, so that I can find an answer when I do not start from the Index.

#### Acceptance Criteria

1. WHEN Table_of_Contents_Lookup is the selected Method, THE Step_Flow SHALL present only the steps the user takes, in this order: for an Article with Parts, Keyword, Chapter, Article, Part, Section; for an Article with no Parts, Keyword, Chapter, Article, Section; for a Chapter 9 table, Keyword, Chapter, Table, Row.
2. THE Step_Flow SHALL choose among the branches in criterion 1 by the has-Parts marker of the Article Option the user picked (decoy Article Options included), and SHALL treat a Chapter 9 table as the branch that follows a Chapter Option whose next level is Table.
3. THE Midnight_Code_Hunt SHALL treat Keyword as the trail `keyword` (not a `gradeTrail` pick) and SHALL treat Chapter, Article, Part, and Section as `gradeTrail` picks of levels `"chapter"`, `"article"`, `"part"`, and `"section"` respectively, except that the Section step SHALL record a pick of level `"table"` where the valid trail ends at a table, and each lettered or numbered subdivision SHALL record a further pick of level `"section"`.
4. THE Step_Flow SHALL accept exactly one click per step, choosing from the Options shown at that step.
5. WHEN the user picks an Option at a step and that Option has a next level in the drill data, THE Step_Flow SHALL show the next step, and THE Step_Flow SHALL show no later step before that pick is made.
6. THE Step_Flow SHALL use the same Option layout, change rule, "Check my answer" rule, and keyword rule as Requirement 8 criteria 2, 3, 8, 9, 10, 12, 13, and 14.
7. THE Midnight_Code_Hunt SHALL NOT offer a `NO_PARTS` pick, SHALL NOT show a "None in <article>" tag, SHALL NOT show a "No Parts in this article" button, and SHALL NOT create a pick whose value is `NO_PARTS`.
8. THE Step_Flow SHALL label the nine Chapter Options exactly "Ch 1 General", "Ch 2 Plan: circuits, protection, grounding", "Ch 3 Build: wiring methods, raceways, cables, boxes", "Ch 4 Use: equipment", "Ch 5 Special occupancies", "Ch 6 Special equipment", "Ch 7 Special conditions", "Ch 8 Communications", and "Ch 9 Tables", and SHALL show them in that order.
9. WHEN the user picks a Part Option on a trail whose valid Article has no Part step, THE Midnight_Code_Hunt SHALL pass that pick to `gradeTrail` unchanged and SHALL grade the Part pick as incorrect as the Core does.
10. WHEN the Row step is reached on a Chapter 9 table, THE Step_Flow SHALL offer no Row pick, and THE Result_Screen SHALL show the Table_Walk when the Drill_Record has one.

---

### Requirement 10: Grading and Per-Step Feedback

**User Story:** As an electrician, I want each step marked right or wrong when I check my answer, so that I can see exactly where I went off the path.

#### Acceptance Criteria

1. THE Midnight_Code_Hunt SHALL grade every step after the Keyword step with the Core `gradeTrail` function and SHALL add no grading rules of its own for those steps.
2. WHEN the user checks an answer, THE Midnight_Code_Hunt SHALL build a Grading_Input from the Drill_Record and SHALL call `gradeTrail` exactly once with the user's picks (the Keyword_Pick excluded) in the order the user made them, where the `trails` of the Grading_Input are chosen as follows: (a) WHEN the Keyword_Pick matches (trimmed, case-insensitive) the keyword of at least one valid trail of the selected Method (assigned by first-step level as in Requirement 2 criterion 8), the `trails` are only the valid trails of the selected Method whose keyword equals the Keyword_Pick; (b) IF the Keyword_Pick matches the keyword of no valid trail of the selected Method, or there is no Keyword_Pick, THEN the `trails` are all valid trails of the selected Method, the call serves only to produce per-step feedback, and the Overall_Result is incorrect whatever `gradeTrail` returns.
3. WHEN Table_of_Contents_Lookup is the selected Method and the Drill_Record has `movedFrom` (one Table_of_Contents_Lookup trail for the 2023 location), THE Midnight_Code_Hunt SHALL include `movedFrom` in the Grading_Input only when the keyword of `movedFrom` equals (trimmed, case-insensitive) the Keyword_Pick and case (a) of criterion 2 applies. IF the Keyword_Pick equals the keyword of `movedFrom` but matches the keyword of no valid trail of the selected Method, THEN THE Midnight_Code_Hunt SHALL omit `movedFrom` from the Grading_Input, SHALL show the Keyword row as incorrect, and SHALL show no moved-article message.
4. WHILE Index_Keyword_Lookup is the selected Method, THE Midnight_Code_Hunt SHALL omit `movedFrom` from the Grading_Input, so that an Index_Keyword_Lookup user never receives the moved-article message.
5. IF grading runs with zero picks made (possible only when the Timer reaches zero, because the "Check my answer" button stays disabled until the latest pick ends its path), THEN THE Midnight_Code_Hunt SHALL call `gradeTrail` exactly once, SHALL show the Keyword row as "not answered", SHALL show every step row as "not answered", SHALL show the incorrect state, SHALL keep the app running without raising an error, and SHALL keep the Drill_Record and the Method unchanged.
6. THE Midnight_Code_Hunt SHALL NOT rely on `stepResults.length` being equal to the number of trail steps, because for a trail with no `"part"` step the Core MAY add exactly one synthetic `{ level: "part", verdict: "incorrect" }` entry (placed after the first `"article"` step; if none, before the first `"section"` or `"table"` step; if none, at the end).
7. WHEN `stepResults` holds a synthetic `"part"` entry, THE Result_Screen SHALL show it as a Part row marked "incorrect", and SHALL show every other row with the verdict the Core returned for it, in the order the Core returned them.
8. THE Midnight_Code_Hunt SHALL show each verdict as exactly one of "correct", "incorrect", or "not answered", using visible text or an icon with an accessible text label in addition to color.
9. WHEN the Overall_Result is correct (criterion 11), THE Result_Screen SHALL show the correct-answer state and SHALL NOT show the incorrect state.
10. WHEN `gradeTrail` returns `matched` false and `matchedMovedFrom` true, THE Result_Screen SHALL NOT show the correct-answer state, SHALL show the movedFrom message of Requirement 11 criterion 7, and SHALL label the per-step verdicts as verdicts against the 2023 route. WHEN `gradeTrail` returns `matched` false and `matchedMovedFrom` false, THE Result_Screen SHALL show the incorrect state with the per-step verdicts from the best-matching valid trail as returned by the Core, and SHALL NOT show the movedFrom message.
11. THE Midnight_Code_Hunt SHALL treat the Keyword_Pick as correct when it matches (trimmed, case-insensitive) the keyword of at least one valid trail of the selected Method, SHALL show the result as the Keyword row, and SHALL define the Overall_Result as correct only when the Keyword_Pick is correct AND `gradeTrail` returned `matched` true when called with a Grading_Input whose `trails` are only the valid trails of the selected Method whose keyword equals the Keyword_Pick (so that the keyword and the remaining picks belong to the same trail, because `gradeTrail` does not report which trail matched).
12. FOR ALL Drill_Records and picks, calling the Midnight_Code_Hunt grading function twice with the same arguments SHALL return equal results (determinism, verified with a fast-check property test run for at least 100 generated cases).
13. FOR ALL drills with two valid trails of the same Method that have different keywords, picks built from the remaining steps of trail A with the keyword of trail B (and the reverse) SHALL give an Overall_Result that is not correct, picks built entirely from one trail (keyword and remaining steps) SHALL give an Overall_Result that is correct, and a Keyword_Pick that matches the keyword of either trail SHALL make the Keyword row correct (verified with a fast-check property test run for at least 100 generated cases).

---

### Requirement 11: Result Screen

**User Story:** As an electrician, I want a clear result with my time, the right path, and where to learn more, so that I know what to do better next time.

#### Acceptance Criteria

1. WHEN an answer is checked or the Timer expires, THE Result_Screen SHALL show the elapsed time in `m:ss` format, with minutes as one or more digits, seconds as exactly two digits from 00 to 59, and a value no greater than the Timer's configured limit.
2. WHEN the Result_Screen is shown, THE Result_Screen SHALL show a Keyword row first, then one row per step in the order the Core returned them, each row containing the step's level, the pick the user made (or an indication that no pick was made if the step was left empty), and its verdict as defined in Requirement 10.
3. WHEN the Result_Screen is shown, THE Result_Screen SHALL show the drill `answer` and its full `citation`.
4. WHEN the Result_Screen is shown, THE Result_Screen SHALL show the drill `hint`.
5. WHEN the Result_Screen is shown, THE Result_Screen SHALL show a link to `https://sentinellearning.com` that is visible without scrolling past the action buttons defined in criterion 11.
6. WHERE the Drill_Record has a `chapterForkSentence`, THE Result_Screen SHALL show it in the Chapter row, and WHERE the Drill_Record has an `articleForkSentence`, THE Result_Screen SHALL show it in the Article row; the app SHALL show each sentence only when present and SHALL NOT generate either one.
7. WHEN `gradeTrail` returns `matchedMovedFrom` true, THE Result_Screen SHALL show a message stating that the picks match where the answer was located in the 2023 NEC.
8. WHERE the Drill_Record has an `editionNote` and `gradeTrail` returns `matchedMovedFrom` true, THE Result_Screen SHALL show the `editionNote` together with the message in criterion 7.
9. WHEN the Timer reached zero, THE Result_Screen SHALL show a message stating that time ran out.
10. WHEN the Overall_Result is correct, THE Result_Screen SHALL show the saved best time for the drill and Method in `m:ss` format, and IF the elapsed time is less than the previously saved best time or no best time was previously saved, THEN THE Result_Screen SHALL show a message stating that the elapsed time is a new best.
11. THE Result_Screen SHALL offer a "Try again" action that restarts the same drill with the same Method and a reset Timer, and a "Back to drills" action that returns to the drill list.
12. THE Result_Screen SHALL NOT state or imply that the user will pass any exam or achieve any score or outcome.
13. WHERE the Drill_Record has a Table_Walk, THE Result_Screen SHALL show its column, row, and value on the Row line of the path, and SHALL show no Table_Walk when the Drill_Record has none.
14. IF the Overall_Result is not correct, THEN THE Result_Screen SHALL NOT show a new-best message and SHALL NOT overwrite the saved best time for the drill and Method.

---

### Requirement 12: Best Times in localStorage

**User Story:** As an electrician, I want my best times saved on my own device, so that I can beat them next time without making an account.

#### Acceptance Criteria

1. THE Best_Times_Store SHALL save best times only in browser `localStorage`, keyed by the combination of drill `id` and Method (Index Keyword Lookup or Table of Contents Lookup), so that each drill and Method pair has its own independent best time.
2. THE Best_Times_Store SHALL send zero best-time data over the network to any server.
3. WHEN an answer is checked with the Overall_Result correct before the Timer expires, THE Best_Times_Store SHALL save the elapsed time, in seconds, for that drill and Method if no best time is saved for that pair or if the elapsed time is strictly lower than the saved best time.
4. WHEN an answer is checked with the Overall_Result correct before the Timer expires and the elapsed time is equal to or greater than the saved best time, THE Best_Times_Store SHALL leave the saved best time for that drill and Method unchanged.
5. IF the Overall_Result is not correct (including a correct path with a wrong Keyword_Pick), or IF the Timer expired before the answer was checked, THEN THE Best_Times_Store SHALL leave all saved best times unchanged.
6. FOR ALL saved best times (or none) and all non-negative elapsed times, the update function SHALL return the minimum of the two (or the elapsed time when none is saved), SHALL never return a value greater than the saved time, and SHALL be idempotent when applied twice with the same elapsed time (verified with fast-check).
7. FOR ALL valid best-time maps, writing the map to storage and reading it back SHALL return a map equal to the original (round trip, verified with fast-check).
8. IF `localStorage` is unavailable or throws on read or write, THEN THE Best_Times_Store SHALL keep best times in memory for the current visit, SHALL not throw an error to the caller, and THE Midnight_Code_Hunt SHALL display a note of no more than 100 characters stating that best times will not be saved after the visit.
9. IF a stored value is missing, is not valid JSON, or is not a finite number of seconds greater than or equal to 0, THEN THE Best_Times_Store SHALL ignore that value, treat that drill and Method pair as having no best time, and leave the other valid stored pairs unaffected.

---

### Requirement 13: Phone-First Layout, Theme, and Halloween Styling

**User Story:** As an electrician on a phone at a job site, I want a screen that works one-handed and looks like Sentinel at night, so that I can drill in spare minutes.

#### Acceptance Criteria

1. THE Midnight_Code_Hunt SHALL render every screen without horizontal scrolling at every viewport width from 320 CSS pixels to 1920 CSS pixels, and SHALL reflow its layout to use the additional width at viewports wider than 320 CSS pixels.
2. THE Midnight_Code_Hunt SHALL size every tappable control to at least 44 by 44 CSS pixels and SHALL keep at least 8 CSS pixels of spacing between adjacent tappable controls.
3. THE Midnight_Code_Hunt SHALL include a viewport meta tag that sets the layout width to the device width and an initial scale of 1, and SHALL NOT disable user zoom.
4. THE Midnight_Code_Hunt SHALL use the Sentinel_Dark_Theme tokens, background `#050607` and primary `oklch(0.83 0.185 88)`, each defined in exactly one place as a Tailwind theme token and referenced by token name everywhere else.
5. THE Midnight_Code_Hunt SHALL show at least one moon, one bat, and one cobweb motif, plus midnight-themed wording, on the home screen, the drill screen, and the results screen, drawn with inline SVG or CSS.
6. THE Midnight_Code_Hunt SHALL make zero external image requests and zero external font requests at runtime.
7. WHERE the user's system setting asks for reduced motion, THE Midnight_Code_Hunt SHALL stop all decorative animation within 100 milliseconds of page load, and SHALL continue to show the Timer display and the verdict text.
8. THE Midnight_Code_Hunt SHALL keep a contrast ratio of at least 4.5:1 for body text and at least 3:1 for large text (18 pt or 14 pt bold and larger) and for interface boundaries, measured against the Sentinel_Dark_Theme background and surfaces.
9. IF a decorative motif overlaps text or a tappable control, THEN THE Midnight_Code_Hunt SHALL keep the motif behind the content, SHALL NOT let it intercept taps, and SHALL NOT let it lower the contrast below the ratios in criterion 8.

---

### Requirement 14: Keyboard Accessibility

**User Story:** As an electrician who uses a keyboard or a screen reader, I want every drill action to work without a pointer and to be announced, so that the app is usable for everyone.

#### Acceptance Criteria

1. THE Midnight_Code_Hunt SHALL make every control (drill buttons, Method choices, Options, "Check my answer", "Try again", "Back to drills", and links) reachable with the Tab key and Shift+Tab key, and operable with the Enter key or the Space key as applicable to the control type, with no pointer input.
2. THE Midnight_Code_Hunt SHALL keep the tab order identical to the visual left-to-right, top-to-bottom reading order on every screen.
3. WHILE a control has keyboard focus, THE Midnight_Code_Hunt SHALL display a focus indicator on that control with a contrast ratio of at least 3:1 against the adjacent background and a thickness of at least 2 CSS pixels.
4. WHEN the Left Arrow, Up Arrow, Right Arrow, or Down Arrow key is pressed while a Method choice has focus, THE Method_Selector SHALL move focus to and select the adjacent Method, wrapping from the last Method to the first and from the first to the last, as radio choices do.
5. WHEN the next step appears, THE Midnight_Code_Hunt SHALL move keyboard focus to the heading of that step within 100 milliseconds.
6. WHEN the Result_Screen opens, THE Midnight_Code_Hunt SHALL move keyboard focus to the Result_Screen heading within 100 milliseconds.
7. THE Timer SHALL expose its remaining time to assistive technology through a polite live region that announces only when the remaining time reaches 60 seconds, 30 seconds, 10 seconds, and zero, and SHALL NOT announce at any other second.
8. WHEN the Result_Screen opens, THE Midnight_Code_Hunt SHALL announce the Overall_Result (correct or incorrect, and the time remaining or time-expired status) through a polite live region within 1 second.
9. THE Midnight_Code_Hunt SHALL give each button and link an accessible name that contains its complete visible text, in the same order.
10. THE Midnight_Code_Hunt SHALL set the page language attribute to English ("en") and SHALL render exactly one level-one heading on each screen.
11. IF a control is disabled or a step is not yet available, THEN THE Midnight_Code_Hunt SHALL leave that control out of the tab order and SHALL expose its disabled state to assistive technology.

---

### Requirement 15: Switcher Link, Sentinel Link, and Footer

**User Story:** As a visitor, I want to move to the other Sentinel app and see who made this app and what it is not, so that I understand the context.

#### Acceptance Criteria

1. THE Midnight_Code_Hunt SHALL read the App 2 address from the Vite build-time environment variable `VITE_DEAD_CIRCUIT_CHECK_URL`.
2. WHERE `VITE_DEAD_CIRCUIT_CHECK_URL` is set to a value of 1 to 2048 characters that starts with `https://`, `http://`, or `/`, THE Midnight_Code_Hunt SHALL show a Switcher_Link with the visible text "Dead Circuit Check" and an href equal to that value on every screen (Drill selection, active Drill, and Result_Screen).
3. IF `VITE_DEAD_CIRCUIT_CHECK_URL` is unset, is an empty string, contains only whitespace, is longer than 2048 characters, or does not start with `https://`, `http://`, or `/`, THEN THE Midnight_Code_Hunt SHALL render no Switcher_Link element, SHALL render no link with an empty or invalid href, SHALL throw no runtime error, and SHALL render all other content of the screen unchanged.
4. WHEN a drill ends and the Result_Screen is displayed, THE Midnight_Code_Hunt SHALL show a visible link with an href of `https://sentinellearning.com` on the Result_Screen.
5. THE Midnight_Code_Hunt SHALL show the Footer_Disclaimer on every screen (Drill selection, active Drill, and Result_Screen), word for word: "Sentinel Learning is an independent study aid, not affiliated with the NFPA or any licensing board. NEC® is a registered trademark of the NFPA."
6. THE Midnight_Code_Hunt SHALL render the Footer_Disclaimer with no character added, removed, substituted, or reordered, including the ® symbol (U+00AE), so that its text content is identical to the string in criterion 5.
7. WHILE a drill timer is running, THE Midnight_Code_Hunt SHALL keep the Footer_Disclaimer visible and unchanged.

---

### Requirement 16: Content Rules

**User Story:** As the founder, I want all copy to follow the Sentinel content rules, so that the app is honest, plain, and safe to publish.

#### Acceptance Criteria

1. THE Midnight_Code_Hunt SHALL paraphrase every NEC rule and cite the article, section, or table, and SHALL contain no verbatim NEC text in UI copy, drill data, code comments, or docs.
2. THE Midnight_Code_Hunt SHALL store each value taken from an NEC table in a data file using the Core `TableValue` shape, with a `source` field naming the table and `nfpa_checked` set to `false`, and SHALL NOT hardcode table values in calculator or drill logic.
3. WHEN the founder confirms a citation or table value against the founder's NFPA 2026 source, THE Midnight_Code_Hunt SHALL treat it as verified only if its `nfpa_checked` flag is changed to `true` in the data file. Until then, every NEC citation and table-sourced value SHALL be treated as unverified.
4. THE Midnight_Code_Hunt SHALL NOT contain, in any UI copy, drill data, code comment, or doc, in any letter case, any term banned by rules 3, 4, 8, and 9 of the nec-rules steering file, or the retired method name.
5. THE Midnight_Code_Hunt SHALL NOT name a tab, a tab color, or a tab maker anywhere in UI copy, drill data, or docs.
6. THE Midnight_Code_Hunt SHALL NOT state or imply that the user will pass an exam, reach a score, or get a guaranteed outcome.
7. THE Midnight_Code_Hunt SHALL use no gendered pronouns (he, him, his, she, her, hers) or gendered terms, except official credential names such as "Journeyman Electrician".
8. THE Midnight_Code_Hunt SHALL contain no invented testimonials, quotes, reviews, endorsements, or user counts.
9. THE Midnight_Code_Hunt SHALL write UI copy in plain trade language with an average sentence length of 15 words or fewer, at a reading level of grade 5 to grade 7 as measured by the Flesch-Kincaid grade formula.
10. THE Midnight_Code_Hunt SHALL describe the benefit of the drills as finding answers in the user's own code book in less time, and SHALL NOT state any numeric time-savings figure (for example, a percentage or a number of minutes saved).
11. THE Midnight_Code_Hunt SHALL name the two methods "Index Keyword Lookup" (the main method, always listed first) and "Table of Contents Lookup" (the second method) in every place either method is named, and SHALL use no other name for either method.
12. THE Midnight_Code_Hunt SHALL put no step count in a method name or in any UI copy, drill data, or doc.
13. IF UI source, drill data, or docs in `midnight-code-hunt/` contain a term from criterion 4 or 5 (matched on whole words, case-insensitive, so that "table" is not read as "tab"), a gendered pronoun from criterion 7, a pass-guarantee phrase from criterion 6, or a `fetch`-style network call, THEN THE Content_Scan_Test SHALL fail and report the file path and the matched phrase for each match. THE Content_Scan_Test SHALL keep its banned-term list, which also covers the retired method name and the step-count phrases barred by rule 9, in one test-only file that the scan itself excludes.

---

### Requirement 17: Testing

**User Story:** As a maintainer, I want automated tests that prove the drill data and the step flows work, so that bad data or a broken flow is caught before publishing.

#### Acceptance Criteria

1. THE Midnight_Code_Hunt SHALL include a data test that runs `validateCodeTrail` on every Drill_Record in the Drill_Library.
2. IF `validateCodeTrail` returns a result that is not ok for any Drill_Record, THEN THE data test SHALL fail and SHALL report the drill `id` and the Core failure `field` for each failing Drill_Record.
3. THE data test SHALL call `gradeTrail` with the picks built from every declared valid trail of every Drill_Record, using a Grading_Input that holds the trails of the Method that the trail's first step selects.
4. IF any `gradeTrail` result for a declared valid trail does not have `matched` true, THEN THE data test SHALL fail and SHALL report the drill `id` and the index of the failing trail.
5. WHERE a Drill_Record has `movedFrom`, THE data test SHALL check that `movedFrom` is a Table_of_Contents_Lookup trail and SHALL call `gradeTrail` with the picks built from `movedFrom`.
6. IF the `gradeTrail` result for `movedFrom` does not have `matched` false and `matchedMovedFrom` true, THEN THE data test SHALL fail and SHALL report the drill `id`.
7. THE data test SHALL check the rules of Requirement 2 criteria 11 to 13 and of Requirement 3 criterion 8 for every Drill_Record, and SHALL fail with the drill `id` and the rule number for each violation.
8. THE data test SHALL check that every checked-names key referenced by a drill resolves to an entry in the Checked_Names_File of the right edition (2026 for valid trails, 2023 for `movedFrom`), and SHALL fail with the drill `id` and the unresolved key for each reference that does not resolve.
9. THE data test SHALL check that every Option path in each Option_Tree ends at an Option with no next level, that every Article Option has a has-Parts marker (failing with the drill `id` and the offending Option, with no runtime default for a missing marker), that every Keyword step has at least one Option, that no Option other than the last Option of a path has an empty next level, and that every valid trail is reachable through the Option_Tree of its Method.
10. THE Midnight_Code_Hunt SHALL include component tests for Index_Keyword_Lookup that cover the Keyword, Index, and Section steps, the order of steps, a repeated Section step for a subdivision, changing an earlier pick, and the "Check my answer" button being disabled before the latest pick ends its path and enabled after.
11. THE Midnight_Code_Hunt SHALL include component tests for Table_of_Contents_Lookup that cover the branch for an Article with Parts, the branch for an Article with no Parts, the Chapter 9 table branch, the nine Chapter labels word for word, and an assertion that the app never offers a `NO_PARTS` pick.
12. THE Midnight_Code_Hunt SHALL include component tests for the Method_Selector that cover two cases: WHEN `index_checked` is true, Index_Keyword_Lookup is listed first and selected by default; WHEN `index_checked` is false, only Table_of_Contents_Lookup is offered and it is selected.
13. THE Midnight_Code_Hunt SHALL include component tests for the Timer, using a fake time source, that cover the start at 120 seconds, the display change after each 1-second advance, the Timer stopping when the user checks an answer, the expiry behavior defined in Requirement 7, and the `m:ss` display at 120, 61, 60, 9, and 0 seconds.
14. THE Midnight_Code_Hunt SHALL include component tests for the grading flow that cover a correct Keyword_Pick with a wrong path, a wrong Keyword_Pick with a matching path (Overall_Result incorrect and no best time saved), `movedFrom` passed only under Table_of_Contents_Lookup, and a synthetic Part row shown as incorrect.
15. THE Midnight_Code_Hunt SHALL include component tests for the Result_Screen that cover the elapsed time, the Keyword row, per-step verdicts, the answer with citation, the hint, the sentinellearning.com link, the Chapter_Fork_Sentence and Article_Fork_Sentence on their rows (shown only when present), the Table_Walk, and, for a Drill_Record with `movedFrom`, the movedFrom message with the `editionNote`.
16. THE Midnight_Code_Hunt SHALL include tests for the founder-checked filter and the Drill_Picker that cover the Draft_Badge in development and test builds and its absence in the production build.
17. THE Midnight_Code_Hunt SHALL include tests for the Switcher_Link that cover the set, unset, and invalid values of its configuration, and a test that asserts the Footer_Disclaimer text matches the required wording character for character.
18. THE Midnight_Code_Hunt SHALL include fast-check property tests, each run with at least 100 iterations, for the pure logic in Requirements 3, 4, 7, 10, and 12, including the two-keyword property of Requirement 10 criterion 13.
19. THE Midnight_Code_Hunt tests SHALL use fixture drills that are marked as fictional in their content and are not real NEC content, and SHALL keep them in a test-only folder that no production source file imports.
20. WHILE the Drill_Library is empty, THE data test SHALL pass with zero failures and SHALL still run criteria 1 to 9 against the fixture drills.
21. THE Midnight_Code_Hunt SHALL include a component or unit test with a fixture drill that has two valid trails of the same Method and different keywords, covering: a Keyword_Pick matching either trail's keyword shows a correct Keyword row; the keyword of trail A with the remaining picks of trail B shows an incorrect Overall_Result and saves no best time; the keyword and remaining picks of one trail show a correct Overall_Result; and a Keyword_Pick equal to the `movedFrom` keyword only shows an incorrect Keyword row and no moved-article message.

---

## Founder decisions recorded

- Names: the two methods are Index Keyword Lookup (listed first, main, selected by default) and Table of Contents Lookup (second); the retired method name is gone everywhere.
- Steps taken only: only the steps the user takes are shown; the app never offers `NO_PARTS`, and Row and table walks are not graded picks.
- Graded keyword: the app grades the keyword pick (trimmed, case-insensitive) in both Methods; the Overall_Result needs a correct keyword and a `gradeTrail` match.
- Single-leg Index trail: an Index trail is one leg (index, the number it gives once, then subdivisions as further section steps).
- Shared checked-names file per edition: one file for 2023 and one for 2026, referenced by drills, not markers inside each drill.
- Draft badge: a drill with `founder_checked` false shows a "Draft" badge in development and test builds; production hides it.
- movedFrom shape: `movedFrom` is one Table_of_Contents_Lookup trail for the 2023 location, passed to `gradeTrail` only under Table_of_Contents_Lookup.
- Keyword with several trails (resolved): keyword is correct if it matches any valid trail of the chosen method; the drill is fully matched only when the keyword and the remaining picks belong to the same trail.
- Annex and Article 90: the data model supports them; no special screens until a drill needs one.

## Open questions for the founder

None. No question is open.
