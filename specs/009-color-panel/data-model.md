# Data Model: Color Panel (HSV Picker + Hex Input)

**Feature Branch**: `009-color-panel`
**Date**: 2026-03-31

## Entities

### ColorSlot (new type)

Discriminates which color slot is the active editing target.

```typescript
type ColorSlot = "primary" | "secondary";
```

- **Values**: `"primary"` (foreground) | `"secondary"` (background)
- **Default**: `"primary"`
- **Invariant**: Exactly one slot is active at any time.

### HsvColor (new type)

Internal representation for the HSV gradient interactions. Not stored persistently — used as an intermediate during conversions.

```typescript
interface HsvColor {
  h: number; // 0–360 (degrees)
  s: number; // 0–1
  v: number; // 0–1
}
```

- **h**: Hue in degrees. Wraps at 360 (360 ≡ 0).
- **s**: Saturation. 0 = fully desaturated (gray), 1 = fully saturated.
- **v**: Value (brightness). 0 = black, 1 = maximum brightness.
- **Validation**: `h` clamped to [0, 360), `s` and `v` clamped to [0, 1].

### ColorDto (existing — unchanged)

The existing RGBA color transfer object used by the store and Rust commands.

```typescript
interface ColorDto {
  r: number; // 0–255
  g: number; // 0–255
  b: number; // 0–255
  a: number; // 0–255
}
```

- **No changes**: The Color panel always sets `a: 255` (alpha is out of scope per spec assumptions).

## State Changes

### ToolStore (modified)

The existing `toolStore` is extended with:

```typescript
// New state field
activeSlot: ColorSlot;           // Default: "primary"

// New action
setActiveSlot: (slot: ColorSlot) => void;

// Modified action
setActiveColor: (color: ColorDto) => void;
// Before: always sets state.activeColor
// After:  sets state.activeColor if activeSlot === "primary"
//         sets state.secondaryColor if activeSlot === "secondary"
```

**State transitions for `activeSlot`**:

| Action | Before | After |
|--------|--------|-------|
| `setActiveSlot("primary")` | any | `"primary"` |
| `setActiveSlot("secondary")` | any | `"secondary"` |
| `swapColors()` | any | unchanged (slot identity stays, colors swap) |

**State transitions for colors**:

| Action | `activeSlot` | Effect |
|--------|-------------|--------|
| `setActiveColor(c)` | `"primary"` | `activeColor = c` |
| `setActiveColor(c)` | `"secondary"` | `secondaryColor = c` |
| `swapColors()` | any | `activeColor ↔ secondaryColor` |

### Computed Values (derived, not stored)

The Color panel computes these from the store state:

| Value | Source | Purpose |
|-------|--------|---------|
| `editingColor` | `activeSlot === "primary" ? activeColor : secondaryColor` | The color currently being edited (shown in gradient + hex) |
| `hexString` | `rgbToHex(editingColor)` | Displayed in the hex input field |
| `cursorPosition` | `colorToGradientPos(editingColor, width, height)` | Gradient cursor (x, y) |

Note: The active color indicator (fg/bg square in ColorSlots) serves as live preview — no separate preview swatch needed.

## Conversion Functions (`src/utils/color.ts`)

### `hsvToRgb(hsv: HsvColor): { r: number; g: number; b: number }`

Standard HSV→RGB conversion using the 6-sector hue algorithm.

### `rgbToHsv(r: number, g: number, b: number): HsvColor`

Standard RGB→HSV conversion using max/min channel decomposition.

### `hexToRgb(hex: string): { r: number; g: number; b: number } | null`

Parses hex strings. Returns `null` for invalid input.

- Strips leading `#` if present
- Expands 3-digit shorthand (`ABC` → `AABBCC`)
- Validates characters `[0-9a-fA-F]`
- Returns `null` for any other format

### `rgbToHex(r: number, g: number, b: number): string`

Formats as `#RRGGBB` (uppercase, 6-digit, with `#` prefix).

### `colorToGradientPos(color: ColorDto, width: number, height: number): { x: number; y: number }`

Maps a color to an approximate gradient cursor position using HSV decomposition:
- `x = (hsv.h / 360) * width`
- `y = (1 - hsv.v) * height`

## Component Tree

```
ColorPanel (IDockviewPanelProps)
├── HsvGradient
│   ├── <canvas> — renders 3-layer gradient (hue + white + black)
│   └── cursor indicator (absolute-positioned div/svg circle)
└── ColorInputRow (horizontal flex, gap 5, align-items center)
    ├── ColorSlots
    │   ├── primary square (20×20, active: accent border #4A9FD8)
    │   ├── swap icon (ArrowLeftRight 10×10, #666666)
    │   └── secondary square (20×20, inactive: border #444444)
    ├── "HEX" label (Geist Mono 8px, #888888)
    └── <input> — hex code field (Geist Mono 9px, #CCCCCC on #333333)
```

## Relationships

```
ToolStore (Zustand)
  ├── activeColor: ColorDto ──────── used by tools (brush, fill, etc.)
  ├── secondaryColor: ColorDto ──── alternate color
  ├── activeSlot: ColorSlot ──────── determines which slot is edited
  └── swapColors() ──────────────── exchanges activeColor ↔ secondaryColor

ColorPanel reads:
  └── editingColor = store[activeSlot]

ColorPanel writes:
  ├── setActiveColor(color) ──────── from gradient pick or hex input
  ├── setActiveSlot(slot) ─────────── from clicking primary/secondary indicator
  └── swapColors() ────────────────── from swap control or X key
```
