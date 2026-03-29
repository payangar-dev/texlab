# Contract: React Component API (Canvas Viewport)

**Feature**: 006-canvas-viewport
**Date**: 2026-03-29

## Components

### `<CanvasViewport />`

Main canvas component. Renders the composite texture with zoom/pan and overlays.

```typescript
// No props needed -- reads from Zustand stores
function CanvasViewport(): React.ReactElement;
```

**Responsibilities**:
- Render composite RGBA data onto HTML5 Canvas 2D
- Handle pointer events (tool dispatch, pan)
- Handle wheel events (zoom)
- Draw pixel grid overlay at high zoom
- Draw cursor preview overlay
- Draw checkerboard transparency pattern
- Respond to container resize

**State dependencies**:
- `useEditorStore` → `texture` (dimensions, null check), `activeLayerId`
- `useViewportStore` → `zoom`, `panX`, `panY`, `containerWidth`, `containerHeight`

### `<StatusBar />`

Status bar at the bottom of the editor. Displays cursor position, texture dimensions, zoom level.

```typescript
function StatusBar(): React.ReactElement;
```

**Displays**:
- Cursor position: `X: {pixelX}  Y: {pixelY}` (clears when cursor is off-texture)
- Texture dimensions: `{width} x {height}` (clears when no texture loaded)
- Zoom level: `{zoom * 100}%`

**State dependencies**:
- `useEditorStore` → `texture?.width`, `texture?.height`
- `useViewportStore` → `zoom`
- Cursor position: received via a lightweight pub/sub (ref-based, not store) from `CanvasViewport`

## Zustand Stores

### `useViewportStore` (NEW)

```typescript
interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
  containerWidth: number;
  containerHeight: number;
}

interface ViewportActions {
  setZoom: (zoom: number, cursorX?: number, cursorY?: number) => void;
  setPan: (panX: number, panY: number) => void;
  fitToViewport: (textureWidth: number, textureHeight: number) => void;
  zoomIn: (cursorX?: number, cursorY?: number) => void;
  zoomOut: (cursorX?: number, cursorY?: number) => void;
  resetZoom: () => void;  // Zoom to 100%
  setContainerSize: (width: number, height: number) => void;
}

type ViewportStore = ViewportState & ViewportActions;
```

**File**: `src/store/viewportStore.ts`

### `useEditorStore` (EXISTING -- no changes)

Already defined in `src/store/editorStore.ts`. The canvas reads `texture` for dimensions and null-checking.

## Custom Hooks

### `useCanvasRenderer`

Encapsulates the imperative canvas rendering logic.

```typescript
function useCanvasRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement>,
): {
  updateComposite: (data: Uint8ClampedArray, width: number, height: number) => void;
  requestRedraw: () => void;
};
```

### `useViewportControls`

Encapsulates zoom/pan event handling.

```typescript
function useViewportControls(
  canvasRef: React.RefObject<HTMLCanvasElement>,
): {
  interactionMode: React.RefObject<InteractionMode>;
  cursorPixel: React.RefObject<{ x: number; y: number } | null>;
};
```

### `useKeyboardShortcuts`

Registers keyboard shortcuts for zoom/pan.

```typescript
function useKeyboardShortcuts(): void;
```

### `useResizeObserver`

Observes container resize and updates viewport store.

```typescript
function useResizeObserver(
  containerRef: React.RefObject<HTMLDivElement>,
): void;
```

## Event Flow

```
User Action          → Handler              → Side Effects
─────────────────────────────────────────────────────────────
Pointer down (tool)  → toolPress() IPC      → Update offscreen canvas, redraw
Pointer move (tool)  → toolDrag() IPC       → Update offscreen canvas, redraw
Pointer up (tool)    → toolRelease() IPC    → Update offscreen canvas, redraw
Pointer down (pan)   → Set pan start ref    → (no redraw yet)
Pointer move (pan)   → viewportStore.setPan → Redraw via transient subscription
Pointer up (pan)     → End pan              → (no redraw)
Wheel                → viewportStore.zoomIn/Out → Redraw via transient subscription
Ctrl+=               → viewportStore.zoomIn → Redraw
Ctrl+-               → viewportStore.zoomOut → Redraw
Ctrl+0               → viewportStore.fitToViewport → Redraw
Ctrl+1               → viewportStore.resetZoom → Redraw
Container resize     → viewportStore.setContainerSize → Redraw
state-changed event  → getComposite() IPC   → Update offscreen canvas, redraw
```
