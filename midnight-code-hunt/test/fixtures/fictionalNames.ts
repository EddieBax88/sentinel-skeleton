// FICTIONAL FIXTURES. Not real NEC content.
// Every key, wording, and description below is made up and unverified.
// Test-only: no production file under src/ imports this folder.
import type { CheckedNamesFile } from "../../src/logic/displayName";

/** Key whose entry is checked: true with printed wording. */
export const KEY_CHECKED = "fictional-checked-article";
/** Key whose entry is checked: false (short description only). */
export const KEY_UNCHECKED = "fictional-unchecked-article";
/** Key whose entry is checked: true but has no printed wording (Req 3.4). */
export const KEY_INCONSISTENT = "fictional-inconsistent-article";
/** Key that no names file holds (Req 3.8). */
export const KEY_MISSING = "fictional-missing-article";

/** Fictional 2023 names file with checked, unchecked, and inconsistent entries. */
export const fictionalNames2023: CheckedNamesFile = {
  edition: 2023,
  entries: [
    {
      key: KEY_CHECKED,
      shortDescription: "made-up gizmo wiring",
      printed: "Fictional Gizmo Wiring (made-up 2023 wording)",
      checked: true,
    },
    { key: KEY_UNCHECKED, shortDescription: "made-up widget spacing", checked: false },
    { key: KEY_INCONSISTENT, shortDescription: "made-up doohickey rules", checked: true },
  ],
};

/** Fictional 2026 names file with checked, unchecked, and inconsistent entries. */
export const fictionalNames2026: CheckedNamesFile = {
  edition: 2026,
  entries: [
    {
      key: KEY_CHECKED,
      shortDescription: "made-up gizmo wiring",
      printed: "Fictional Gizmo Wiring (made-up 2026 wording)",
      checked: true,
    },
    { key: KEY_UNCHECKED, shortDescription: "made-up widget spacing", checked: false },
    { key: KEY_INCONSISTENT, shortDescription: "made-up doohickey rules", checked: true },
  ],
};

export const FICTIONAL_NAMES = { y2023: fictionalNames2023, y2026: fictionalNames2026 } as const;

/** Names files with no rule violations: checked and unchecked entries only. */
export const CLEAN_NAMES = {
  y2023: { edition: 2023, entries: fictionalNames2023.entries.filter((e) => e.key !== KEY_INCONSISTENT) },
  y2026: { edition: 2026, entries: fictionalNames2026.entries.filter((e) => e.key !== KEY_INCONSISTENT) },
} as const satisfies { y2023: CheckedNamesFile; y2026: CheckedNamesFile };
