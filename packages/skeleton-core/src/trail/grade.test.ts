import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { gradeTrail, NO_PARTS } from './grade';
import type { DrillDef, UserPick } from './grade';
import { ALLOWED_LEVELS } from './types';
import type { CodeTrail, TrailLeg, TrailLevel, TrailStep } from './types';

const value = fc.string({ minLength: 1, maxLength: 30 });
const keyword = fc.string({ minLength: 1, maxLength: 30 });

const stepOf = (levels: readonly TrailLevel[]): fc.Arbitrary<TrailStep> =>
  fc.record({ level: fc.constantFrom(...levels), value });

const legOf = (levels: readonly TrailLevel[]): fc.Arbitrary<TrailLeg> =>
  fc
    .array(stepOf(levels), { minLength: 1, maxLength: 4 })
    .map((a) => a as unknown as TrailLeg);

const trailOf = (levels: readonly TrailLevel[]): fc.Arbitrary<CodeTrail> =>
  fc
    .record({
      keyword,
      legs: fc.array(legOf(levels), { minLength: 1, maxLength: 3 }),
    })
    .map((t) => t as unknown as CodeTrail);

// Index legs are explicitly included: one leg consisting solely of index steps.
const indexLeg: fc.Arbitrary<TrailLeg> = legOf(['index']);
const trailWithIndexLeg: fc.Arbitrary<CodeTrail> = fc
  .tuple(trailOf(ALLOWED_LEVELS), indexLeg)
  .map(([t, il]) => ({ keyword: t.keyword, legs: [...t.legs, il] }) as unknown as CodeTrail);

const anyTrail = fc.oneof(trailOf(ALLOWED_LEVELS), trailWithIndexLeg);

const noPartLevels = ALLOWED_LEVELS.filter((l) => l !== 'part');
const noPartTrail = fc.oneof(
  trailOf(noPartLevels),
  trailOf(noPartLevels).chain((t) =>
    indexLeg.map(
      (il) => ({ keyword: t.keyword, legs: [...t.legs, il] }) as unknown as CodeTrail,
    ),
  ),
);

const flat = (t: CodeTrail): TrailStep[] => t.legs.flatMap((l) => [...l]);
const picksOf = (t: CodeTrail): UserPick[] =>
  flat(t).map((s) => ({ level: s.level, value: s.value }));

const asTrails = (ts: CodeTrail[]) => ts as unknown as DrillDef['trails'];

const drillArb: fc.Arbitrary<DrillDef> = fc
  .record({
    trails: fc.array(anyTrail, { minLength: 1, maxLength: 3 }),
    movedFrom: fc.option(anyTrail, { nil: undefined }),
  })
  .map(({ trails, movedFrom }) =>
    movedFrom === undefined
      ? { trails: asTrails(trails) }
      : { trails: asTrails(trails), movedFrom },
  );

const pickArb: fc.Arbitrary<UserPick> = fc.record({
  level: fc.constantFrom(...ALLOWED_LEVELS),
  value: fc.oneof(value, fc.constant(NO_PARTS)),
});

describe('gradeTrail properties', () => {
  // Feature: skeleton-core, Property 3: gradeTrail self-match (round-trip)
  it('Property 3: picks built from any declared trail match', () => {
    // **Validates: Requirements 2.6, 2.7, 2.9**
    fc.assert(
      fc.property(
        fc.array(anyTrail, { minLength: 1, maxLength: 3 }),
        fc.nat(),
        fc.option(anyTrail, { nil: undefined }),
        (trails, idx, movedFrom) => {
          const drill: DrillDef =
            movedFrom === undefined
              ? { trails: asTrails(trails) }
              : { trails: asTrails(trails), movedFrom };
          const chosen = trails[idx % trails.length];
          const res = gradeTrail(drill, picksOf(chosen));
          expect(res.matched).toBe(true);
          expect(res.matchedMovedFrom).toBe(false);
          expect(res.stepResults.every((r) => r.verdict === 'correct')).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: skeleton-core, Property 3: self-match with index legs
  it('Property 3: trails containing index legs self-match', () => {
    // **Validates: Requirements 2.6, 2.7, 2.9**
    fc.assert(
      fc.property(trailWithIndexLeg, (t) => {
        const res = gradeTrail({ trails: [t] }, picksOf(t));
        expect(res.matched).toBe(true);
        expect(res.stepResults.length).toBe(flat(t).length);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: skeleton-core, Property 4: gradeTrail movedFrom discrimination
  it('Property 4: movedFrom picks give matchedMovedFrom without matched', () => {
    // **Validates: Requirements 2.10, 2.12**
    fc.assert(
      fc.property(
        fc.array(anyTrail, { minLength: 1, maxLength: 3 }),
        anyTrail,
        (trails, movedFrom) => {
          fc.pre(
            trails.every((t) => JSON.stringify(t) !== JSON.stringify(movedFrom)),
          );
          const res = gradeTrail(
            { trails: asTrails(trails), movedFrom },
            picksOf(movedFrom),
          );
          expect(res.matched).toBe(false);
          expect(res.matchedMovedFrom).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: skeleton-core, Property 5: gradeTrail determinism
  it('Property 5: same arguments yield structurally equal results', () => {
    // **Validates: Requirements 2.13, 2.14**
    fc.assert(
      fc.property(
        drillArb,
        fc.array(pickArb, { maxLength: 8 }),
        (drill, picks) => {
          expect(gradeTrail(drill, picks)).toEqual(gradeTrail(drill, picks));
        },
      ),
      { numRuns: 100 },
    );
    // Also with picks derived from the drill's own trails (partially corrupted).
    fc.assert(
      fc.property(drillArb, fc.nat(), (drill, n) => {
        const picks = picksOf(drill.trails[0]).slice(0, n % 6);
        expect(gradeTrail(drill, picks)).toEqual(gradeTrail(drill, picks));
      }),
      { numRuns: 100 },
    );
  });

  // Feature: skeleton-core, Property 6: NO_PARTS equivalence
  it('Property 6: NO_PARTS pick and omitted part pick match identically', () => {
    // **Validates: Requirements 2.15**
    fc.assert(
      fc.property(noPartTrail, fc.nat(), (t, pos) => {
        const base = picksOf(t);
        const at = pos % (base.length + 1);
        const withNone: UserPick[] = [
          ...base.slice(0, at),
          { level: 'part', value: NO_PARTS },
          ...base.slice(at),
        ];
        const a = gradeTrail({ trails: [t] }, withNone);
        const b = gradeTrail({ trails: [t] }, base);
        expect(a.matched).toBe(b.matched);
        expect(b.matched).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
