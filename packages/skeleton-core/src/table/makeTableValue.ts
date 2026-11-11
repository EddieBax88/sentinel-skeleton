import type { TableValue } from "./types.js";

/**
 * Builds a `TableValue`. Throws if `source` is empty (or whitespace-only).
 * `nfpa_checked` defaults to `false`.
 */
export function makeTableValue(
  value: number,
  source: string,
  nfpa_checked = false,
): TableValue {
  if (source.trim() === "") {
    throw new Error("makeTableValue: source must be a non-empty string");
  }
  return { value, source, nfpa_checked };
}
