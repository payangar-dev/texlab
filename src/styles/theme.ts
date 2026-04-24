/**
 * Named colour tokens. Describe intent (surface, text role, state) rather
 * than raw colour. Reach for this scale whenever a component needs a colour,
 * background, border, icon colour, shadow colour, or any CSS colour value
 * that is a design choice (not user data).
 *
 * User-generated colours (picked pixels, saved swatches, imported palette
 * entries) do NOT live here — they travel through `src/utils/color.ts` /
 * `src/utils/colorHex.ts` as runtime data.
 */
export const colors = {
  shellBackground: "#1E1E1E",
  panelBody: "#252525",
  panelHeader: "#2A2A2A",
  canvasBackground: "#2D2D2D",
  titleBar: "#161616",
  statusBar: "#161616",
  separator: "#3A3A3A",
  inputField: "#333333",
  selectedItem: "#3A3A3A",
  accent: "#4A9FD8",
  textPrimary: "#E0E0E0",
  textTitle: "#CCCCCC",
  textSecondary: "#888888",
  textMuted: "#666666",
  textDim: "#555555",
  iconDefault: "#555555",
  closeHover: "#E81123",
  white: "#FFFFFF",
  transparent: "transparent",
  canvasCheckerA: "#333333",
  canvasCheckerB: "#444444",
  backdropScrim: "rgba(0, 0, 0, 0.5)",
  errorText: "#E06C6C",
  overlayHoverSubtle: "rgba(255, 255, 255, 0.08)",
  overlayHover: "rgba(255, 255, 255, 0.1)",
  overlayHoverStrong: "rgba(255, 255, 255, 0.12)",
  accentTranslucent15: "rgba(74, 159, 216, 0.15)",
  swatchOutlineInset: "rgba(0, 0, 0, 0.35)",
  /**
   * Canvas-overlay colours — drawn into the viewport's 2D context, not into
   * CSS. Not surveilled by the `no-style-literals` Biome plugin (which scans
   * `$prop: $value` pairs); listed here so the literal stays in one place.
   * `canvasGridLineBase` is the RGB triplet only; the caller composes the
   * final `rgba(...)` with a zoom-dependent alpha.
   */
  canvasGridLineBase: "128, 128, 128",
  brushPreviewFill: "rgba(255, 255, 255, 0.2)",
  brushPreviewStroke: "rgba(255, 255, 255, 0.6)",
  linePreviewFill: "rgba(255, 255, 255, 0.3)",
} as const;

/**
 * Font-family stacks. Reach for this scale whenever a component sets
 * `fontFamily` on an inline style or CSS custom property.
 */
export const fonts = {
  ui: "Inter, system-ui, -apple-system, sans-serif",
  mono: "'Geist Mono', monospace",
} as const;

/**
 * Text sizes in px (unitless numbers). Reach for this scale for any
 * `fontSize` value. The smallest entry (`xs`) is the shipped legibility
 * floor — no text in the app ships below it.
 */
export const fontSizes = {
  xs: 12,
  sm: 13,
  md: 14,
  lg: 15,
} as const;

/**
 * Named CSS font-weight values. Reach for this scale for any `fontWeight`
 * value in an inline style or CSS custom property.
 */
export const fontWeights = {
  semibold: 600,
} as const;

/**
 * Gap / padding / margin steps in px. Reach for this scale for any
 * layout breathing space — `padding`, `margin`, `gap`, `rowGap`,
 * `columnGap`, inter-element offsets.
 */
export const spacing = {
  xs: 2,
  grid: 3,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
  "3xl": 24,
  "4xl": 32,
} as const;

/**
 * Discrete component sizes in px. Reach for this scale for fixed-chrome
 * sizes — tab bar height, tool sidebar width, row height, button
 * heights/widths, input heights. Grouped nested objects (`button`,
 * `input`, `dialog`) keep the top level small; new variants extend the
 * nested group rather than introducing top-level keys.
 */
