import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { defineCodeTrail } from './defineCodeTrail.js';
import type { CodeTrailDef } from './types.js';
import type { CodeTrail, TrailStep } from '../trail/types.js';
import { ALLOWED_LEVELS } from '../trail/types.js';

const stepArb: fc.Arbitrary<TrailStep> = fc.record({
  level: fc.constantFrom(...ALLOWED_LEVELS),
  value: fc.string({ minLength: 1, maxLength: 20 }),
});

const trailArb: fc.Arbitrary<CodeTrail> = fc.record({
  keyword: fc.string({ minLength: 1, maxLength: 20 }),
  legs: fc.tuple(
    fc.tuple(stepArb, fc.array(stepArb, { maxLength: 3 })),
    fc.array(fc.tuple(stepArb, fc.array(stepArb, { maxLength: 3 })), { maxLength: 2 }),
  ).map(([first, rest]) => {
    const toLeg = ([h, t]: [TrailStep, TrailStep[]]) => [h, ...t] as const;
    return [toLeg(first), ...rest.map(toLeg)] as const;
  }),
});

const defArb: fc.Arbitrary<CodeTrailDef> = fc.record(
  {
    id: fc.string({ minLength: 1, maxLength: 128 }),
    label: fc.string({ minLength: 1, maxLength: 128 }),
    trails: fc
      .tuple(trailArb, fc.array(trailArb, { maxLength: 2 }))
      .map(([h, t]) => [h, ...t] as const),
    hint: fc.string({ minLength: 1, maxLength: 500 }),
    movedFrom: trailArb,
    editionNote: fc.string({ minLength: 1, maxLength: 300 }),
  },
  { requiredKeys: ['id', 'label', 'trails', 'hint'] },
);

describe('defineCodeTrail', () => {
  // Feature: skeleton-core, Property 8: defineCodeTrail is identity
  it('Property 8: returns the same object reference', () => {
    // **Validates: Requirements 6.1**
    fc.assert(
      fc.property(defArb, (def) => {
        expect(defineCodeTrail(def)).toBe(def);
      }),
      { numRuns: 100 },
    );
  });

  const trail: CodeTrail = {
    keyword: 'box fill',
    legs: [[{ level: 'chapter', value: '3' }]],
  };

  it('accepts a minimal valid definition', () => {
    const def: CodeTrailDef = { id: 'a', label: 'A', trails: [trail], hint: 'h' };
    expect(defineCodeTrail(def)).toBe(def);
  });

  // Req 6.4: omitted required fields are compile errors (checked by tsc, not at runtime).
  it('rejects omitted required fields at compile time', () => {
    // @ts-expect-error missing id
    defineCodeTrail({ label: 'A', trails: [trail], hint: 'h' });
    // @ts-expect-error missing label
    defineCodeTrail({ id: 'a', trails: [trail], hint: 'h' });
    // @ts-expect-error missing trails
    defineCodeTrail({ id: 'a', label: 'A', hint: 'h' });
    // @ts-expect-error missing hint
    defineCodeTrail({ id: 'a', label: 'A', trails: [trail] });
    // @ts-expect-error empty trails tuple
    defineCodeTrail({ id: 'a', label: 'A', trails: [], hint: 'h' });
  });
});
