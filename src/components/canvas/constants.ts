import { sizing } from "../../styles/theme";

/** Discrete zoom levels (multipliers). Sub-1x are fractional; >=1x are integers. */
export const ZOOM_LEVELS: readonly number[] = [
  0.25, 0.33, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 48, 64, 96, 128,
];

/** Minimum zoom at which the pixel grid becomes visible. */
export const GRID_THRESHOLD = 16;

/** Maximum opacity for the pixel grid at high zoom. */
export const GRID_MAX_OPACITY = 0.5;

/** Padding (px) around the texture when using fit-to-viewport. */
export const FIT_PADDING = sizing.canvasFitPadding;
