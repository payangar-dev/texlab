import { describe, expect, it } from "vitest";
import {
  colors,
  fontSizes,
  fonts,
  fontWeights,
  iconSizes,
  opacities,
  radii,
  shadows,
  sizing,
  spacing,
  zIndices,
} from "./theme";

describe("theme scales", () => {
  it("fontSizes floor is at or above the initial 11 px floor (SC-007)", () => {
    // SC-007 pins the *initial* floor at 11 px. Raising the smallest
    // entry is allowed (re-tune for legibility); dropping below 11 is not.
    expect(Math.min(...Object.values(fontSizes))).toBeGreaterThanOrEqual(11);
  });

  it("iconSizes floor is at or above the initial 12 px floor (SC-007)", () => {
    expect(Math.min(...Object.values(iconSizes))).toBeGreaterThanOrEqual(12);
  });

  it("every scale object is non-empty", () => {
    expect(Object.keys(colors).length).toBeGreaterThan(0);
    expect(Object.keys(fonts).length).toBeGreaterThan(0);
    expect(Object.keys(fontSizes).length).toBeGreaterThan(0);
    expect(Object.keys(fontWeights).length).toBeGreaterThan(0);
    expect(Object.keys(spacing).length).toBeGreaterThan(0);
    expect(Object.keys(sizing).length).toBeGreaterThan(0);
    expect(Object.keys(iconSizes).length).toBeGreaterThan(0);
    expect(Object.keys(radii).length).toBeGreaterThan(0);
    expect(Object.keys(shadows).length).toBeGreaterThan(0);
    expect(Object.keys(opacities).length).toBeGreaterThan(0);
    expect(Object.keys(zIndices).length).toBeGreaterThan(0);
  });

  it("every colour value is a valid CSS colour (hex, rgba, keyword, or bare RGB triplet)", () => {
    const rgbTriplet = /^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/;
    const cssColour =
      /^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\([^)]+\)|[a-z]+)$/;
    for (const [name, value] of Object.entries(colors)) {
      const ok = cssColour.test(value) || rgbTriplet.test(value);
      expect(ok, `colors.${name} = ${value}`).toBe(true);
    }
  });

  it("nested sizing subobjects contain numeric values", () => {
    for (const group of [
      sizing.button,
      sizing.input,
      sizing.dialog,
      sizing.windowButton,
    ]) {
      expect(Object.keys(group).length).toBeGreaterThan(0);
      for (const [key, value] of Object.entries(group)) {
        expect(typeof value, `sizing.*.${key}`).toBe("number");
      }
    }
  });

  it("z-index ladder preserves dropdown < dialog < toast", () => {
    expect(zIndices.dropdown).toBeLessThan(zIndices.dialog);
    expect(zIndices.dialog).toBeLessThan(zIndices.toast);
  });

  it("opacities stay within [0, 1]", () => {
    for (const [name, value] of Object.entries(opacities)) {
      expect(value, `opacities.${name}`).toBeGreaterThanOrEqual(0);
      expect(value, `opacities.${name}`).toBeLessThanOrEqual(1);
    }
  });
});
