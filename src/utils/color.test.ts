import { describe, expect, it } from "vitest";
import { colorToGradientPos, hexToRgb, hsvToRgb, rgbToHex, rgbToHsv } from "./color";

describe("hsvToRgb", () => {
  it("converts pure red", () => {
    expect(hsvToRgb({ h: 0, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("converts pure green", () => {
    expect(hsvToRgb({ h: 120, s: 1, v: 1 })).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("converts pure blue", () => {
    expect(hsvToRgb({ h: 240, s: 1, v: 1 })).toEqual({ r: 0, g: 0, b: 255 });
  });

  it("converts yellow", () => {
    expect(hsvToRgb({ h: 60, s: 1, v: 1 })).toEqual({ r: 255, g: 255, b: 0 });
  });

  it("converts cyan", () => {
    expect(hsvToRgb({ h: 180, s: 1, v: 1 })).toEqual({ r: 0, g: 255, b: 255 });
  });

  it("converts magenta", () => {
    expect(hsvToRgb({ h: 300, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 255 });
  });

  it("converts black (v=0)", () => {
    expect(hsvToRgb({ h: 0, s: 0, v: 0 })).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("converts white (s=0, v=1)", () => {
    expect(hsvToRgb({ h: 0, s: 0, v: 1 })).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("converts gray (s=0, v=0.5)", () => {
    expect(hsvToRgb({ h: 0, s: 0, v: 0.5 })).toEqual({ r: 128, g: 128, b: 128 });
  });

  it("treats h=360 the same as h=0 (red)", () => {
    expect(hsvToRgb({ h: 360, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 });
  });
});

describe("rgbToHsv", () => {
  it("converts pure red", () => {
    const hsv = rgbToHsv(255, 0, 0);
    expect(hsv.h).toBeCloseTo(0);
    expect(hsv.s).toBeCloseTo(1);
    expect(hsv.v).toBeCloseTo(1);
  });

  it("converts pure green", () => {
    const hsv = rgbToHsv(0, 255, 0);
    expect(hsv.h).toBeCloseTo(120);
    expect(hsv.s).toBeCloseTo(1);
    expect(hsv.v).toBeCloseTo(1);
  });

  it("converts pure blue", () => {
    const hsv = rgbToHsv(0, 0, 255);
    expect(hsv.h).toBeCloseTo(240);
    expect(hsv.s).toBeCloseTo(1);
    expect(hsv.v).toBeCloseTo(1);
  });

  it("converts yellow", () => {
    const hsv = rgbToHsv(255, 255, 0);
    expect(hsv.h).toBeCloseTo(60);
    expect(hsv.s).toBeCloseTo(1);
    expect(hsv.v).toBeCloseTo(1);
  });

  it("converts cyan", () => {
    const hsv = rgbToHsv(0, 255, 255);
    expect(hsv.h).toBeCloseTo(180);
    expect(hsv.s).toBeCloseTo(1);
    expect(hsv.v).toBeCloseTo(1);
  });

  it("converts magenta", () => {
    const hsv = rgbToHsv(255, 0, 255);
    expect(hsv.h).toBeCloseTo(300);
    expect(hsv.s).toBeCloseTo(1);
    expect(hsv.v).toBeCloseTo(1);
  });

  it("handles negative hue correction (red sector, g < b)", () => {
    const hsv = rgbToHsv(255, 0, 128);
    expect(hsv.h).toBeGreaterThanOrEqual(0);
    expect(hsv.h).toBeLessThan(360);
  });

  it("converts black", () => {
    const hsv = rgbToHsv(0, 0, 0);
    expect(hsv.h).toBe(0);
    expect(hsv.s).toBe(0);
    expect(hsv.v).toBe(0);
  });

  it("converts white", () => {
    const hsv = rgbToHsv(255, 255, 255);
    expect(hsv.h).toBe(0);
    expect(hsv.s).toBe(0);
    expect(hsv.v).toBeCloseTo(1);
  });

  it("converts gray", () => {
    const hsv = rgbToHsv(128, 128, 128);
    expect(hsv.h).toBe(0);
    expect(hsv.s).toBe(0);
    expect(hsv.v).toBeCloseTo(128 / 255);
  });
});

describe("HSV↔RGB round-trip", () => {
  it.each([
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 0 },
    { r: 0, g: 0, b: 255 },
    { r: 255, g: 255, b: 0 },
    { r: 0, g: 255, b: 255 },
    { r: 255, g: 0, b: 255 },
    { r: 0, g: 0, b: 0 },
    { r: 255, g: 255, b: 255 },
    { r: 128, g: 128, b: 128 },
    { r: 200, g: 100, b: 50 },
  ])("round-trips rgb($r, $g, $b)", ({ r, g, b }) => {
    const hsv = rgbToHsv(r, g, b);
    const rgb = hsvToRgb(hsv);
    expect(rgb.r).toBeCloseTo(r, 0);
    expect(rgb.g).toBeCloseTo(g, 0);
    expect(rgb.b).toBeCloseTo(b, 0);
  });
});

describe("hexToRgb", () => {
  it("parses 6-digit hex with #", () => {
    expect(hexToRgb("#FF5500")).toEqual({ r: 255, g: 85, b: 0 });
  });

  it("parses 6-digit hex without #", () => {
    expect(hexToRgb("FF5500")).toEqual({ r: 255, g: 85, b: 0 });
  });

  it("parses 3-digit hex with #", () => {
    expect(hexToRgb("#ABC")).toEqual({ r: 170, g: 187, b: 204 });
  });

  it("parses 3-digit hex without #", () => {
    expect(hexToRgb("ABC")).toEqual({ r: 170, g: 187, b: 204 });
  });

  it("parses 3-digit lowercase hex", () => {
    expect(hexToRgb("#abc")).toEqual({ r: 170, g: 187, b: 204 });
  });

  it("is case-insensitive", () => {
    expect(hexToRgb("#aabbcc")).toEqual({ r: 170, g: 187, b: 204 });
  });

  it("returns null for invalid hex", () => {
    expect(hexToRgb("XYZ")).toBeNull();
    expect(hexToRgb("!!!")).toBeNull();
    expect(hexToRgb("#GG0000")).toBeNull();
    expect(hexToRgb("")).toBeNull();
    expect(hexToRgb("#")).toBeNull();
    expect(hexToRgb("#12")).toBeNull();
    expect(hexToRgb("#1234")).toBeNull();
  });
});

describe("rgbToHex", () => {
  it("formats as uppercase #RRGGBB", () => {
    expect(rgbToHex(255, 85, 0)).toBe("#FF5500");
  });

  it("pads single-digit values", () => {
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
  });

  it("formats white", () => {
    expect(rgbToHex(255, 255, 255)).toBe("#FFFFFF");
  });
});

describe("colorToGradientPos", () => {
  it("maps pure red to left edge, top", () => {
    const pos = colorToGradientPos({ r: 255, g: 0, b: 0 }, 248, 90);
    expect(pos.x).toBeCloseTo(0);
    expect(pos.y).toBeCloseTo(0);
  });

  it("maps pure green to x = 1/3 of width", () => {
    const pos = colorToGradientPos({ r: 0, g: 255, b: 0 }, 248, 90);
    expect(pos.x).toBeCloseTo((120 / 360) * 248);
    expect(pos.y).toBeCloseTo(0);
  });

  it("maps pure blue to x = 2/3 of width", () => {
    const pos = colorToGradientPos({ r: 0, g: 0, b: 255 }, 248, 90);
    expect(pos.x).toBeCloseTo((240 / 360) * 248);
    expect(pos.y).toBeCloseTo(0);
  });

  it("maps pure black to bottom", () => {
    const pos = colorToGradientPos({ r: 0, g: 0, b: 0 }, 248, 90);
    expect(pos.y).toBeCloseTo(90);
  });

  it("maps white to top-left (h=0, v=1)", () => {
    const pos = colorToGradientPos({ r: 255, g: 255, b: 255 }, 248, 90);
    expect(pos.x).toBeCloseTo(0);
    expect(pos.y).toBeCloseTo(0);
  });
});
