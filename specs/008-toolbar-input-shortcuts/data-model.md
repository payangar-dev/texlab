# Data Model: Tool Bar + Tool Input Handling + Keyboard Shortcuts

**Feature Branch**: `008-toolbar-input-shortcuts`
**Date**: 2026-03-30

## Modified Entities

### ToolContext (Rust domain — modified)

**Location**: `src-tauri/src/domain/tools/mod.rs`

Current:
```rust
pub struct ToolContext<'a> {
    pub buffer: &'a mut PixelBuffer,
    pub color: Color,
    pub brush_size: BrushSize,
}
```

Modified:
```rust
pub struct ToolContext<'a> {
    pub buffer: &'a mut PixelBuffer,
    pub color: Color,
    pub brush_size: BrushSize,
    pub opacity: f32,  // NEW: 0.0–1.0, default 1.0
}
```

**Invariant**: `opacity` is clamped to [0.0, 1.0] at construction. Values outside this range are clamped, not rejected. This mirrors the `Layer::set_opacity()` pattern.

**Impact**: All call sites that construct `ToolContext` must provide `opacity`. The `EditorService::run_tool()` method constructs `ToolContext` — it receives opacity from the command layer.

---

### BrushSize (Rust domain — modified)

**Location**: `src-tauri/src/domain/tools/mod.rs`

Current: Range 1..=16
Modified: Range 1..=32

**Rationale**: The spec assumption states "a reasonable default of 32 pixels will be assumed as the upper bound." Minecraft textures go up to 64×64; a 32px brush covers half the canvas, which is a reasonable maximum.

---

### ToolType (TypeScript frontend — modified)

**Location**: `src/store/toolStore.ts`

Current:
```typescript
type ToolType = "brush" | "eraser" | "fill" | "eyedropper" | "line" | "rectangle"
```

Modified:
```typescript
type ToolType = "brush" | "eraser" | "fill" | "eyedropper" | "line" | "selection" | "move" | "zoom"
```

**Changes**:
- `"rectangle"` → `"selection"` (rename for clarity, matching spec terminology)
- Added `"move"` and `"zoom"` (toolbar placeholders, no backend behavior)

---

### ToolStore (TypeScript frontend — modified)

**Location**: `src/store/toolStore.ts`

Current:
```typescript
interface ToolState {
  activeToolType: ToolType;
  brushSize: number;
  activeColor: ColorDto;
}
```

Modified:
```typescript
type PipetteMode = "composite" | "active_layer";

interface ToolState {
  activeToolType: ToolType;
  brushSize: number;
  opacity: number;           // NEW: 0–100 (display as %), default 100
  activeColor: ColorDto;
  secondaryColor: ColorDto;  // NEW: for X swap, default white {255,255,255,255}
  pipetteMode: PipetteMode;  // NEW: default "composite"
}

interface ToolActions {
  setActiveToolType: (toolType: ToolType) => void;
  setBrushSize: (size: number) => void;
  setOpacity: (opacity: number) => void;       // NEW
  setActiveColor: (color: ColorDto) => void;
  setSecondaryColor: (color: ColorDto) => void; // NEW
  swapColors: () => void;                       // NEW: swap active ↔ secondary
  setPipetteMode: (mode: PipetteMode) => void;  // NEW
}
```

**Notes**:
- `opacity` is stored as integer 0–100 for display purposes. Converted to 0.0–1.0 (f32) when sent to the backend.
- `secondaryColor` defaults to `{ r: 255, g: 255, b: 255, a: 255 }` (white).
- `swapColors()` exchanges `activeColor` and `secondaryColor`.
- `pipetteMode` only affects the Pipette/Eyedropper tool.

---

## New Frontend State (Refs, not stores)

These are transient interaction state managed via React refs in `useViewportControls`, not persisted in Zustand stores.

### lastStrokeEndPoint

```typescript
// In useViewportControls
const lastStrokeEndPointRef = useRef<{ x: number; y: number } | null>(null);
```

Updated on each tool release with the final pixel position. Used for Shift+Click line drawing. Reset to null when texture is closed/changed.

### linePreviewStart

```typescript
// In useCanvasRenderer (via CanvasRendererApi)
const linePreviewRef = useRef<{ startX: number; startY: number } | null>(null);
```

Set on Line tool press, cleared on release. Used by the renderer to draw the preview overlay.

### pendingDrag (throttle state)

```typescript
// In useViewportControls
const pendingDragRef = useRef<{ x: number; y: number } | null>(null);
const dragRafRef = useRef<number>(0);
```

Stores the latest pointermove pixel for rAF-gated tool_drag dispatch. Ensures at most one tool_drag per animation frame.

---

## Backend Command Parameter Changes

### tool_press command

Current parameters: `tool, layer_id, x, y, color, brush_size`
Modified parameters: `tool, layer_id, x, y, color, brush_size, opacity, pipette_mode`

- `opacity: f32` — passed through to `ToolContext`. Default 1.0 if not provided.
- `pipette_mode: String` — `"composite"` or `"active_layer"`. Only used when `tool == "color_picker"`. Ignored for other tools.

### tool_drag command

Current parameters: `layer_id, x, y, color, brush_size`
Modified parameters: `layer_id, x, y, color, brush_size, opacity`

- `opacity` added to match tool_press. Needed because `ToolContext` now requires it.

### tool_release command

Current parameters: `layer_id, x, y, color, brush_size`
Modified parameters: `layer_id, x, y, color, brush_size, opacity`

- Same rationale as tool_drag.

---

## Entity Relationships

```
ToolStore (frontend)
├── activeToolType ──→ maps to backend tool name (or "move"/"zoom" = no-op)
├── brushSize ───────→ passed as brush_size to all tool commands
├── opacity ─────────→ passed as opacity to all tool commands (÷100 for f32)
├── activeColor ─────→ passed as color to tool commands
├── secondaryColor ──→ swapped with activeColor on X key
└── pipetteMode ─────→ passed as pipette_mode to tool_press only

EditorService (backend)
├── run_tool() ──────→ constructs ToolContext with opacity
├── pick_color_composite() ──→ NEW: composites layers, reads pixel
└── apply_tool_press/drag/release() ──→ delegates to Tool trait

CanvasRendererApi (frontend)
├── cursorPixelRef ──→ brush cursor overlay
├── brushSizeRef ────→ brush cursor size
└── linePreviewRef ──→ NEW: Line tool start point for preview
```
