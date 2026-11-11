---
inclusion: always
---

# Product: sentinel-skeleton

sentinel-skeleton is the Kiroween 2026 Skeleton Crew entry by Sentinel Learning Inc. (sentinellearning.com). Sentinel teaches electricians to find answers in their own NEC code book. Target users: Texas journeyman exam candidates and working electricians. Edition: 2026 NEC.

## Shared Core (skeleton)

The `packages/skeleton-core` package powers both apps. It provides:

1. **Two ways to find an answer in the code book** — every answer is displayed as a code-path trail. Only the steps actually taken are shown, and no method name or copy carries a step count:
   - **Index Keyword Lookup** (the main method, always listed first and selected by default) — Keyword (the Index heading word alone), Index (the entry path and the number it gives), then Section (walk the headings down, including lettered and numbered subdivisions).
   - **Table of Contents Lookup** (the second method) — Keyword, Chapter, Article, Part (only when the Article has Parts), Section. For a Chapter 9 table the steps are Keyword, Chapter, Table, Row.
2. **Calculator plug-in contract** — every calculator ships with property-based tests and conforms to the `defineCalcPlugin` extension contract.
3. **Exported extension contracts** — `defineCalcPlugin` and `defineCodeTrail` let a developer add a new calculator or drill pack without modifying core.

## App 1 — Midnight Code Hunt

Timed drills where the user works through the code-path trail against the clock, using Index Keyword Lookup (selected by default) or Table of Contents Lookup. The audience is exam takers who already know electrical terms, so the app gives no beginner hand-holding. Includes drills covering articles that moved between the 2023 and 2026 NEC.

Theme: Sentinel dark — background `#050607`, primary `oklch(0.83 0.185 88)`.

## App 2 — Dead Circuit Check

Field calculators for box fill, conduit fill, and motor branch circuits.

- Live SVG cross-section that turns red when fill exceeds the limit.
- 3-block motor diagram that flags use of table current, not nameplate current.
- Presets: `"#12 in 1/2-inch EMT"` and `"5 HP motor breaker"`.

Theme: Sentinel light — background `oklch(0.985 0.003 260)`, primary `oklch(0.58 0.19 50)`.

## Both Apps

- Halloween styling throughout.
- A switcher link to the other app.
- A link to sentinellearning.com displayed after each drill or calculation.
- The following footer, word for word:

> Sentinel Learning is an independent study aid, not affiliated with the NFPA or any licensing board. NEC® is a registered trademark of the NFPA.
