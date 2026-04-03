import { describe, expect, it } from "vitest";
import { normalizeKeyEvent } from "../keybindingRegistry";

function makeEvent(
  init: Partial<KeyboardEventInit> & { key?: string; code?: string },
): KeyboardEvent {
  return new KeyboardEvent("keydown", { bubbles: true, ...init });
}

describe("normalizeKeyEvent", () => {
  it("normalizes a simple letter key", () => {
    expect(normalizeKeyEvent(makeEvent({ key: "b" }))).toBe("b");
  });

  it("normalizes uppercase letter to lowercase", () => {
    expect(normalizeKeyEvent(makeEvent({ key: "B", shiftKey: true }))).toBe("Shift+b");
  });

  it("normalizes Mod+z (Ctrl)", () => {
    expect(normalizeKeyEvent(makeEvent({ key: "z", ctrlKey: true }))).toBe("Mod+z");
  });

  it("normalizes Mod+z (Meta)", () => {
    expect(normalizeKeyEvent(makeEvent({ key: "z", metaKey: true }))).toBe("Mod+z");
  });

  it("normalizes Mod+Shift+z", () => {
    expect(
      normalizeKeyEvent(makeEvent({ key: "Z", ctrlKey: true, shiftKey: true })),
    ).toBe("Mod+Shift+z");
  });

  it("strips Shift for code-mapped keys: Ctrl+Shift+= normalizes to Mod+=", () => {
    expect(
      normalizeKeyEvent(
        makeEvent({ key: "+", code: "Equal", ctrlKey: true, shiftKey: true }),
      ),
    ).toBe("Mod+=");
  });

  it("strips Shift for code-mapped keys: Ctrl+= without Shift also normalizes to Mod+=", () => {
    expect(normalizeKeyEvent(makeEvent({ key: "=", code: "Equal", ctrlKey: true }))).toBe(
      "Mod+=",
    );
  });

  it("normalizes Mod+- via code map", () => {
    expect(normalizeKeyEvent(makeEvent({ key: "-", code: "Minus", ctrlKey: true }))).toBe(
      "Mod+-",
    );
  });

  it("normalizes Space via code", () => {
    expect(normalizeKeyEvent(makeEvent({ key: " ", code: "Space" }))).toBe("Space");
  });

  it("normalizes Delete key", () => {
    expect(normalizeKeyEvent(makeEvent({ key: "Delete" }))).toBe("Delete");
  });

  it("normalizes BracketLeft via code map to [", () => {
    expect(normalizeKeyEvent(makeEvent({ key: "[", code: "BracketLeft" }))).toBe("[");
  });

  it("normalizes BracketRight via code map to ]", () => {
    expect(normalizeKeyEvent(makeEvent({ key: "]", code: "BracketRight" }))).toBe("]");
  });

  it("normalizes Digit0 via code map", () => {
    expect(
      normalizeKeyEvent(makeEvent({ key: "0", code: "Digit0", ctrlKey: true })),
    ).toBe("Mod+0");
  });

  it("normalizes Digit1 via code map", () => {
    expect(
      normalizeKeyEvent(makeEvent({ key: "1", code: "Digit1", ctrlKey: true })),
    ).toBe("Mod+1");
  });

  it("returns null for modifier-only keys", () => {
    expect(normalizeKeyEvent(makeEvent({ key: "Control" }))).toBeNull();
    expect(normalizeKeyEvent(makeEvent({ key: "Shift" }))).toBeNull();
    expect(normalizeKeyEvent(makeEvent({ key: "Alt" }))).toBeNull();
    expect(normalizeKeyEvent(makeEvent({ key: "Meta" }))).toBeNull();
  });

  it("handles Alt modifier prefix", () => {
    expect(normalizeKeyEvent(makeEvent({ key: "a", altKey: true }))).toBe("Alt+a");
  });

  it("preserves modifier order: Mod+Alt+Shift", () => {
    expect(
      normalizeKeyEvent(
        makeEvent({ key: "A", ctrlKey: true, altKey: true, shiftKey: true }),
      ),
    ).toBe("Mod+Alt+Shift+a");
  });
});
