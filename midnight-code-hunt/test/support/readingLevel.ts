/**
 * Reading-level helpers for the copy tests.
 *
 * Syllable counter (documented approximation): lowercase the word, keep letters only, count
 * groups of consecutive vowels (a, e, i, o, u, y) as one syllable each, drop one syllable for a
 * silent trailing "e" (but not for a consonant + "le" ending, as in "table"), and never return
 * fewer than one syllable for a word that has letters.
 *
 * Flesch-Kincaid grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
 */

/** Split text into sentences on ., !, or ? followed by whitespace or the end of the text. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => /[A-Za-z0-9]/.test(s));
}

/** Words are runs of letters, digits, and inner apostrophes or hyphens. */
export function splitWords(text: string): string[] {
  return text.match(/[A-Za-z0-9]+(?:['\u2019-][A-Za-z0-9]+)*/g) ?? [];
}

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  const groups = w.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 0;
  if (w.endsWith("e") && !/[^aeiouy]le$/.test(w) && count > 1) count -= 1;
  return Math.max(1, count);
}

export interface ReadingStats {
  sentences: number;
  words: number;
  syllables: number;
  averageSentenceLength: number;
  grade: number;
}

export function analyzeText(texts: string | readonly string[]): ReadingStats {
  const list = typeof texts === "string" ? [texts] : texts;
  let sentences = 0;
  let words = 0;
  let syllables = 0;
  for (const text of list) {
    sentences += splitSentences(text).length;
    for (const word of splitWords(text)) {
      words += 1;
      syllables += countSyllables(word);
    }
  }
  if (sentences === 0 || words === 0) {
    return { sentences, words, syllables, averageSentenceLength: 0, grade: 0 };
  }
  const averageSentenceLength = words / sentences;
  const grade = 0.39 * averageSentenceLength + 11.8 * (syllables / words) - 15.59;
  return { sentences, words, syllables, averageSentenceLength, grade };
}
