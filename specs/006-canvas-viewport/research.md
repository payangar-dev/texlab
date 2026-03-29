# Research: Canvas Viewport

**Feature**: 006-canvas-viewport
**Date**: 2026-03-29

## R-001: Canvas 2D Rendering Pipeline

**Decision**: Offscreen canvas (`putImageData`) + display canvas (`drawImage`) two-stage pipeline.

**Rationale**: `putImageData` ignores all canvas transforms (translate, scale, rotate) and writes raw pixels at absolute coordinates. It cannot be used directly with zoom/pan transforms. Instead, the composite RGBA data from the Rust backend is written to a small offscreen canvas (matching texture dimensions: 16x16, 64x64, etc.) via `putImageData`, then drawn onto the visible display canvas using `drawImage()` with `imageSmoothingEnabled = false` for GPU-accelerated nearest-neighbor scaling.

**Alternatives considered**:
- **Direct `putImageData` on display canvas**: Rejected -- ignores transforms, would require manually computing every pixel position at zoomed scale.
- **`createImageBitmap`**: Rejected -- async API adds complexity to render loop; performs premultiplied-alpha conversion that can introduce rounding errors in alpha values (unacceptable for pixel art).
- **Per-pixel `fillRect` loop**: Rejected -- 1M calls for 1024x1024 textures. Acceptable for 16x16 (256 calls) but not scalable.

## R-002: Nearest-Neighbor Scaling

**Decision**: Use both `imageSmoothingEnabled = false` on the 2D context AND `image-rendering: pixelated` CSS on the canvas element.

**Rationale**: Belt-and-suspenders approach. `imageSmoothingEnabled` is the primary mechanism for `drawImage` calls. CSS `image-rendering: pixelated` reinforces it for the browser's own canvas-to-screen mapping (relevant for HiDPI). Both are fully supported in Tauri's WebView2 (Chromium-based).

**Gotcha**: `imageSmoothingEnabled` resets to `true` whenever canvas `width`/`height` attributes change. Must be re-set after every canvas resize.

## R-003: Zoom/Pan via Canvas Transforms

**Decision**: Use `ctx.setTransform(zoom, 0, 0, zoom, panX, panY)` with integer zoom and integer pan offset.

**Rationale**: One call sets up the entire coordinate system. Drawing the texture is just `drawImage(offscreen, 0, 0)`. Integer zoom guarantees every texture pixel maps to exactly `zoom x zoom` screen pixels. Integer pan offset prevents sub-pixel blurriness on grid lines.

**Key rule**: During drag, accumulate sub-pixel pan movement in a float accumulator, but snap the render offset to integers via `Math.round()`.

**Alternatives considered**:
- **CSS transforms on canvas element**: Rejected -- prevents drawing overlays (grid, cursor) at screen resolution; they would scale with the texture.
- **Manual coordinate math per draw call**: Rejected -- more complex with no benefit over `setTransform`.

## R-004: Render Loop & Continuous Updates

**Decision**: Full-canvas redraw via `requestAnimationFrame` with a dirty flag. No partial updates.

**Rationale**: Textures are tiny (16x16 = 1KB, even 1024x1024 is fast). `drawImage` is GPU-accelerated. Partial update tracking (dirty rectangles) adds complexity with no measurable benefit. The Tauri IPC already returns a full composite on each `toolDrag` call.

**Brush stroke flow**:
1. `pointerdown` → `toolPress()` IPC → receive `CompositeDto` → update offscreen canvas → set dirty
2. `pointermove` → `toolDrag()` IPC → receive `CompositeDto` → update offscreen canvas → set dirty
3. `pointerup` → `toolRelease()` IPC → receive `CompositeDto` → update offscreen canvas → set dirty
4. `requestAnimationFrame` loop picks up dirty flag, redraws at vsync

Multiple IPC responses between frames naturally coalesce (only the latest offscreen canvas state is drawn).

## R-005: HiDPI / devicePixelRatio Handling

**Decision**: Scale canvas backing store by `devicePixelRatio`. Include DPR in the transform: `ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, panX * dpr, panY * dpr)`.

