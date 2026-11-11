import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractFirstNumber, validateCodeTrail } from './validate.js';
import type { CodeTrail, TrailLevel, TrailStep } from './types.js';
import { defineCodeTrail } from '../drill/defineCodeTrail.js';

const digitChar = fc.constantFrom(...'0123456789'.split(''));
const digitRun = fc
  .array(digitChar, { minLength: 1, maxLength: 15 })
  .map((a) => a.join(''));
// Non-empty strings with no ASCII digits (may include unicode digits-like chars).
const nonDigitChar = fc
  .string({ unit: 'binary', minLength: 1, maxLength: 1 })
  .filter((c) => !/[0-9]/.test(c));
const nonDigitStr = fc
  .array(nonDigitChar, { maxLength: 20 })
  .map((a) => a.join(''));
const nonDigitSep = fc
  .array(nonDigitChar, { minLength: 1, maxLength: 10 })
  .map((a) => a.join(''));

describe('extractFirstNumber properties', () => {
  // Feature: skeleton-core, Property 13a: digits-only string returns its numeric value
  it('Property 13a: digits-only string returns its numeric value', () => {
    // **Validates: Requirements 1.13**
    fc.assert(
      fc.property(digitRun, (d) => {
        expect(extractFirstNumber(d)).toBe(Number(d));
      }),
      { numRuns: 100 },
    );
  });

  // Feature: skeleton-core, Property 13b: no-digit string returns null
  it('Property 13b: no-digit string returns null', () => {
    // **Validates: Requirements 1.13**
    fc.assert(
      fc.property(nonDigitStr, (s) => {
        expect(extractFirstNumber(s)).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  // Feature: skeleton-core, Property 13c: first-run-only for multi-run strings
  it('Property 13c: first-run-only for multi-run strings', () => {
    // **Validates: Requirements 1.13**
    fc.assert(
      fc.property(
        nonDigitStr,
        digitRun,
        nonDigitSep,
        digitRun,
        nonDigitStr,
        (prefix, first, sep, second, suffix) => {
          const s = prefix + first + sep + second + suffix;
          expect(extractFirstNumber(s)).toBe(Number(first));
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------- validateCodeTrail ----------

const step = (level: TrailLevel, value: string): TrailStep => ({ level, value });
const mkTrail = (keyword: string, legs: TrailStep[][]): CodeTrail =>
  ({ keyword, legs }) as unknown as CodeTrail;

const num = (min: number, max: number) => fc.integer({ min, max });
const label = fc.string({ minLength: 1, maxLength: 12 }).filter((s) => s.trim() !== '');
const validKeyword = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => s.trim() !== '');

const sectionOrTable = fc.oneof(
  label.map((v) => step('section', v)),
  label.map((v) => step('table', v)),
);
const optNotes = fc.option(label.map((v) => step('notes', v)), { nil: undefined });

const mainLeg = fc
  .tuple(
    num(1, 8),
    label,
    fc.option(label, { nil: undefined }),
    fc.array(sectionOrTable, { minLength: 1, maxLength: 3 }),
    optNotes,
  )
  .map(([ch, art, part, tail, notes]) => [
    step('chapter', `Chapter ${ch}`),
    step('article', art),
    ...(part !== undefined ? [step('part', part)] : []),
    ...tail,
    ...(notes ? [notes] : []),
  ]);
const ch9Leg = fc
  .tuple(label, optNotes)
  .map(([t, n]) => [step('chapter', 'Chapter 9'), step('table', t), ...(n ? [n] : [])]);
const annexLeg = fc
  .tuple(label, label, optNotes)
  .map(([a, t, n]) => [step('annex', a), step('table', t), ...(n ? [n] : [])]);
const art90Leg = fc
  .tuple(label, optNotes)
  .map(([sec, n]) => [step('article', 'Article 90'), step('section', sec), ...(n ? [n] : [])]);
const indexLeg = fc
  .tuple(label, sectionOrTable, optNotes)
  .map(([k, st, n]) => [step('index', k), st, ...(n ? [n] : [])]);

const validLeg = fc.oneof(mainLeg, ch9Leg, annexLeg, art90Leg, indexLeg);
const validTrail = fc
  .tuple(validKeyword, fc.array(validLeg, { minLength: 1, maxLength: 3 }))
  .map(([k, legs]) => mkTrail(k, legs));

const invalidIndexLeg = fc.oneof(
  // index + two section steps
  fc.tuple(label, label, label).map(([k, a, b]) => [step('index', k), step('section', a), step('section', b)]),
  // index + article
  fc.tuple(label, label).map(([k, a]) => [step('index', k), step('article', a)]),
  // lone index
  label.map((k) => [step('index', k)]),
);
const otherInvalidLeg = fc.oneof(
  // chapter only (cannot end at chapter)
  num(1, 8).map((n) => [step('chapter', `Chapter ${n}`)]),
  // chapter out of range
  fc.tuple(fc.oneof(fc.constant(0), num(10, 99)), label).map(([n, a]) => [
    step('chapter', `Chapter ${n}`),
    step('article', a),
    step('section', 'x'),
  ]),
  // starts with section / table / part / notes
  fc
    .tuple(fc.constantFrom<TrailLevel>('section', 'table', 'part', 'notes'), label)
    .map(([l, v]) => [step(l, v)]),
  // article start that is not Article 90
  fc.tuple(num(1, 89), label).map(([n, s]) => [step('article', `Article ${n}`), step('section', s)]),
  // chapter 1-8 skipping article
  fc.tuple(num(1, 8), label).map(([n, s]) => [step('chapter', `Chapter ${n}`), step('section', s)]),
);
const invalidLeg = fc.oneof(invalidIndexLeg, otherInvalidLeg);

const invalidTrail = fc.oneof(
  // empty / whitespace keyword
  fc
    .tuple(fc.constantFrom('', ' ', '\t\n  '), fc.array(validLeg, { minLength: 1, maxLength: 2 }))
    .map(([k, legs]) => mkTrail(k, legs)),
  // empty legs
  validKeyword.map((k) => mkTrail(k, [])),
  // at least one malformed leg among valid ones
  fc
    .tuple(validKeyword, fc.array(validLeg, { maxLength: 2 }), invalidLeg, fc.array(validLeg, { maxLength: 2 }))
    .map(([k, a, bad, b]) => mkTrail(k, [...a, bad, ...b])),
);

describe('validateCodeTrail properties', () => {
  // Feature: skeleton-core, Property 1
  it('Property 1: valid CodeTrail passes validation', () => {
    // **Validates: Requirements 1.6, 1.7, 1.8, 1.9, 1.10, 1.14**
    fc.assert(
      fc.property(validTrail, (t) => {
        expect(validateCodeTrail(t)).toEqual({ ok: true });
      }),
      { numRuns: 100 },
    );
  });

  // Feature: skeleton-core, Property 2
  it('Property 2: invalid CodeTrail always produces failures', () => {
    // **Validates: Requirements 1.6, 1.7, 1.8, 1.9, 1.10, 1.14**
    fc.assert(
      fc.property(invalidTrail, (t) => {
        const r = validateCodeTrail(t);
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.failures.length).toBeGreaterThan(0);
          for (const f of r.failures) {
            expect(f.field.length).toBeGreaterThan(0);
            expect(f.message.length).toBeGreaterThan(0);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe('validateCodeTrail unit tests', () => {
  const ok = (legs: TrailStep[][]) => validateCodeTrail(mkTrail('kw', legs));

  it('empty keyword fails on keyword field', () => {
    const r = validateCodeTrail(mkTrail('', [[step('annex', 'A'), step('table', 'T')]]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failures.some((f) => f.field === 'keyword')).toBe(true);
  });

  it('empty legs fails on legs field', () => {
    const r = validateCodeTrail(mkTrail('kw', []));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failures.some((f) => f.field === 'legs')).toBe(true);
  });

  it.each([
    ['ch1-8', [step('chapter', 'Chapter 3'), step('article', '300'), step('part', 'II'), step('section', '300.4'), step('notes', 'n')]],
    ['ch9', [step('chapter', 'Chapter 9'), step('table', 'Table 1'), step('notes', 'Note 2')]],
    ['annex', [step('annex', 'Annex C'), step('table', 'C.1')]],
    ['article 90', [step('article', 'Article 90'), step('section', '90.3')]],
    ['index', [step('index', 'Grounding'), step('table', 'T'), step('notes', 'n')]],
  ])('%s path is valid', (_n, leg) => {
    expect(ok([leg as TrailStep[]])).toEqual({ ok: true });
  });

  it.each([
    ['chapter->part', [step('chapter', 'Chapter 3'), step('part', 'I'), step('section', 's')]],
    ['ch9 with article', [step('chapter', 'Chapter 9'), step('article', 'a'), step('section', 's')]],
    ['annex with section', [step('annex', 'A'), step('section', 's')]],
    ['ends at article', [step('chapter', 'Chapter 3'), step('article', '300')]],
    ['index+two sections', [step('index', 'k'), step('section', 'a'), step('section', 'b')]],
    ['index+article', [step('index', 'k'), step('article', 'a')]],
    ['lone index', [step('index', 'k')]],
  ])('malformed %s fails', (_n, leg) => {
    expect(ok([leg as TrailStep[]]).ok).toBe(false);
  });

  it('unknown first step fails with a message listing valid starts', () => {
    const r = ok([[step('section', '110.3')]]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const msg = r.failures.map((f) => f.message).join(' ');
      for (const w of ['chapter', 'annex', 'index', 'article']) expect(msg).toContain(w);
    }
  });
});

// ---------- editionNote validation (CodeTrailDef) ----------

const baseTrail: CodeTrail = mkTrail('grounding', [
  [step('chapter', 'Chapter 2'), step('article', 'Article 250'), step('section', '250.50')],
]);
const defWith = (editionNote: string) =>
  defineCodeTrail({
    id: 'drill-1',
    label: 'Drill',
    trails: [baseTrail],
    hint: 'A paraphrased hint.',
    movedFrom: baseTrail,
    editionNote,
  });
const editionNoteFailures = (editionNote: string) => {
  const r = validateCodeTrail(defWith(editionNote));
  return r.ok ? [] : r.failures.filter((f) => f.field === 'editionNote');
};

describe('editionNote validation properties', () => {
  // Feature: skeleton-core, Property 14
  it('Property 14: editionNote of length 1-300 yields no editionNote failure', () => {
    // **Validates: Requirements 6.8, 6.9, 6.10**
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 300 }), (note) => {
        expect(editionNoteFailures(note)).toEqual([]);
        expect(validateCodeTrail(defWith(note))).toEqual({ ok: true });
      }),
      { numRuns: 100 },
    );
  });

  // Feature: skeleton-core, Property 14
  it('Property 14: editionNote of length 0 or over 300 yields an editionNote failure', () => {
    // **Validates: Requirements 6.8, 6.9, 6.10**
    const badNote = fc.oneof(
      fc.constant(''),
      fc.string({ minLength: 301, maxLength: 600 }),
    );
    fc.assert(
      fc.property(badNote, (note) => {
        expect(editionNoteFailures(note).length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});
