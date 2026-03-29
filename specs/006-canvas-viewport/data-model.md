# Data Model: Canvas Viewport

**Feature**: 006-canvas-viewport
**Date**: 2026-03-29

## Entities

### ViewportState (Frontend only -- Zustand store)

Pure frontend state. Not synced to Rust backend.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `zoom` | `number` | Integer zoom multiplier (1 = 100%) | Must be a value from `ZOOM_LEVELS` table |
| `panX` | `number` | Horizontal pan offset (screen pixels) | Float, snapped to integer at render time |
| `panY` | `number` | Vertical pan offset (screen pixels) | Float, snapped to integer at render time |
| `containerWidth` | `number` | Canvas container width (CSS pixels) | >= 1, updated by ResizeObserver |
| `containerHeight` | `number` | Canvas container height (CSS pixels) | >= 1, updated by ResizeObserver |

**Relationships**: Read by `CanvasRenderer`, `StatusBar`, `CursorPreview`. Written by zoom/pan handlers.

### ZoomLevels (Constant table)

```typescript
const ZOOM_LEVELS: readonly number[] = [
  0.25, 0.33, 0.5,
  1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 48, 64, 96, 128
] as const;
```

20 discrete levels. Sub-100% values are fractional multipliers (1/4, 1/3, 1/2). All values >= 1 are integers.

### CursorState (Frontend only -- transient)

Derived in real-time from pointer events. Lives in refs, not in store (too high-frequency).

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `screenX` | `number` | Mouse X relative to canvas element | From `event.offsetX` |
| `screenY` | `number` | Mouse Y relative to canvas element | From `event.offsetY` |
| `textureX` | `number` | Texture-space X coordinate | `(screenX - panX) / zoom` |
| `textureY` | `number` | Texture-space Y coordinate | `(screenY - panY) / zoom` |
| `pixelX` | `number` | Discrete pixel column | `Math.floor(textureX)`, valid if `0 <= pixelX < width` |
| `pixelY` | `number` | Discrete pixel row | `Math.floor(textureY)`, valid if `0 <= pixelY < height` |
| `isOverTexture` | `boolean` | Whether cursor is within texture bounds | Derived from pixelX/pixelY range check |

### InteractionMode (Enum)

```typescript
type InteractionMode = "tool" | "pan";
```

Determines how pointer events are interpreted. Default is `"tool"`. Switches to `"pan"` when:
- Middle mouse button is pressed (`event.button === 1`)
- Space key is held AND pointer goes down

### CanvasRenderer (Internal -- imperative)

Not a data entity but a key internal structure managing the render pipeline.

| Field | Type | Description |
|-------|------|-------------|
| `offscreenCanvas` | `HTMLCanvasElement` | Texture-sized canvas for `putImageData` |
| `offscreenCtx` | `CanvasRenderingContext2D` | Context for offscreen canvas |
| `displayCanvas` | `HTMLCanvasElement` | Visible canvas element (ref) |
| `displayCtx` | `CanvasRenderingContext2D` | Context for display canvas |
| `checkerboardPattern` | `CanvasPattern` | Cached transparency pattern |
| `dirty` | `boolean` | Whether a redraw is needed |
| `animFrameId` | `number` | `requestAnimationFrame` handle |

## Existing Entities (from prior features -- referenced, not modified)

### CompositeDto (Existing -- from Rust backend)

```typescript
interface CompositeDto {
  width: number;   // Texture width in pixels
  height: number;  // Texture height in pixels
  data: number[];  // Flat RGBA array (row-major, 4 bytes per pixel)
}
```

Already defined in `src/api/commands.ts`. Returned by `getComposite()` and optionally in `ToolResultDto`.

### EditorStateDto (Existing)

Contains `texture: TextureMetadataDto | null` with `width` and `height`. Used to determine if a texture is loaded and its dimensions.

## State Transitions

### Viewport Lifecycle

```
[No Texture] ──(open/create texture)──> [Initial View]
  │                                        │
  │                                        ├──(fit-to-viewport)──> [Fitted View]
  │                                        ├──(scroll wheel)──> [Zoomed View]
  │                                        ├──(Ctrl+1)──> [100% View]
  │                                        └──(drag pan)──> [Panned View]
  │
  ├── Initial View: zoom = fitToViewport(texW, texH, containerW, containerH)
  │                  pan = centered
  │
  ├── Zoomed View:  zoom = ZOOM_LEVELS[newIndex]
  │                  pan = adjusted to keep cursor point fixed
  │
  └── Panned View:  zoom = unchanged
                     pan += dragDelta
```

### Interaction State Machine

```
                          pointerdown (button=1)
                          OR pointerdown (space held)
[Idle] ──────────────────────────────────────────> [Panning]
  │                                                    │
  │  pointerdown (button=0, no space)                  │ pointerup / pointercancel
  ├──────────────────────────> [ToolActive]             └──────────> [Idle]
  │                              │
  │                              │ pointerup
  │                              └──────────> [Idle]
  │
  │  wheel
  ├──────────────────────────> [Zoom] ──(immediate)──> [Idle]
```

## Validation Rules

1. **Zoom bounds**: `zoom` must be a value present in `ZOOM_LEVELS`. Zoom in/out steps to the next/previous entry.
2. **Pan when fitted**: If `textureWidth * zoom <= containerWidth AND textureHeight * zoom <= containerHeight`, pan is locked to center values.
3. **Pan safeguard**: `|panX|` and `|panY|` capped at `textureSize * zoom + containerSize` to prevent losing the texture.
4. **Pixel grid visibility**: Drawn only when `zoom >= 4`.
5. **Cursor preview bounds**: Only shown when `isOverTexture === true`.
