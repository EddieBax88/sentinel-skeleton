import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { runInvariants } from '../../src-test-utils/runInvariants.js';
import type { CalcPluginDef } from './types.js';
import type { CodeTrail } from '../trail/types.js';

type I = { x: number };
type O = { y: number };

const trail = {
  keyword: 'k',
  legs: [[{ level: 'article', value: '310' }]],
} as unknown as CodeTrail;

function makePlugin(
  calculate: (i: I) => O,
  invariants: CalcPluginDef<I, O>['invariants']
): CalcPluginDef<I, O> {
  return {
    id: 'test-plugin',
    label: 'Test plugin',
    inputs: [{ name: 'x', type: 'number' }],
    outputs: [{ name: 'y', type: 'number' }],
    calculate,
    trails: () => [trail],
    invariants,
  };
}

const arbI: fc.Arbitrary<I> = fc.record({ x: fc.integer({ min: -1000, max: 1000 }) });

describe('runInvariants', () => {
  it('reports fail with a non-empty counterexample for an always-false invariant (Req 3.9)', () => {
    const plugin = makePlugin((i) => ({ y: i.x }), [
      { id: 'never', description: 'always false', check: () => false },
    ]);
    const reports = runInvariants(plugin, { never: arbI });
    expect(reports).toHaveLength(1);
    expect(reports[0].invariantId).toBe('never');
    expect(reports[0].status).toBe('fail');
    expect(reports[0].counterexample).toBeTruthy();
    expect(reports[0].counterexample!.length).toBeGreaterThan(0);
  });

  it('reports pass with null counterexample for identity calculate (Reqs 3.8, 3.11)', () => {
    const plugin = makePlugin((i) => ({ y: i.x }), [
      { id: 'eq-a', description: 'output equals input', check: (i, o) => o.y === i.x },
      { id: 'eq-b', description: 'output equals input again', check: (i, o) => o.y === i.x },
    ]);
    const reports = runInvariants(plugin, { 'eq-a': arbI, 'eq-b': arbI });
    expect(reports).toHaveLength(2);
    for (const r of reports) {
      expect(r.status).toBe('pass');
      expect(r.counterexample).toBeNull();
    }
  });

  it('records fail when calculate throws and still runs remaining invariants (Req 3.10)', () => {
    const plugin = makePlugin(
      () => {
        throw new Error('boom');
      },
      [
        { id: 'first', description: 'first', check: () => true },
        { id: 'second', description: 'second', check: () => true },
      ]
    );
    let reports: ReturnType<typeof runInvariants> = [];
    expect(() => {
      reports = runInvariants(plugin, { first: arbI, second: arbI });
    }).not.toThrow();
    expect(reports.map((r) => r.invariantId)).toEqual(['first', 'second']);
    for (const r of reports) {
      expect(r.status).toBe('fail');
      expect(r.counterexample).toBeTruthy();
    }
  });

  it('records fail with a descriptive counterexample when an arbitrary is missing', () => {
    const plugin = makePlugin((i) => ({ y: i.x }), [
      { id: 'has-arb', description: 'has arbitrary', check: () => true },
      { id: 'no-arb', description: 'missing arbitrary', check: () => true },
    ]);
    const reports = runInvariants(plugin, { 'has-arb': arbI });
    expect(reports).toHaveLength(2);
    expect(reports[0].status).toBe('pass');
    expect(reports[1].invariantId).toBe('no-arb');
    expect(reports[1].status).toBe('fail');
    expect(reports[1].counterexample).toContain('no-arb');
  });

  // Feature: skeleton-core, Property 12: calculate determinism
  it('calculate returns deeply equal outputs when called twice with the same input', () => {
    // **Validates: Requirements 4.2**
    const pluginArb = fc
      .record({ k: fc.integer({ min: -50, max: 50 }), c: fc.integer({ min: -50, max: 50 }) })
      .map(({ k, c }) => makePlugin((i) => ({ y: i.x * k + c }), [
        { id: 'inv', description: 'trivial', check: () => true },
      ]));
    fc.assert(
      fc.property(pluginArb, arbI, (plugin, input) => {
        expect(plugin.calculate(input)).toEqual(plugin.calculate(input));
      }),
      { numRuns: 100 }
    );
  });
});
