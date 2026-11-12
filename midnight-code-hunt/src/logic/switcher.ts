/** Maximum accepted length of the switcher URL. */
const MAX_LENGTH = 2048;

/**
 * Validates the configured App 2 address.
 * Returns the raw value unchanged when it is a string of 1 to 2048 characters
 * starting with `https://`, `http://`, or `/`; otherwise returns `null`.
 * No trimming or rewriting is done.
 */
export function parseSwitcherUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (raw.length < 1 || raw.length > MAX_LENGTH) return null;
  if (raw.startsWith('https://') || raw.startsWith('http://') || raw.startsWith('/')) {
    return raw;
  }
  return null;
}