**Rationale**: Grid lines and cursor overlays render at full device resolution (crisp on HiDPI displays). `imageSmoothingEnabled = false` prevents texture smoothing at DPR-scaled resolution.

**Gotcha**: Fractional DPR (1.25, 1.5) can cause non-uniform pixel sizes. Accept this as a browser/OS limitation. Round `canvas.width`/`canvas.height` to integers.

**DPR changes**: Detect via `ResizeObserver` with `devicePixelContentBox` or `matchMedia` listener when window moves between monitors.

## R-006: Checkerboard Transparency Pattern

**Decision**: Draw a 2x2 pixel offscreen canvas, create a `CanvasPattern` via `createPattern('repeat')`, fill the texture area before drawing the composite.

**Rationale**: The pattern participates in the same `setTransform` as the texture, so each checker square scales with zoom. At any zoom level, transparent pixels show the checkerboard at correct proportions. GPU-accelerated via `createPattern`.

**Colors**: Light theme: `#CCCCCC` / `#FFFFFF`. Dark theme: `#333333` / `#444444` (TexLab uses dark UI, so dark checkerboard).

**Alternatives considered**:
- **CSS `background-image` on canvas**: Rejected -- checkerboard would extend beyond texture bounds and not scale with zoom.
- **Inline per-pixel checkerboard draw**: Rejected -- unnecessary overhead; pattern is a one-time creation.

## R-007: React + Canvas Integration Pattern

**Decision**: Imperative canvas via `useRef<HTMLCanvasElement>` with rendering fully outside React's lifecycle.

**Rationale**: Canvas content is opaque to React's virtual DOM. Triggering re-renders for pixel updates adds overhead with zero value. The component renders the `<canvas>` element once; all visual updates go through canvas API directly. Use `React.memo` on the component to prevent re-renders.

**Alternatives considered**:
- **react-konva / fabric.js**: Rejected -- heavy abstractions for scene graphs with many objects. TexLab renders a single pixel buffer + overlays.
- **WebGL**: Rejected -- overkill for 2D pixel rendering at 16x16 to 1024x1024.
- **OffscreenCanvas Web Worker**: Rejected -- IPC overhead to worker exceeds rendering time for these texture sizes.

## R-008: Mouse/Pointer Event Handling

**Decision**: Pointer Events (`onPointerDown`, `onPointerMove`, `onPointerUp`) via React JSX props. Native `addEventListener` for `wheel` with `{ passive: false }`.

**Rationale**: Pointer Events unify mouse, touch, and stylus. React JSX props are fine for pointer events (React 19 uses event delegation). Wheel events MUST use native `addEventListener` because React registers them as passive, preventing `preventDefault()` (needed to block page scroll/zoom).

**Key details**:
- `setPointerCapture(pointerId)` on pointerdown for drag continuity outside canvas bounds.
- No throttle/debounce on pointermove -- textures are tiny, coordinate conversion is cheap.
- Middle-click pan: `event.button === 1`.
- Space+drag pan: track space key state via ref.

## R-009: Keyboard Shortcuts

**Decision**: Custom `useKeyboard` hook using `useEffect` + native `addEventListener('keydown'/'keyup')` on `window`.

**Rationale**: Small, well-defined shortcut set (zoom in/out, fit, 1:1, space for pan). No external dependency justified. Space key requires tracking held state via ref (not state -- no re-render needed).

**Shortcuts**:
- `Ctrl+=` / `Ctrl+-`: Zoom in/out (step through zoom table)
- `Ctrl+0`: Fit to viewport
- `Ctrl+1`: Zoom to 100% (1:1)
- `Space` (held): Pan mode

**Tauri note**: `zoomHotkeysEnabled` defaults to `false` in Tauri v2, so Ctrl+=/- won't zoom the webview. JS `preventDefault()` is sufficient.

## R-010: Viewport State Management

**Decision**: Dedicated Zustand store (`viewportStore`) separate from `editorStore`. Canvas subscribes via Zustand's transient update pattern (`store.subscribe()` + ref).

**Rationale**: Viewport state (zoom, panX, panY) changes at very high frequency during pan but doesn't need Rust backend sync. Separate store prevents coupling with the IPC-synced editor state. Transient subscription avoids React re-renders during pan. Status bar uses normal `useViewportStore()` selector (re-renders are fine for text updates).

