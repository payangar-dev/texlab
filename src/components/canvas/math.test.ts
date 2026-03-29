import { describe, it, expect } from "vitest";
import {
  screenToTexture,
  textureToScreen,
  pixelAtScreen,
  isInBounds,
  zoomToCursorPan,
  fitToViewportZoom,
  gridOpacity,
  clampPan,
} from "./math";

describe("screenToTexture / textureToScreen round-trip", () => {
  it("round-trips at zoom=1, no pan", () => {
    const tex = screenToTexture(10, 20, 0, 0, 1);
    const scr = textureToScreen(tex.x, tex.y, 0, 0, 1);
    expect(scr.x).toBeCloseTo(10);
    expect(scr.y).toBeCloseTo(20);
  });

  it("round-trips at zoom=4, pan=(50,100)", () => {
    const panX = 50,
      panY = 100,
      zoom = 4;
    const tex = screenToTexture(250, 500, panX, panY, zoom);
    const scr = textureToScreen(tex.x, tex.y, panX, panY, zoom);
    expect(scr.x).toBeCloseTo(250);
    expect(scr.y).toBeCloseTo(500);
  });

  it("round-trips at fractional zoom=0.5", () => {
    const tex = screenToTexture(8, 4, 0, 0, 0.5);
    expect(tex.x).toBeCloseTo(16);
    expect(tex.y).toBeCloseTo(8);
    const scr = textureToScreen(tex.x, tex.y, 0, 0, 0.5);
    expect(scr.x).toBeCloseTo(8);
    expect(scr.y).toBeCloseTo(4);
  });
});

describe("pixelAtScreen", () => {
  it("returns correct discrete coords", () => {
    // At zoom=4, pan=(10,10), screen=(14,14) → texture=(1,1) → pixel=(1,1)
    const p = pixelAtScreen(14, 14, 10, 10, 4);
    expect(p.x).toBe(1);
    expect(p.y).toBe(1);
  });

  it("floors fractional texture coords", () => {
    // screen=(11,11), pan=(10,10), zoom=4 → tex=(0.25,0.25) → pixel=(0,0)
    const p = pixelAtScreen(11, 11, 10, 10, 4);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it("returns negative for coords before pan origin", () => {
    const p = pixelAtScreen(5, 5, 10, 10, 4);
    expect(p.x).toBe(-2); // (5-10)/4 = -1.25 → floor = -2
    expect(p.y).toBe(-2);
  });
});

describe("isInBounds", () => {
  it("(0,0) is in bounds for 16x16", () => {
    expect(isInBounds(0, 0, 16, 16)).toBe(true);
  });

  it("(15,15) is in bounds for 16x16", () => {
    expect(isInBounds(15, 15, 16, 16)).toBe(true);
  });

  it("(16,16) is out of bounds for 16x16", () => {
    expect(isInBounds(16, 16, 16, 16)).toBe(false);
  });

  it("(-1,0) is out of bounds", () => {
    expect(isInBounds(-1, 0, 16, 16)).toBe(false);
  });

  it("(0,-1) is out of bounds", () => {
    expect(isInBounds(0, -1, 16, 16)).toBe(false);
  });
});

describe("zoomToCursorPan", () => {
  it("keeps cursor point fixed after zoom", () => {
    const cursorX = 200,
      cursorY = 150;
    const oldPan = { x: 50, y: 30 };
    const result = zoomToCursorPan(cursorX, cursorY, oldPan.x, oldPan.y, 2, 4);

    // The texture point under cursor before and after should match
    // Before: (200-50)/2 = 75, (150-30)/2 = 60
    // After: (200-result.panX)/4 should equal 75
    const texBefore = (cursorX - oldPan.x) / 2;
    const texAfter = (cursorX - result.panX) / 4;
    expect(texAfter).toBeCloseTo(texBefore);

    const texYBefore = (cursorY - oldPan.y) / 2;
    const texYAfter = (cursorY - result.panY) / 4;
    expect(texYAfter).toBeCloseTo(texYBefore);
  });
});

describe("fitToViewportZoom", () => {
  it("picks correct level from table for 16x16 in 800x600", () => {
    // Available: 736x536, fit = min(46, 33.5) = 33.5 → snap to 32
    expect(fitToViewportZoom(16, 16, 800, 600)).toBe(32);
  });

  it("picks 1 for large texture in small viewport", () => {
    // 512x512 in 600x600, available 536x536, fit = 1.046 → snap to 1
    expect(fitToViewportZoom(512, 512, 600, 600)).toBe(1);
  });

  it("returns minimum zoom for tiny viewport", () => {
    expect(fitToViewportZoom(16, 16, 50, 50)).toBe(0.25);
  });

  it("handles non-square texture", () => {
    // 32x16 in 800x600, available 736x536, fit = min(23, 33.5) = 23 → snap to 20
    expect(fitToViewportZoom(32, 16, 800, 600)).toBe(20);
  });
});

describe("gridOpacity", () => {
  it("returns 0 below threshold", () => {
    expect(gridOpacity(1)).toBe(0);
    expect(gridOpacity(3)).toBe(0);
    expect(gridOpacity(3.99)).toBe(0);
  });

  it("returns 0.2 at threshold (zoom=4)", () => {
    expect(gridOpacity(4)).toBeCloseTo(0.2);
  });

  it("returns GRID_MAX_OPACITY at zoom>=16", () => {
    expect(gridOpacity(16)).toBeCloseTo(0.5);
    expect(gridOpacity(32)).toBeCloseTo(0.5);
    expect(gridOpacity(128)).toBeCloseTo(0.5);
  });

  it("interpolates between 4 and 16", () => {
    // At zoom=10: t = (10-4)/(16-4) = 0.5, opacity = 0.2 + 0.5*0.3 = 0.35
    expect(gridOpacity(10)).toBeCloseTo(0.35);
  });
});

describe("clampPan", () => {
  it("centers when texture fits viewport", () => {
    // 16x16 at zoom=1 in 800x600 → fits
    const result = clampPan(999, 999, 1, 16, 16, 800, 600);
    expect(result.panX).toBe((800 - 16) / 2);
    expect(result.panY).toBe((600 - 16) / 2);
  });

  it("clamps when zoomed in", () => {
    // 16x16 at zoom=64 = 1024x1024 in 800x600 → doesn't fit
    const result = clampPan(100, 100, 64, 16, 16, 800, 600);
    // maxPan = 0, so clamped to 0
    expect(result.panX).toBe(0);
    expect(result.panY).toBe(0);
  });

  it("allows negative pan up to limit", () => {
    // 16x16 at zoom=64 = 1024x1024 in 800x600
    // minPan.x = 800 - 1024 = -224
    const result = clampPan(-500, -500, 64, 16, 16, 800, 600);
    expect(result.panX).toBe(-224);
    expect(result.panY).toBe(-424);
  });

  it("handles mixed-axis: one fits, one overflows", () => {
    // 64x16 at zoom=16 in 800x600
    // X: 64*16=1024 > 800 → clamp. minPan = 800-1024 = -224, maxPan = 0
    // Y: 16*16=256 < 600 → center. panY = (600-256)/2 = 172
    const result = clampPan(-100, 999, 16, 64, 16, 800, 600);
    expect(result.panX).toBe(-100); // within [-224, 0]
    expect(result.panY).toBe(172); // centered
  });
});
