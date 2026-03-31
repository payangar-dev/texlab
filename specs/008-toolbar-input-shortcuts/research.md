# Research: Tool Bar + Tool Input Handling + Keyboard Shortcuts

**Feature Branch**: `008-toolbar-input-shortcuts`
**Date**: 2026-03-30

## R1: Brush Opacity Implementation

**Context**: FR-004 requires brush opacity as a configurable option. The current domain `ToolContext` has no opacity field. Need to determine how opacity applies to pixel painting.

**Decision**: Add `opacity: f32` (0.0–1.0) to `ToolContext`. Apply per-stamp alpha blending in `BrushTool::stamp()`.

**Rationale**: For each pixel painted, blend the brush color with the existing pixel:
```
result_channel = existing * (1 - opacity) + brush_color * opacity
result_alpha = existing_alpha + (brush_alpha - existing_alpha) * opacity
```
This is simple per-pixel blending. In pixel art at small canvas sizes (16×16 to 64×64), this is performant and correct. More sophisticated "per-stroke non-accumulating" opacity (where overlapping stamp areas don't darken further) is not needed for v1 — the spec mentions opacity as a basic control, not a Photoshop-grade feature.

**Implementation**:
- Add `opacity: f32` to `ToolContext` (domain layer, std-only, no external dep)
- In `BrushTool::stamp()`, when opacity < 1.0, blend instead of overwrite
- `EraserTool` does NOT use opacity (spec US3-2 says eraser options are "size" only)
- Default opacity = 1.0 (fully opaque) preserves current behavior

**Alternatives considered**:
- Per-stroke opacity mask (track visited pixels, don't re-blend within a stroke): Overly complex for pixel art. Rejected per constitution VI (Simplicity).
- Opacity only in frontend as alpha on color: Would require modifying the Color before sending. Less clean — opacity is conceptually a tool property, not a color property.

---

## R2: Pipette Composite Sampling

**Context**: FR-018 requires the Pipette (ColorPicker) to sample from either the composite of all visible layers or the active layer only. The current `Tool` trait operates on a single `PixelBuffer` (the active layer via `ToolContext`).

**Decision**: Handle composite sampling at the `EditorService` level, not in the domain `Tool` trait.

**Rationale**: The `Tool` trait's `ToolContext` provides a mutable reference to a single layer's `PixelBuffer`. For composite sampling, we need to composite all visible layers (using `Texture::composite()`) and read a pixel from the result. This crosses the boundary of what a single tool should know about.

**Implementation**:
- Add `pick_color_composite(&self, x: u32, y: u32) -> Result<Color, DomainError>` to `EditorService`
  - Calls `self.texture.composite()` to get the composited `PixelBuffer`
  - Reads the pixel at (x, y) from the composite
- In `tool_press` command: if tool is `"color_picker"` and mode is `"composite"`:
  - Call `editor.pick_color_composite(x, y)` instead of the tool's `on_press`
  - Return `ToolResult::ColorPicked(color)`
- If mode is `"active_layer"`: use the existing `ColorPickerTool.on_press()` path (reads from active layer buffer)
- Frontend sends `pipette_mode: "composite" | "active_layer"` as an additional param to `tool_press`
- This param is only used when tool == "color_picker", ignored otherwise

**Alternatives considered**:
- Expand `ToolContext` with an optional composite `PixelBuffer`: Pollutes the tool interface for a single tool's feature. Every tool receives an optional buffer they don't need. Rejected.
- Pre-composite and pass as the active buffer: Dangerous — the tool could write to the composite, which is meaningless. Rejected.

---

## R3: Line Tool Live Preview

**Context**: FR-017 requires the Line tool to show a live preview while dragging. Currently, `LineTool::on_drag()` is a no-op — the line is drawn only on `on_release()`.

**Decision**: Render the preview entirely in the frontend canvas render loop. No backend changes needed.

**Rationale**: The preview is a visual overlay, not a committed pixel operation. The existing render loop (`useCanvasRenderer.ts`) already draws a cursor preview overlay. Extending it to draw a Bresenham line preview is natural.

**Implementation**:
1. Add `bresenhamLine(x0, y0, x1, y1)` to `src/components/canvas/math.ts` — pure TypeScript port of the Rust algorithm (~20 lines)
2. Add `linePreviewRef: RefObject<{startX, startY} | null>` to `CanvasRendererApi`
3. In `useViewportControls.ts`: when Line tool is active:
   - On press: set `linePreviewRef.current = { startX: pixel.x, startY: pixel.y }`
   - On release: clear `linePreviewRef.current = null`
4. In `useCanvasRenderer.ts` render loop: if `linePreviewRef.current` is set and `cursorPixelRef.current` is set:
   - Compute Bresenham points from start to cursor
   - Draw semi-transparent pixels at each point (respecting brush size)
5. The preview is cleared on release, and the actual line is drawn by the backend `LineTool::on_release()`

**Alternatives considered**:
- Separate overlay canvas element: Adds DOM complexity, no benefit for pixel art rendering. Rejected.
- Backend preview command: Unnecessary IPC round-trip for a purely visual effect. Rejected.

---

## R4: Input Throttling Strategy

**Context**: FR-007 requires input points throttled at ~16ms during tool drag.

**Decision**: Use `requestAnimationFrame` (rAF) gating for tool_drag dispatch.

**Rationale**: Browser `pointermove` events fire at the display refresh rate — 60Hz (16.67ms) on most displays, but up to 144Hz+ on gaming monitors. rAF naturally caps at the display refresh rate (~16ms on 60Hz). On faster displays, it still syncs with the render cycle, avoiding unnecessary IPC calls between frames.

**Implementation**:
- In `useViewportControls.ts`, during tool mode pointermove:
  - Store the latest pixel position in a ref (`pendingDragRef`)
  - Schedule a rAF callback that reads `pendingDragRef` and calls `toolDrag`
  - If a rAF is already scheduled, skip (natural dedup)
  - On pointerup, flush any pending drag point before calling `toolRelease`
- The backend's Bresenham interpolation (in `BrushTool::on_drag()`) fills any gaps between the throttled points, so stroke quality is unaffected

**Alternatives considered**:
- Timestamp-based throttle (check `Date.now() - lastCall >= 16`): Works but less clean than rAF, doesn't sync with the render cycle. Not preferred.
- No throttle: Simple but wasteful on high-refresh displays. Acceptable as a fallback if rAF adds complexity.
- Collect all points and batch-send: Over-engineering for pixel art IPC. Rejected.

---

## R5: Shift+Click Straight Line

**Context**: FR-009 requires Shift+Click to draw a straight line from the last drawn point to the clicked point, using the active tool.

**Decision**: Track `lastStrokeEndPoint` in the frontend (ref in `useViewportControls`). On Shift+Click, execute a tool press at `lastStrokeEndPoint`, drag to clicked point, then release.

**Rationale**: The backend `BrushTool` already does Bresenham interpolation on `on_drag()` — it draws from its internal `last_pos` to the new position. So calling `tool_press(lastPoint)` then `tool_drag(clickedPoint)` then `tool_release(clickedPoint)` naturally draws a straight line between the two points. This reuses existing tool behavior without any domain changes.

**Implementation**:
1. Add `lastStrokeEndPointRef = useRef<{x, y} | null>(null)` in `useViewportControls`
2. On normal tool release: update `lastStrokeEndPointRef.current = pixel`
3. On pointerDown with Shift key held:
   - If `lastStrokeEndPointRef.current` exists: execute press(lastPoint) → drag(clickedPoint) → release(clickedPoint)
   - If null: execute normal press(clickedPoint) (per edge case spec)
4. Applicable to drawing tools only (brush, eraser, line). For non-drawing tools, Shift+Click behaves as normal click.

**Alternatives considered**:
- Backend Shift+Click command: Adds a new command for something the existing press/drag/release cycle already handles. Over-engineering. Rejected.
- Frontend-only Bresenham with multiple tool_press calls: Would bypass the backend's interpolation and undo system. Incorrect. Rejected.

---

## R6: Keyboard Shortcut Suppression

**Context**: FR-013 requires shortcuts to be suppressed when text input fields, modals, or focus-capturing elements are active.

**Decision**: Check `event.target` in the keydown handler before processing shortcuts.

**Implementation**:
```typescript
function shouldSuppressShortcut(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return true;
  if (target.closest('dialog[open]')) return true;
  return false;
}
```
Add this check at the top of the keydown handler, before any shortcut processing. Only non-modifier shortcuts (single keys like B, E, [, ]) need this check — Ctrl+shortcuts are already standard and don't conflict with typing.

**Alternatives considered**:
- React context flag for "shortcuts enabled": Over-engineering. The DOM already tells us what has focus. Rejected.
- `e.defaultPrevented` check: Unreliable, depends on event handler ordering. Rejected.

---

## R7: Mid-Stroke Tool Switch Finalization

**Context**: FR-016 requires that switching tools mid-stroke finalizes the current stroke before activating the new tool.

**Decision**: Before switching tools (via toolbar click or keyboard shortcut), check if a stroke is in progress and finalize it.

**Implementation**:
- In `useViewportControls`, expose the `interactionModeRef` (already returned)
- In tool switching logic (toolbar click handler and keyboard shortcut handler):
  - If `interactionModeRef.current === "tool"`: call `toolRelease` with the current cursor position, then switch tools
  - This triggers the backend's `apply_tool_release()` which pushes the undo entry
- The current `useViewportControls` already returns `interactionModeRef` — it just needs to be wired to the switching logic

**Alternatives considered**:
- Prevent tool switching during strokes: Bad UX. Users expect to be able to switch mid-action. Rejected.
- Backend auto-finalization: The backend doesn't know about tool switches (it's stateless per-invocation). Frontend must handle this. Only viable approach.

---

## R8: Move and Zoom Tool Placeholders

**Context**: The spec includes Move (V) and Zoom (Z) in the toolbar and keyboard shortcuts, but states "their full functional behavior may be scoped to a separate feature."

**Decision**: Add them as toolbar entries with icons and keyboard shortcuts. They will be selectable but have no canvas behavior (clicking the canvas with these tools active is a no-op).

**Implementation**:
- Add `"move"` and `"zoom"` to the frontend `ToolType` union
- Add icons: `Move` (lucide) for Move, `ZoomIn` (lucide) for Zoom
- They do NOT map to any backend tool — `useViewportControls` skips tool_press for unknown tool types
- The options bar shows empty/minimal content for these tools

**Alternatives considered**:
- Omit them entirely: The spec explicitly includes them in the toolbar (FR-001) and shortcut list (FR-010). Must include. No alternative.
