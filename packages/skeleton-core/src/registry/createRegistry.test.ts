import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { createRegistry } from "./createRegistry.js";
import type { RegistryEntry } from "./types.js";

const entry = (id: unknown, extra: Record<string, unknown> = {}): RegistryEntry =>
  ({ id, ...extra }) as unknown as RegistryEntry;

const idArb = fc.string({ minLength: 1, maxLength: 20 });

describe("createRegistry properties", () => {
  // Feature: skeleton-core, Property 10: Registry lookup round-trip
  // **Validates: Requirements 7.5, 7.9**
  it("Property 10: lookup returns the identical object registered", () => {
    fc.assert(
      fc.property(fc.uniqueArray(idArb, { minLength: 1, maxLength: 1000 }), (ids) => {
        const reg = createRegistry();
        const entries = ids.map((id) => entry(id));
        entries.forEach((e) => reg.register(e));
        entries.forEach((e, i) => {
          expect(reg.lookup(ids[i])).toBe(e);
        });
      }),
      { numRuns: 100 },
    );
  });

  // Feature: skeleton-core, Property 11: Registry list length invariant
  // **Validates: Requirements 7.7, 7.8**
  it("Property 11: list length equals number of register calls", () => {
    fc.assert(
      fc.property(fc.uniqueArray(idArb, { maxLength: 1000 }), (ids) => {
        const reg = createRegistry();
        ids.forEach((id, i) => {
          reg.register(entry(id));
          expect(reg.list().length).toBe(i + 1);
        });
        expect(reg.list().length).toBe(ids.length);
      }),
      { numRuns: 100 },
    );
  });
});

describe("createRegistry unit tests", () => {
  // **Validates: Requirements 7.4**
  it("throws on duplicate id with the id in the message", () => {
    const reg = createRegistry();
    reg.register(entry("dup"));
    expect(() => reg.register(entry("dup"))).toThrow(/dup/);
    expect(reg.list().length).toBe(1);
  });

  // **Validates: Requirements 7.3**
  it.each([
    ["absent", {}],
    ["number", { id: 5 }],
    ["null", { id: null }],
    ["empty", { id: "" }],
  ])("throws on invalid id (%s)", (_name, e) => {
    const reg = createRegistry();
    expect(() => reg.register(e as unknown as RegistryEntry)).toThrow();
    expect(reg.list().length).toBe(0);
  });

  // **Validates: Requirements 7.6**
  it("returns undefined for unknown id", () => {
    expect(createRegistry().lookup("nope")).toBeUndefined();
  });

  // **Validates: Requirements 7.7**
  it("mutating the list() result does not alter the registry", () => {
    const reg = createRegistry();
    const a = entry("a");
    reg.register(a);
    const listed = reg.list() as RegistryEntry[];
    listed.push(entry("b"));
    listed.length = 0;
    expect(reg.list()).toEqual([a]);
    expect(reg.lookup("b")).toBeUndefined();
  });
});
