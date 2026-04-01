# Research: Color Panel (HSV Picker + Hex Input)

**Feature Branch**: `009-color-panel`
**Date**: 2026-03-31

## Decision 1: Color State Architecture — Frontend-Only (Zustand)

**Decision**: Keep color state (`activeColor`, `secondaryColor`, `activeSlot`) in the Zustand `toolStore`. No new Rust backend commands.

**Rationale**:
- The existing architecture already stores colors in Zustand and passes them as parameters to tool commands (`tool_press`, `tool_drag`, `tool_release`). Colors are not stored in `AppState`.
- Adding Rust-side color state would require IPC roundtrips for every gradient drag event (dozens per second), harming responsiveness for zero functional benefit.
- The Simplicity principle (VI) mandates minimum complexity for the current requirement.
- The Dual-Access State principle (III) is technically violated, but the spec has no MCP requirement for active color access. This can be added later if MCP agents need color control.

**Alternatives considered**:
- **Rust `AppState` + IPC commands**: Rejected. Would add `set_active_color`, `get_active_color`, `swap_colors` commands plus event emissions. Over-engineering for a UI interaction that needs sub-frame latency.
- **Hybrid (Zustand primary, Rust sync on tool_press)**: Rejected. The current tool commands already accept color as a parameter — this is equivalent and simpler.

## Decision 2: Gradient Rendering — HTML5 Canvas 2D with Layered Gradients

**Decision**: Render the 2D HSV gradient using an HTML5 `<canvas>` element with three composited layers, matching the UI design.

**Rationale**:
- The UI design (`component/Panel-Color`) uses three overlaid rectangles:
  1. **Hue layer**: Horizontal linear gradient cycling through the hue spectrum (red → yellow → green → cyan → blue → magenta → red)
  2. **White overlay**: Horizontal gradient from opaque white (left) to transparent (right), reducing saturation on the left side
  3. **Black overlay**: Vertical gradient from transparent (top) to opaque black (bottom), reducing brightness at the bottom
- Canvas 2D can reproduce this exactly using `createLinearGradient` with appropriate color stops and compositing.
- The constitution's Simplicity principle (VI) explicitly states "Canvas rendering uses HTML5 Canvas 2D" for pixel art — the same reasoning applies here.

**Alternatives considered**:
- **CSS layered gradients**: Rejected. Cannot use `getImageData()` for pixel sampling, so picking a color from the gradient would require manual color math.
- **WebGL shader**: Rejected. Over-engineering for a 248×90 gradient. The constitution explicitly rejects WebGL for this scale.
- **Pre-computed image**: Rejected. Less flexible and adds a static asset dependency.

## Decision 3: Color Picking — Direct Canvas Pixel Sampling

**Decision**: When the user clicks/drags on the gradient, sample the pixel color directly from the canvas using `getImageData(x, y, 1, 1)`.

**Rationale**:
- This is the simplest and most accurate approach — the color the user sees is exactly the color they get.
- No mathematical approximation of the 3-layer gradient compositing is needed.
- Performance is excellent: `getImageData` for a single pixel is a constant-time operation.

**Alternatives considered**:
- **Mathematical HSV calculation**: Rejected as primary approach. The 3-layer gradient doesn't map cleanly to independent HSV axes (H and S are coupled on the X axis via the hue + white overlay). Math would produce colors that don't match what the user sees on screen.

## Decision 4: Reverse Mapping — HSV-Based Approximation for Cursor Positioning

**Decision**: When a color is set externally (hex input, eyedropper, swap), position the gradient cursor using an HSV-based approximation: `x = H / 360 * width`, `y = (1 - V) * height`.

**Rationale**:
- The 2D gradient combines all three HSV dimensions into two spatial axes, making a perfect inverse mapping impossible. The spec acknowledges this tradeoff: "This trades independent axis precision for simplicity and visual immediacy."
- The H→x mapping is exact (horizontal hue spectrum).
- The V→y mapping is a good approximation (vertical brightness ramp).
- Saturation is partially encoded in x (via the white overlay) but is not independently controllable — this is by design.
- The cursor position may not perfectly match the exact pixel color for desaturated mid-tones, but will always be in the visually correct region.

**Alternatives considered**:
- **Canvas pixel search**: Rejected. Scanning all pixels to find the closest match is O(width × height) and may have multiple close matches. Not worth the complexity.
- **Separate hue slider + SV area**: Rejected by the spec/design. The 2D combined gradient is an explicit design decision.

## Decision 5: Keyboard Shortcut (X to Swap) — Already Implemented

**Decision**: No changes needed to `useKeyboardShortcuts.ts`.

**Rationale**:
- The X keyboard shortcut for `swapColors()` is already implemented in `src/hooks/useKeyboardShortcuts.ts` (line 120-124).
- The `shouldSuppressShortcut()` function already checks for `INPUT`, `TEXTAREA`, and `contentEditable` elements, satisfying FR-016 (X must not trigger while hex input has focus).
- No new keyboard handling code is required.

## Decision 6: Color Conversion — Pure TypeScript Utility Module

**Decision**: Implement HSV↔RGB↔Hex conversion functions in `src/utils/color.ts` as pure functions.

**Rationale**:
- Color conversion is a frontend concern for this feature — it maps UI state (gradient position, hex text) to the `ColorDto` format used by the store and Rust commands.
- These are well-defined mathematical transformations with no external dependencies.
- Placing them in `src/utils/` makes them reusable for the future Palette panel.
- The domain `Color` type (Rust) is RGBA only — HSV is a UI presentation concern.

**Implementation notes**:
- HSV→RGB: Standard algorithm with 6 hue sectors
- RGB→HSV: Standard max/min channel algorithm
- Hex parsing: Accept `#AABBCC`, `AABBCC`, `#ABC`, `ABC` formats
- Hex formatting: Always output 6-digit uppercase with `#` prefix
- All functions are pure (no side effects, no state)

## Decision 7: Active Slot State — Extend Existing ToolStore

**Decision**: Add `activeSlot: 'primary' | 'secondary'` and `setActiveSlot` to the existing `toolStore`.

**Rationale**:
- The store already manages `activeColor`, `secondaryColor`, and `swapColors()`.
- Adding `activeSlot` is the minimal change to support the "click to select which slot to edit" interaction (FR-015).
- The `setActiveColor` action must be updated to write to whichever slot is active (primary or secondary).
- Default: `'primary'` (matches existing behavior where changes always affect `activeColor`).
