import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { gradeTrail, NO_PARTS } from './grade.js';
import type { DrillDef, UserPick } from './grade.js';
import { ALLOWED_LEVELS } from './types.js';
import type { CodeTrail, TrailLeg, TrailLevel, TrailStep } from './types.js';

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
    // **Validates: Requirements 2.6, 2.14**
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
    // **Validates: Requirements 2.6, 2.14**
    fc.assert(
      fc.property(trailWithIndexLeg, (t) => {
        const res = gradeTrail({ trails: [t] }, picksOf(t));
        expect(res.matched).toBe(true);
        expect(res.stepResults.length).toBe(flat(t).length);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: skeleton-core, Property 3: self-match with repeated index section steps
  it('Property 3: index trails with repeated section steps self-match', () => {
    // **Validates: Requirements 2.6, 2.14**
    const repeatedIndexTrail = fc
      .tuple(
        keyword,
        value,
        fc.array(
          fc.record({ level: fc.constantFrom<TrailLevel>('section', 'table'), value }),
          { minLength: 2, maxLength: 5 },
        ),
      )
      .map(
        ([k, iv, tail]) =>
          ({
            keyword: k,
            legs: [[{ level: 'index', value: iv }, ...tail]],
          }) as unknown as CodeTrail,
      );
    fc.assert(
      fc.property(repeatedIndexTrail, (t) => {
        const res = gradeTrail({ trails: [t] }, picksOf(t));
        expect(res.matched).toBe(true);
        expect(res.stepResults.every((r) => r.verdict === 'correct')).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: skeleton-core, Property 4: gradeTrail movedFrom discrimination
  it('Property 4: movedFrom picks give matchedMovedFrom without matched', () => {
    // **Validates: Requirements 2.7**
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
    // **Validates: Requirements 2.12, 2.13**
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
    // **Validates: Requirements 2.15, 2.19**
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
        expect(a.stepResults).toEqual(b.stepResults);
        expect(a.stepResults.some((r) => r.level === 'part')).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: skeleton-core, Property 15
  it('Property 15: extra non-NO_PARTS part pick on a part-less trail', () => {
    // **Validates: Requirements 2.16, 2.17, 2.18**
    fc.assert(
      fc.property(
        noPartTrail,
        fc.nat(),
        value.filter((v) => v !== NO_PARTS),
        (t, pos, extra) => {
          const base = picksOf(t);
          const at = pos % (base.length + 1);
          const picks: UserPick[] = [
            ...base.slice(0, at),
            { level: 'part', value: extra },
            ...base.slice(at),
          ];
          const res = gradeTrail({ trails: [t] }, picks);
          expect(res.matched).toBe(false);
          expect(res.matchedMovedFrom).toBe(false);
          const parts = res.stepResults.filter((r) => r.level === 'part');
          expect(parts).toEqual([{ level: 'part', verdict: 'incorrect' }]);
          const real = res.stepResults.filter((r) => r.level !== 'part');
          expect(real.length).toBe(base.length);
          expect(real.every((r) => r.verdict === 'correct')).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('gradeTrail part-pick handling', () => {
  const st = (level: TrailLevel, v: string): TrailStep => ({ level, value: v });
  const mk = (...legs: TrailStep[][]): CodeTrail =>
    ({ keyword: 'k', legs }) as unknown as CodeTrail;
  const pk = (level: TrailLevel, v: string): UserPick => ({ level, value: v });
  const levels = (r: { stepResults: { level: TrailLevel }[] }) =>
    r.stepResults.map((s) => s.level);

  it('main-chapter trail with an extra part pick: synthetic entry after article', () => {
    const t = mk([st('chapter', '3'), st('article', '314'), st('section', '314.16')]);
    const res = gradeTrail({ trails: [t] }, [
      pk('chapter', '3'),
      pk('article', '314'),
      pk('part', 'II'),
      pk('section', '314.16'),
    ]);
    expect(res.matched).toBe(false);
    expect(res.stepResults).toEqual([
      { level: 'chapter', verdict: 'correct' },
      { level: 'article', verdict: 'correct' },
      { level: 'part', verdict: 'incorrect' },
      { level: 'section', verdict: 'correct' },
    ]);
  });

  it('index leg (no article): synthetic entry goes before first section/table', () => {
    const t = mk([st('index', 'x'), st('section', '1.1')]);
    const res = gradeTrail({ trails: [t] }, [
      pk('index', 'x'),
      pk('part', 'I'),
      pk('section', '1.1'),
    ]);
    expect(levels(res)).toEqual(['index', 'part', 'section']);
    expect(res.stepResults[1].verdict).toBe('incorrect');
    expect(res.matched).toBe(false);
  });

  it('chapter 9 trail (no article): synthetic entry goes before table', () => {
    const t = mk([st('chapter', '9'), st('table', 'Table 1')]);
    const res = gradeTrail({ trails: [t] }, [
      pk('chapter', '9'),
      pk('part', 'I'),
      pk('table', 'Table 1'),
    ]);
    expect(levels(res)).toEqual(['chapter', 'part', 'table']);
    expect(res.matched).toBe(false);
  });

  it('no article/section/table: synthetic entry appended at end', () => {
    const t = mk([st('chapter', '9'), st('annex', 'C')]);
    const res = gradeTrail({ trails: [t] }, [pk('chapter', '9'), pk('annex', 'C'), pk('part', 'I')]);
    expect(levels(res)).toEqual(['chapter', 'annex', 'part']);
    expect(res.stepResults[2].verdict).toBe('incorrect');
  });

  it('multi-leg trail yields exactly one synthetic entry', () => {
    const t = mk([st('article', '90'), st('section', '90.1')], [st('article', '100')]);
    const res = gradeTrail({ trails: [t] }, [
      pk('article', '90'),
      pk('part', 'I'),
      pk('part', 'II'),
      pk('section', '90.1'),
      pk('article', '100'),
    ]);
    expect(res.stepResults.filter((r) => r.level === 'part').length).toBe(1);
    expect(res.matched).toBe(false);
  });

  it('NO_PARTS pick or no part pick adds no entry and stays correct', () => {
    const t = mk([st('chapter', '3'), st('article', '314'), st('section', '314.16')]);
    const real = [pk('chapter', '3'), pk('article', '314'), pk('section', '314.16')];
    const withNone = gradeTrail({ trails: [t] }, [real[0], real[1], pk('part', NO_PARTS), real[2]]);
    const without = gradeTrail({ trails: [t] }, real);
    expect(withNone.matched).toBe(true);
    expect(without.matched).toBe(true);
    expect(withNone.stepResults).toEqual(without.stepResults);
    expect(withNone.stepResults.length).toBe(3);
  });

  it('trail with a part step plus NO_PARTS pick is incorrect, no synthetic entry', () => {
    const t = mk([st('chapter', '3'), st('article', '314'), st('part', 'II'), st('section', '314.16')]);
    const res = gradeTrail({ trails: [t] }, [
      pk('chapter', '3'),
      pk('article', '314'),
      pk('part', NO_PARTS),
      pk('section', '314.16'),
    ]);
    expect(res.matched).toBe(false);
    expect(res.stepResults.length).toBe(4);
    expect(res.stepResults[2]).toEqual({ level: 'part', verdict: 'incorrect' });
  });

  it('movedFrom branch: part misfire prevents a movedFrom match', () => {
    const cur = mk([st('article', '1'), st('section', '1.1')]);
    const old = mk([st('article', '2'), st('section', '2.1')]);
    const res = gradeTrail({ trails: [cur], movedFrom: old }, [
      pk('article', '2'),
      pk('part', 'I'),
      pk('section', '2.1'),
    ]);
    expect(res.matchedMovedFrom).toBe(false);
    expect(res.matched).toBe(false);
  });
});
