import { describe, expect, it } from "vitest";
import { evaluateWhen } from "../context";

describe("evaluateWhen", () => {
  it("returns true when clause is null (always match)", () => {
    expect(evaluateWhen(null, new Map())).toBe(true);
  });

  it("evaluates a positive key", () => {
    const ctx = new Map([["inputFocused", true]]);
    expect(evaluateWhen("inputFocused", ctx)).toBe(true);
  });

  it("evaluates a negated key", () => {
    const ctx = new Map([["inputFocused", false]]);
    expect(evaluateWhen("!inputFocused", ctx)).toBe(true);
  });

  it("evaluates conjunction (&&)", () => {
    const ctx = new Map([
      ["inputFocused", false],
      ["dialogOpen", false],
    ]);
    expect(evaluateWhen("!inputFocused && !dialogOpen", ctx)).toBe(true);
  });

  it("fails when one condition is false", () => {
    const ctx = new Map([
      ["inputFocused", true],
      ["dialogOpen", false],
    ]);
    expect(evaluateWhen("!inputFocused && !dialogOpen", ctx)).toBe(false);
  });

  it("treats missing key as falsy", () => {
    const ctx = new Map<string, boolean>();
    expect(evaluateWhen("!inputFocused", ctx)).toBe(true);
    expect(evaluateWhen("inputFocused", ctx)).toBe(false);
  });
});

describe("evaluateWhen edge cases", () => {
  it("handles empty string (treated as truthy — no conditions to fail)", () => {
    expect(evaluateWhen("", new Map())).toBe(true);
  });

  it("handles whitespace-only string", () => {
    expect(evaluateWhen("  ", new Map())).toBe(true);
  });

  it("handles trailing &&", () => {
    const ctx = new Map([["inputFocused", false]]);
    // "!inputFocused &&" splits to ["!inputFocused", ""] — empty token is truthy
    expect(evaluateWhen("!inputFocused &&", ctx)).toBe(true);
  });

  it("handles leading &&", () => {
    const ctx = new Map([["inputFocused", false]]);
    expect(evaluateWhen("&& !inputFocused", ctx)).toBe(true);
  });

  it("handles unknown context key as falsy", () => {
    expect(evaluateWhen("unknownKey", new Map())).toBe(false);
    expect(evaluateWhen("!unknownKey", new Map())).toBe(true);
  });
});
