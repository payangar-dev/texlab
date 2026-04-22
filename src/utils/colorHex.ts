import type { ColorDto } from "../api/commands";

const HEX_RGB_RE = /^#([0-9a-fA-F]{6})$/;

/**
 * Parses an opaque `#RRGGBB` hex string into a `ColorDto` with `a = 255`.
 * Throws if the input is not exactly 7 chars or contains non-hex digits.
 * Keep in sync with `Color::from_hex_rgb` on the Rust side.
 */
export function hexToColorDto(hex: string): ColorDto {
  const match = HEX_RGB_RE.exec(hex);
  if (!match) {
    throw new Error(`invalid-color-hex:${hex}`);
  }
  const body = match[1];
  return {
    r: Number.parseInt(body.slice(0, 2), 16),
    g: Number.parseInt(body.slice(2, 4), 16),
    b: Number.parseInt(body.slice(4, 6), 16),
    a: 255,
  };
}

/**
 * Formats a `ColorDto` as an uppercase `#RRGGBB` string. Alpha is dropped
 * because palettes are opaque-only (v1).
 */
export function colorDtoToHex(color: ColorDto): string {
  const h = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return `#${h(color.r)}${h(color.g)}${h(color.b)}`;
}
