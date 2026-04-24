export interface HsvColor {
  h: number; // 0–360
  s: number; // 0–1
  v: number; // 0–1
}

/**
 * Pure-hue stops for the HSV picker's horizontal hue gradient. These are
 * mathematical reference values (the six primary/secondary hue corners
 * plus the wrap-around red), not design tokens — they define what the
 * picker renders, not any design choice.
 */
export const HSV_HUE_STOPS: readonly { offset: number; color: string }[] = [
  { offset: 0, color: "#FF0000" },
  { offset: 1 / 6, color: "#FFFF00" },
  { offset: 2 / 6, color: "#00FF00" },
  { offset: 3 / 6, color: "#00FFFF" },
  { offset: 4 / 6, color: "#0000FF" },
  { offset: 5 / 6, color: "#FF00FF" },
  { offset: 1, color: "#FF0000" },
];

export function hsvToRgb(hsv: HsvColor): { r: number; g: number; b: number } {
  const { h, s, v } = hsv;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r1: number;
  let g1: number;
  let b1: number;

  if (h < 60) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (h < 180) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else {
    r1 = c;
    g1 = 0;
    b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

export function rgbToHsv(r: number, g: number, b: number): HsvColor {
  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;

  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  const d = max - min;

  let h: number;
  if (d === 0) {
    h = 0;
  } else if (max === r1) {
    h = 60 * (((g1 - b1) / d) % 6);
  } else if (max === g1) {
    h = 60 * ((b1 - r1) / d + 2);
  } else {
    h = 60 * ((r1 - g1) / d + 4);
  }

  if (h < 0) h += 360;

  const s = max === 0 ? 0 : d / max;
  const v = max;

  return { h, s, v };
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let cleaned = hex.startsWith("#") ? hex.slice(1) : hex;

  if (cleaned.length === 3) {
    cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2];
  }

  if (cleaned.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return null;
  }

  return {
    r: Number.parseInt(cleaned.slice(0, 2), 16),
    g: Number.parseInt(cleaned.slice(2, 4), 16),
    b: Number.parseInt(cleaned.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function colorToGradientPos(
  color: { r: number; g: number; b: number },
  width: number,
  height: number,
): { x: number; y: number } {
  const hsv = rgbToHsv(color.r, color.g, color.b);
  return {
    x: (hsv.h / 360) * width,
    y: (1 - hsv.v) * height,
  };
}