**Store shape**:
- `zoom`: number (integer multiplier)
- `panX`, `panY`: number (screen-space pixel offset)
- `containerWidth`, `containerHeight`: number (from ResizeObserver)

## R-011: Container Resize Detection

**Decision**: Custom `useResizeObserver` hook with `ResizeObserver` on the canvas container div.

**Rationale**: The canvas lives inside a dockview panel. Panel resizes can happen independently of window resizes. `ResizeObserver` on the container catches all cases. Simple 10-15 line hook, no dependency needed.

**Key detail**: Use `contentBoxSize` from `ResizeObserverEntry`. After resize, update `canvas.width`/`canvas.height` attributes and trigger redraw.

## R-012: Screen-to-Texture Coordinate Conversion

**Decision**: Standard affine transform inversion.

**Formulas**:
- Screen to texture: `textureX = (screenX - panX) / zoom`, `textureY = (screenY - panY) / zoom`
- Discrete pixel: `pixelX = Math.floor(textureX)`, `pixelY = Math.floor(textureY)`
- Bounds check: `0 <= pixelX < textureWidth && 0 <= pixelY < textureHeight`
- Use `event.offsetX`/`event.offsetY` for screen coordinates relative to canvas.

## R-013: Zoom Level Sequence

**Decision**: 20 discrete integer levels from 25% to 12800%.

**Sequence** (as integer multipliers where applicable):
```
Sub-100%: 1/4 (25%), 1/3 (33%), 1/2 (50%)
100%+: 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 48, 64, 96, 128
```

**Rationale**: Mirrors Aseprite's approach. 1x-6x range uses single steps for fine control at working zoom levels. Above 6x, gaps accelerate. Sub-100% levels are minimal since TexLab targets small textures (16x16 at 25% = 4x4 screen pixels).

**Alternatives considered**:
- **Powers-of-two only** (1x, 2x, 4x, 8x...): Rejected -- jumps too coarse; skips useful 3x, 5x, 6x levels.
- **Continuous smooth zoom**: Rejected -- non-integer zoom causes pixel distortion. Spec explicitly requires integer-only.

## R-014: Zoom-to-Cursor Algorithm

**Decision**: Standard offset correction formula.

**Formula** (screen-space pan):
```
newPan = cursorScreen - (cursorScreen - oldPan) * (newZoom / oldZoom)
```

This ensures the texture point under the cursor stays under the cursor after zoom. All arithmetic uses float for pan offset (inherently fractional when zooming to cursor).

## R-015: Fit-to-Viewport Calculation

**Decision**: Snap down to nearest integer zoom level from the zoom table.

**Formula**:
```
fitZoom = floor(min((viewportW - 2*padding) / textureW, (viewportH - 2*padding) / textureH))
Snap fitZoom down to nearest entry in zoom table.
Center texture in remaining space.
```

**Rationale**: Aseprite does the same. Non-integer fit zoom causes pixel size inconsistency. Integer-only guarantees pixel-perfect rendering even in fit mode.

**Padding**: Fixed 32px on each side.

## R-016: Pixel Grid Visibility Threshold

**Decision**: Show grid at >= 4x (400%) zoom. Progressive opacity: 0.2 at 4x, increasing to ~0.5 at 16x+.

**Rationale**: Aseprite and Figma use 4x. At 4x, each pixel is 4x4 screen pixels and a 1px grid line is distinguishable. Progressive opacity avoids jarring appearance.

**Grid color**: `rgba(128, 128, 128, alpha)` -- neutral gray, subtle against both light and dark pixels.

## R-017: Pan Constraints

**Decision**: Unconstrained when zoomed in past viewport. Locked/centered when texture fits within viewport.

**Rationale**: Aseprite and Pixelorama allow free panning. Users can always use fit-to-viewport to recenter. Per spec (Story 3, Scenario 4): when texture fits entirely in viewport, panning is disabled and texture stays centered.

**Safeguard**: Prevent panning more than one viewport dimension past the texture bounds (prevents "losing" the texture). Effectively: `maxPan = textureSize + viewportSize/zoom`.
