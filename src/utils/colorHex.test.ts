import { describe, expect, it } from "vitest";
import { colorDtoToHex, hexToColorDto } from "./colorHex";

describe("hexToColorDto", () => {
  it("parses uppercase #RRGGBB", () => {
    expect(hexToColorDto("#1A2B3C")).toEqual({ r: 0x1a, g: 0x2b, b: 0x3c, a: 255 });
  });

  it("accepts lowercase", () => {
    expect(hexToColorDto("#abcdef")).toEqual({ r: 0xab, g: 0xcd, b: 0xef, a: 255 });
  });

  it("forces alpha to 255", () => {
    expect(hexToColorDto("#000000").a).toBe(255);
  });

  it("rejects 3-digit form", () => {
    expect(() => hexToColorDto("#FFF")).toThrow();
  });

  it("rejects #RRGGBBAA", () => {
    expect(() => hexToColorDto("#FFFFFFFF")).toThrow();
  });

  it("rejects missing #", () => {
    expect(() => hexToColorDto("112233")).toThrow();
  });

  it("rejects non-hex", () => {
    expect(() => hexToColorDto("#zzzzzz")).toThrow();
  });
});

describe("colorDtoToHex", () => {
  it("emits uppercase zero-padded hex", () => {
    expect(colorDtoToHex({ r: 1, g: 2, b: 3, a: 255 })).toBe("#010203");
  });

  it("drops alpha", () => {
    expect(colorDtoToHex({ r: 0x10, g: 0x20, b: 0x30, a: 0x40 })).toBe("#102030");
  });

  it("round-trips with hexToColorDto", () => {
    const hex = "#ABCDEF";
    expect(colorDtoToHex(hexToColorDto(hex))).toBe(hex);
  });
});
