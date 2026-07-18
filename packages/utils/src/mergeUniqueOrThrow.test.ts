import { describe, expect, it } from "vitest";
import { mergeUniqueOrThrow } from "./mergeUniqueOrThrow.js";

describe("mergeUniqueOrThrow", () => {
  it("merges objects with disjoint keys", () => {
    expect(mergeUniqueOrThrow({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("throws on an overlapping key", () => {
    expect(() => mergeUniqueOrThrow({ a: 1 }, { a: 2 })).toThrow(
      /Duplicate key detected: "a"/,
    );
  });

  it("throws on an overlapping symbol key", () => {
    const shared = Symbol("shared");
    expect(() => mergeUniqueOrThrow({ [shared]: 1 }, { [shared]: 2 })).toThrow(
      /Duplicate key detected: "Symbol\(shared\)"/,
    );
  });

  it("merges disjoint symbol keys", () => {
    const first = Symbol("first");
    const second = Symbol("second");
    const merged = mergeUniqueOrThrow({ [first]: 1 }, { [second]: 2 });
    expect(merged[first]).toBe(1);
    expect(merged[second]).toBe(2);
  });

  it("does not treat a key obj1 merely inherits as a duplicate", () => {
    const merged = mergeUniqueOrThrow({ a: 1 }, { toString: () => "custom" });
    expect(merged.a).toBe(1);
    expect(String(merged)).toBe("custom");
  });

  it("does not mutate its inputs", () => {
    const a = { x: 1 };
    const b = { y: 2 };
    mergeUniqueOrThrow(a, b);
    expect(a).toEqual({ x: 1 });
    expect(b).toEqual({ y: 2 });
  });
});