export const sizing = {
  tabBarHeight: 32,
  titleBarHeight: 36,
  toolSidebarWidth: 48,
  toolSeparatorWidth: 28,
  layerRowHeight: 34,
  thumbnailSize: 18,
  hairline: 1,
  /** Square size used by the shared `IconButton` primitive — the single
   * source of truth for small, icon-only action buttons in panel chrome
   * (Layers action bar, Palette action bar, etc.). Raising this one value
   * resizes every affordance that uses `IconButton`. */
  iconButton: 26,
  windowButton: { width: 46, height: 36 },
  button: { xs: 20, xl: 36 },
  input: { sm: 22 },
  valueBoxMinWidth: 44,
  dropdownMaxHeight: 320,
  swatchMinCell: 22,
  separatorShortHeight: 14,
  /** Width of the outer selection ring drawn via `box-shadow` on swatches
   * and colour slots. Consumed at call sites that build structural ring
   * strings from `colors.accent`/`colors.white`. */
  selectionRing: 2,
  /** Side of the square HSV-gradient cursor handle. */
  hsvCursor: 10,
  /** Padding around the texture when fitting the canvas into its viewport. */
  canvasFitPadding: 32,
  dialog: {
    padding: 20,
    cardGap: 10,
    fieldsetGap: 14,
    actionPadX: 14,
    minWidth: 320,
    minWidthLg: 360,
    minWidthSm: 300,
  },
} as const;

/**
 * Icon sizes in px. Reach for this scale for any lucide `size={...}` prop
 * or icon width/height. The smallest entry (`sm`) is the shipped floor for
 * any clickable icon — no interactive icon ships below it.
 */
export const iconSizes = {
  sm: 14,
  md: 16,
  lg: 20,
  xl: 26,
} as const;

/**
 * Corner radii in px. Reach for this scale for any `borderRadius` value.
 * `none` is exposed as a named token (not the literal `0`) so dockview's
 * `--dv-border-radius` can source the value symbolically.
 */
export const radii = {
  none: 0,
  xs: 3,
  sm: 2,
  md: 4,
  lg: 6,
} as const;

/**
 * Composed CSS `box-shadow` strings. Reach for this scale for any
 * `boxShadow` value that represents a named surface treatment
 * (elevation, inset outline). Structural selection rings built at the
 * call site from `colors.accent` + a `sizing.selectionRing` offset
 * remain at the call site (too few usages to warrant a named shadow).
 */
export const shadows = {
  swatchInsetBorder: "inset 0 0 0 1px rgba(0, 0, 0, 0.35)",
  dragElevation: "0 2px 8px rgba(0, 0, 0, 0.3)",
  dropdownElevation: "0 4px 12px rgba(0, 0, 0, 0.35)",
  toastElevation: "0 2px 8px rgba(0, 0, 0, 0.4)",
} as const;

/**
 * Opacity values. Reach for this scale for any `opacity` style property
 * so that "dimmed" and "muted" states share a single source of truth.
 */
export const opacities = {
  full: 1,
  /** Disabled-affordance dim level, also used for drag-ghost and hidden-layer rows. */
  dimmed: 0.4,
  /** Soft-disable used when an option is conditionally available. */
  halfDimmed: 0.5,
  /** Subtle separator fade. */
  subtle: 0.6,
} as const;

/**
 * Stacking order for floating surfaces. Raising or re-ordering any value
 * here must preserve the ladder: dropdown < dialog < toast.
 */
export const zIndices = {
  dropdown: 10,
  dialog: 1000,
  toast: 2000,
} as const;

/**
 * Key-type aliases for scales commonly used as component-prop constraints.
 * Enable token-key props on primitives (e.g. `gap?: SpacingToken`) without
 * each consumer re-deriving `keyof typeof …` locally.
 */
export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type IconSizeToken = keyof typeof iconSizes;
export type RadiusToken = keyof typeof radii;
