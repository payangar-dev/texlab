import { FIT_PADDING, GRID_MAX_OPACITY, GRID_THRESHOLD, ZOOM_LEVELS } from "./constants";

/** Convert screen coordinates to texture-space coordinates. */
export function screenToTexture(
  screenX: number,
  screenY: number,
  panX: number,
  panY: number,
  zoom: number,
): { x: number; y: number } {
  return {
    x: (screenX - panX) / zoom,
    y: (screenY - panY) / zoom,
  };
}

/** Convert texture-space coordinates to screen coordinates. */
export function textureToScreen(
  textureX: number,
  textureY: number,
  panX: number,
  panY: number,
  zoom: number,
): { x: number; y: number } {
  return {
    x: textureX * zoom + panX,
    y: textureY * zoom + panY,
  };
}

/** Get the discrete pixel coordinate at a screen position. */
export function pixelAtScreen(
  screenX: number,
  screenY: number,
  panX: number,
  panY: number,
  zoom: number,
): { x: number; y: number } {
  const tex = screenToTexture(screenX, screenY, panX, panY, zoom);
  return { x: Math.floor(tex.x), y: Math.floor(tex.y) };
}

/** Check if discrete pixel coords are within texture bounds. */
export function isInBounds(
  pixelX: number,
  pixelY: number,
  width: number,
  height: number,
): boolean {
  return pixelX >= 0 && pixelY >= 0 && pixelX < width && pixelY < height;
}

/**
 * Compute new pan offset after zoom so the texture point under the cursor
 * stays fixed on screen.
 */
export function zoomToCursorPan(
  cursorScreenX: number,
  cursorScreenY: number,
  oldPanX: number,
  oldPanY: number,
  oldZoom: number,
  newZoom: number,
): { panX: number; panY: number } {
  const ratio = newZoom / oldZoom;
  return {
    panX: cursorScreenX - (cursorScreenX - oldPanX) * ratio,
    panY: cursorScreenY - (cursorScreenY - oldPanY) * ratio,
  };
}

/**
 * Find the best zoom level from the table that fits the texture
 * within the viewport with padding. Snaps down to the nearest entry.
 */
export function fitToViewportZoom(
  textureW: number,
  textureH: number,
  containerW: number,
  containerH: number,
): number {
  const availW = containerW - 2 * FIT_PADDING;
  const availH = containerH - 2 * FIT_PADDING;
  if (availW <= 0 || availH <= 0) return ZOOM_LEVELS[0];

  const fitZoom = Math.min(availW / textureW, availH / textureH);

  // Snap down to the nearest zoom level in the table
  let best = ZOOM_LEVELS[0];
  for (const level of ZOOM_LEVELS) {
    if (level <= fitZoom) {
      best = level;
    } else {
      break;
    }
  }
  return best;
}

/**
 * Clamp pan so the texture doesn't get lost off-screen.
 * When the texture fits entirely in the viewport, center it.
 */
export function clampPan(
  panX: number,
  panY: number,
  zoom: number,
  textureW: number,
  textureH: number,
  containerW: number,
  containerH: number,
): { panX: number; panY: number } {
  const scaledW = textureW * zoom;
  const scaledH = textureH * zoom;

  const clampAxis = (pan: number, scaled: number, container: number): number => {
    if (scaled <= container) {
      return (container - scaled) / 2;
    }
    const minPan = container - scaled;
    const maxPan = 0;
    return Math.max(minPan, Math.min(maxPan, pan));
  };

  return {
    panX: clampAxis(panX, scaledW, containerW),
    panY: clampAxis(panY, scaledH, containerH),
  };
}

/**
 * Pixel grid opacity. Returns 0 below threshold, linearly interpolates
 * from 0.2 at threshold to GRID_MAX_OPACITY at 16+.
 */
export function gridOpacity(zoom: number): number {
  if (zoom < GRID_THRESHOLD) return 0;
  if (zoom >= 16) return GRID_MAX_OPACITY;
  // Linear interpolation from 0.2 at 4 to 0.5 at 16
  const t = (zoom - GRID_THRESHOLD) / (16 - GRID_THRESHOLD);
  return 0.2 + t * (GRID_MAX_OPACITY - 0.2);
}
