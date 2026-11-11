import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { defineCalcPlugin } from './defineCalcPlugin.js';
import type { CalcInput, CalcOutput, CalcPluginDef } from './types.js';
import type { CodeTrail } from '../trail/types.js';

type I = { x: number };
type O = { y: number };

const name = fc.string({ minLength: 1, maxLength: 100 });

const calcInput: fc.Arbitrary<CalcInput> = fc.record({
  name,
  type: fc.constantFrom('number', 'string', 'select' as const),
});
const calcOutput: fc.Arbitrary<CalcOutput> = fc.record({
  name,
  type: fc.constantFrom('number', 'string' as const),
});

const trail = {
  keyword: 'k',
  legs: [[{ level: 'article', value: '310' }]],
} as unknown as CodeTrail;

const pluginDef: fc.Arbitrary<CalcPluginDef<I, O>> = fc
  .record({
    id: name,
    label: fc.string({ minLength: 1, maxLength: 120 }),
    inputs: fc.tuple(calcInput, fc.array(calcInput, { maxLength: 3 })),
    outputs: fc.tuple(calcOutput, fc.array(calcOutput, { maxLength: 3 })),
    invId: name,
    description: fc.string({ minLength: 1, maxLength: 200 }),
  })
  .map((r) => ({
    id: r.id,
    label: r.label,
    inputs: [r.inputs[0], ...r.inputs[1]] as const,
    outputs: [r.outputs[0], ...r.outputs[1]] as const,
    calculate: (i: I): O => ({ y: i.x }),
    trails: () => [trail] as const,
    invariants: [
      { id: r.invId, description: r.description, check: () => true },
    ] as const,
  }));

describe('defineCalcPlugin', () => {
  // Feature: skeleton-core, Property 7
  it('returns the same object reference it receives', () => {
    // **Validates: Requirements 3.1**
    fc.assert(
      fc.property(pluginDef, (def) => {
        expect(defineCalcPlugin(def)).toBe(def);
      }),
      { numRuns: 100 },
    );
  });

  const valid = (): CalcPluginDef<I, O> => ({
    id: 'p',
    label: 'P',
    inputs: [{ name: 'x', type: 'number' }],
    outputs: [{ name: 'y', type: 'number' }],
    calculate: (i) => ({ y: i.x }),
    trails: () => [trail],
    invariants: [{ id: 'inv', description: 'd', check: () => true }],
  });

  it('accepts a complete definition', () => {
    const def = valid();
    expect(defineCalcPlugin(def)).toBe(def);
  });

  it('rejects at compile time a definition missing id', () => {
    const { id: _id, ...rest } = valid();
    // @ts-expect-error id is required
    defineCalcPlugin<I, O>(rest);
  });

  it('rejects at compile time a definition missing label', () => {
    const { label: _l, ...rest } = valid();
    // @ts-expect-error label is required
    defineCalcPlugin<I, O>(rest);
  });

  it('rejects at compile time a definition missing calculate', () => {
    const { calculate: _c, ...rest } = valid();
    // @ts-expect-error calculate is required
    defineCalcPlugin<I, O>(rest);
  });

  it('rejects at compile time a definition missing trails', () => {
    const { trails: _t, ...rest } = valid();
    // @ts-expect-error trails is required
    defineCalcPlugin<I, O>(rest);
  });

  it('rejects at compile time a definition missing invariants', () => {
    const { invariants: _v, ...rest } = valid();
    // @ts-expect-error invariants is required
    defineCalcPlugin<I, O>(rest);
  });

  it('rejects at compile time empty inputs / outputs / invariants tuples', () => {
    // @ts-expect-error inputs must be non-empty
    defineCalcPlugin<I, O>({ ...valid(), inputs: [] });
    // @ts-expect-error outputs must be non-empty
    defineCalcPlugin<I, O>({ ...valid(), outputs: [] });
    // @ts-expect-error invariants must be non-empty
    defineCalcPlugin<I, O>({ ...valid(), invariants: [] });
  });
});
