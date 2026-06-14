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

  it("does not mutate its inputs", () => {
    const a = { x: 1 };
    const b = { y: 2 };
    mergeUniqueOrThrow(a, b);
    expect(a).toEqual({ x: 1 });
    expect(b).toEqual({ y: 2 });
  });
});