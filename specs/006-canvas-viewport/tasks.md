# Tasks: Canvas Viewport

**Input**: Design documents from `/specs/006-canvas-viewport/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the shared constants, utility functions, and state store that all user stories depend on.

- [x] T001 Create canvas constants file with ZOOM_LEVELS table (20 levels: 0.25 to 128), GRID_THRESHOLD (4), GRID_MAX_OPACITY (0.5), CHECKERBOARD_COLORS (#333333/#444444), FIT_PADDING (32) in src/components/canvas/constants.ts
- [x] T002 [P] Create coordinate math utilities with screenToTexture(), textureToScreen(), pixelAtScreen(), isInBounds(), zoomToCursorPan(), fitToViewportZoom(), clampPan(), gridOpacity() pure functions in src/components/canvas/math.ts
- [x] T003 [P] Create viewport Zustand store with ViewportState (zoom, panX, panY, containerWidth, containerHeight) and actions (setZoom, setPan, zoomIn, zoomOut, fitToViewport, resetZoom, setContainerSize) per contracts/component-api.md in src/store/viewportStore.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the core hooks and component shell that ALL user stories build upon.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 [P] Create useResizeObserver hook that observes a container ref via ResizeObserver, reads contentBoxSize, and calls viewportStore.setContainerSize() on resize with proper cleanup in src/hooks/useResizeObserver.ts
- [x] T005 [P] Create useCanvasRenderer hook managing the offscreen canvas (putImageData), checkerboard CanvasPattern (createPattern('repeat') on 2x2 canvas), requestAnimationFrame render loop with dirty flag, updateComposite() and requestRedraw() return functions, and HiDPI devicePixelRatio scaling in src/components/canvas/useCanvasRenderer.ts
- [x] T006 Create CanvasViewport component shell with container div ref, canvas ref, wire useResizeObserver, wire useCanvasRenderer, subscribe to viewportStore via transient pattern (store.subscribe()), apply image-rendering: pixelated CSS, and render empty state placeholder when no texture is loaded (read texture from useEditorStore) in src/components/canvas/CanvasViewport.tsx

**Checkpoint**: Component shell renders, canvas resizes with container, rAF loop runs.

---

## Phase 3: User Story 1 - View a texture on the canvas (Priority: P1) MVP

**Goal**: Open a texture and see it rendered pixel-perfectly on the canvas with nearest-neighbor interpolation. Canvas updates when tools modify pixels. Empty state when no texture loaded.

**Independent Test**: Open any texture via openTexture(), confirm the rendered image matches the original pixel data exactly with no anti-aliasing. Draw with a tool, confirm canvas updates. Close texture, confirm empty state.

### Implementation for User Story 1

- [x] T007 [US1] Implement composite data fetching: listen to editorStore.texture changes, call getComposite() when texture is loaded, convert data to Uint8ClampedArray, call updateComposite() on the renderer hook. Also listen to state-changed Tauri events to re-fetch composite after tool operations, undo/redo, and MCP mutations in src/components/canvas/CanvasViewport.tsx
- [x] T008 [US1] Implement the display canvas render function inside useCanvasRenderer: clear canvas, draw checkerboard pattern in texture space via ctx.setTransform(zoom*dpr, 0, 0, zoom*dpr, panX*dpr, panY*dpr) + fillRect with pattern, draw texture via drawImage(offscreen, 0, 0) with imageSmoothingEnabled=false (re-set after every resize), reset transform for overlays in src/components/canvas/useCanvasRenderer.ts
- [x] T009 [US1] Implement initial view on texture load: call fitToViewport() on viewportStore when texture dimensions become available (transition from null to loaded), center the texture in the viewport, trigger a redraw in src/components/canvas/CanvasViewport.tsx
- [x] T010 [US1] Implement empty state UI: when editorStore.texture is null, show a centered placeholder message (dark background matching design #2D2D2D, subtle text) instead of the canvas in src/components/canvas/CanvasViewport.tsx
- [x] T011 [US1] Wire App.tsx layout: render CanvasViewport as the main content area (flex: 1, overflow: hidden) with basic CSS structure (full-height flex column matching the UI design), no StatusBar yet in src/App.tsx
- [x] T012 [US1] Unit tests for viewportStore: test zoomIn/zoomOut step through ZOOM_LEVELS correctly, fitToViewport snaps down to nearest level with padding, resetZoom sets zoom to 1, setContainerSize updates dimensions, setPan respects clamping when texture fits viewport in src/store/viewportStore.test.ts
- [x] T013 [P] [US1] Unit tests for math.ts: test screenToTexture/textureToScreen round-trip, pixelAtScreen returns correct discrete coords, isInBounds edge cases (0,0 and width-1,height-1 in bounds, width/height out), zoomToCursorPan keeps cursor point fixed, fitToViewportZoom picks correct level from table in src/components/canvas/math.test.ts

**Checkpoint**: Texture renders pixel-perfectly. Canvas updates on draw/undo/redo. Empty state shows when no texture. Fit-to-viewport on initial load. All unit tests pass.

---

## Phase 4: User Story 2 - Zoom in and out (Priority: P1)

**Goal**: Zoom into the texture to work at individual pixel level or zoom out to see the full texture. Zoom via scroll wheel (centered on cursor) and keyboard shortcuts. Zoom level visible in status bar (deferred to US6).

**Independent Test**: Open a 16x16 texture, zoom in with scroll wheel, confirm pixels grow larger and each step is an integer multiple. Use Ctrl+0 to fit-to-viewport, Ctrl+1 for 100%. Confirm zoom doesn't exceed min/max bounds.

**Dependencies**: Requires US1 complete (texture must be visible to zoom).

### Implementation for User Story 2

- [x] T014 [US2] Implement scroll wheel zoom handler: attach native addEventListener('wheel', handler, { passive: false }) on canvas element in useEffect, call preventDefault() to block page zoom, compute cursor position via offsetX/offsetY, call viewportStore.zoomIn/zoomOut with cursor coords, trigger requestRedraw() in src/components/canvas/useViewportControls.ts
- [x] T015 [US2] Implement zoom-to-cursor pan adjustment: in viewportStore.zoomIn/zoomOut, apply the formula newPan = cursorScreen - (cursorScreen - oldPan) * (newZoom / oldZoom) to keep the texture point under the cursor fixed, clamp zoom to ZOOM_LEVELS bounds in src/store/viewportStore.ts
- [x] T016 [US2] Create useKeyboardShortcuts hook: register keydown/keyup listeners on window, handle Ctrl+= (zoomIn), Ctrl+- (zoomOut), Ctrl+0 (fitToViewport with current texture dimensions from editorStore), Ctrl+1 (resetZoom to 100%), preventDefault() on all handled combos, track space key held state in a ref (exported for pan mode), handle event.repeat for space in src/hooks/useKeyboardShortcuts.ts
- [x] T017 [US2] Wire useViewportControls and useKeyboardShortcuts into CanvasViewport component, ensure zoom triggers redraw via transient store subscription in src/components/canvas/CanvasViewport.tsx

**Checkpoint**: Scroll wheel zooms centered on cursor. Keyboard shortcuts work. Zoom stays within 25%-12800% bounds. Each zoom step renders pixel-perfectly (NxN screen pixels per texture pixel).

---

## Phase 5: User Story 3 - Pan across the texture (Priority: P1)

**Goal**: When zoomed in, pan the viewport via middle-click drag or space+left-click drag. Pan is smooth and responsive.

**Independent Test**: Zoom in on a texture, middle-click drag to pan. Confirm texture moves smoothly with cursor. Hold space and left-click drag for the same result. When texture fits entirely in viewport, confirm panning is disabled.

**Dependencies**: Requires US1 complete. Independent of US2 (can be implemented in parallel with US2 if US1 is done).

### Implementation for User Story 3

- [x] T018 [US3] Implement pan via pointer events in useViewportControls: detect middle-click (button===1) or space-held + left-click on pointerdown to enter pan mode, track pan start position in refs, compute delta on pointermove and call viewportStore.setPan(panX + dx, panY + dy), exit pan mode on pointerup. Use setPointerCapture for drag continuity outside canvas in src/components/canvas/useViewportControls.ts
- [x] T019 [US3] Implement pan constraints in viewportStore.setPan: when texture fits entirely within viewport (textureW * zoom <= containerW AND textureH * zoom <= containerH) lock pan to centered values. Otherwise allow free panning with safeguard capping (prevent losing texture off-screen) in src/store/viewportStore.ts
- [x] T020 [US3] Implement space+drag interaction rule per spec FR-005: space+drag must NOT interrupt an active tool operation. If a tool stroke is in progress (tracked via interaction mode ref), ignore space key. Pan mode activates only on the next pointerdown after space is held in src/components/canvas/useViewportControls.ts

**Checkpoint**: Middle-click drag pans smoothly. Space+left-drag pans. Pan disabled when texture fits viewport. Space ignored during active tool stroke.

---

## Phase 6: User Story 4 - Pixel grid at high zoom (Priority: P2)

**Goal**: Show a subtle grid between pixels when zoomed in enough (>= 4x), helping distinguish pixel boundaries. Grid does not interfere with editing.

**Independent Test**: Zoom in above 4x, confirm subtle grid lines appear between pixels. Zoom below 4x, confirm grid disappears. Draw on canvas, confirm grid doesn't interfere.

**Dependencies**: Requires US1 (rendering) and US2 (zoom) complete.

### Implementation for User Story 4

- [x] T021 [US4] Implement pixel grid drawing in the render function of useCanvasRenderer: after drawing the texture, if zoom >= GRID_THRESHOLD, draw 1px horizontal and vertical lines between pixels using ctx.strokeStyle with rgba(128,128,128,alpha) where alpha = gridOpacity(zoom) from math.ts. Draw in screen space (resetTransform) to keep lines at 1 device pixel regardless of zoom. Lines span the visible texture area only in src/components/canvas/useCanvasRenderer.ts
- [x] T022 [US4] Add gridOpacity() to math.ts: returns 0 for zoom < 4, linearly interpolates from 0.2 at zoom=4 to 0.5 at zoom>=16 in src/components/canvas/math.ts
- [x] T023 [US4] Add unit test for gridOpacity: verify returns 0 below threshold, 0.2 at threshold, 0.5 at 16+, interpolated values between in src/components/canvas/math.test.ts

**Checkpoint**: Grid visible at >= 4x with progressive opacity. Grid invisible below 4x. Drawing works normally with grid visible.

---

## Phase 7: User Story 5 - Cursor preview for active tool (Priority: P2)

**Goal**: Show a cursor overlay indicating the tool's area of effect when hovering over the canvas. The preview snaps to pixel boundaries.

**Independent Test**: Select brush tool with size 3, hover over canvas, confirm a 3x3 pixel preview shows at cursor position. Move across pixel boundaries, confirm it snaps. Move cursor outside texture, confirm no preview.

**Dependencies**: Requires US1 (rendering + coordinate conversion).

### Implementation for User Story 5

- [x] T024 [US5] Implement cursor position tracking in useViewportControls: on pointermove, compute texture pixel coords via pixelAtScreen(), update a cursorPixel ref ({ x, y } | null), set null when isInBounds returns false. Export cursorPixel ref for use by renderer and status bar in src/components/canvas/useViewportControls.ts
- [x] T025 [US5] Implement tool dispatch via pointer events in useViewportControls: on pointerdown (button=0, not pan mode), read active tool type and brush size from useToolStore (defaults: "brush", size 1), call toolPress() IPC with texture coords. On pointermove in tool mode, call toolDrag(). On pointerup, call toolRelease(). Update offscreen canvas from ToolResultDto.composite when present in src/components/canvas/useViewportControls.ts
- [x] T025b [P] [US5] Create minimal useToolStore with activeToolType (default "brush") and brushSize (default 1). This is a temporary placeholder — issue #8 (Tool bar + tool input handling) will replace it with the full ToolBar UI and keyboard shortcuts in src/store/toolStore.ts
- [x] T026 [US5] Implement cursor preview drawing in useCanvasRenderer: after drawing grid (if any), if cursorPixel is non-null, draw a semi-transparent highlight rectangle at the pixel position sized to brushSize from useToolStore (NxN pixels centered on cursor). Issue #8 will add per-tool cursor differentiation (crosshair for picker, bucket for fill, etc.) in src/components/canvas/useCanvasRenderer.ts
- [x] T027 [US5] Implement cursor style changes: set canvas CSS cursor to 'crosshair' for brush tools, 'copy' or custom for color picker, 'default' when outside texture bounds. Update on tool change and cursor position in src/components/canvas/CanvasViewport.tsx

**Checkpoint**: Cursor preview shows correct tool area. Snaps to pixel boundaries. No preview outside texture. Different cursor styles per tool. Tool operations work via pointer events.

---

## Phase 8: User Story 6 - Coordinate and zoom feedback in status bar (Priority: P3)

**Goal**: Status bar displays cursor position (pixel X, Y), texture dimensions, and zoom level in real-time.

**Independent Test**: Move cursor over canvas, confirm status bar shows correct pixel coordinate. Move cursor off texture, confirm coordinate clears. Zoom in/out, confirm zoom % updates. Open texture, confirm dimensions show.

**Dependencies**: Requires US1 (texture loading), US2 (zoom display), US5 (cursor tracking).

### Implementation for User Story 6

- [x] T028 [US6] Create StatusBar component matching the UI design: height 28px, background #161616, horizontal flex with gap 24, padding 0/12. Display cursor position "X: {x}  Y: {y}" (Geist Mono, 10px, #888888), texture dimensions "{w} x {h}", zoom level "{zoom*100}%". Add spacer (flex:1). Read zoom from useViewportStore selector, texture dimensions from useEditorStore selector in src/components/status-bar/StatusBar.tsx
- [x] T029 [US6] Implement cursor position pub/sub for StatusBar: create a lightweight callback ref pattern in CanvasViewport that StatusBar can subscribe to for cursor pixel updates (avoid putting high-frequency cursor coords in Zustand). StatusBar receives { x, y } | null and displays accordingly. Clear coordinates when cursor is null (off-texture or no texture) in src/components/canvas/CanvasViewport.tsx and src/components/status-bar/StatusBar.tsx
- [x] T030 [US6] Wire StatusBar into App.tsx layout: add StatusBar at the bottom of the flex column (fixed height, below CanvasViewport), matching the full-width design layout in src/App.tsx

**Checkpoint**: Status bar shows all three data points. Coordinates update in real-time. Clears when cursor off-texture. Zoom % matches actual zoom.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, performance, and improvements across all stories.

- [x] T031 Handle edge case: very large textures (512x512, 1024x1024) — verify canvas rendering and pan/zoom remain responsive, no frame drops during continuous brush stroke
- [x] T032 Handle edge case: transparent texture pixels — verify checkerboard pattern is visible behind transparent areas at all zoom levels
- [x] T033 Handle edge case: extreme zoom (12800% on 16x16) — verify pixel grid and rendering remain correct and stable, canvas doesn't overflow
- [x] T034 Handle viewport container resize during active zoom/pan — verify canvas re-adapts (window resize, future dock panel rearrangement) without losing current view position
- [x] T035 Run quickstart.md verification checklist — validate all 12 items pass end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — **MVP milestone**
- **US2 (Phase 4)**: Depends on US1 — zoom requires visible texture
- **US3 (Phase 5)**: Depends on US1 — pan requires visible texture. **Independent of US2**
- **US4 (Phase 6)**: Depends on US1 + US2 — grid requires zoom
- **US5 (Phase 7)**: Depends on US1 — cursor preview requires coordinate system
- **US6 (Phase 8)**: Depends on US1 + US2 + US5 — status bar reads zoom + cursor
- **Polish (Phase 9)**: Depends on all stories complete

### User Story Dependencies

```
US1 (View texture) ──┬──> US2 (Zoom) ──┬──> US4 (Pixel grid)
                     │                  │
                     ├──> US3 (Pan)     ├──> US6 (Status bar)
                     │                  │
                     └──> US5 (Cursor)──┘
```

- **US2 and US3** can run in parallel after US1
- **US4, US5** can run in parallel after their respective dependencies
- **US6** depends on US2 and US5

### Within Each User Story

- Shared utilities/store changes before component wiring
- Render logic before interaction handlers
- Unit tests alongside implementation (no TDD gating)

### Parallel Opportunities

- **Phase 1**: T002 and T003 can run in parallel (different files)
- **Phase 2**: T004 and T005 can run in parallel (different files)
- **Phase 3**: T012 and T013 can run in parallel (different test files)
- **After US1**: US2 and US3 can run in parallel (different interaction handlers)
- **After US2**: US4 and US5 can run in parallel (different overlay features)

---

## Parallel Example: After US1 MVP

```text
# US2 and US3 can launch in parallel:
Agent A: T014 → T015 → T016 → T017 (Zoom: wheel, keyboard, wiring)
Agent B: T018 → T019 → T020 (Pan: middle-click, constraints, space+drag)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T006)
3. Complete Phase 3: User Story 1 (T007-T013)
4. **STOP and VALIDATE**: Open a texture, see it pixel-perfect on canvas, verify canvas updates on draw/undo. All unit tests pass.
5. This is a demoable milestone — the canvas works.

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. US1 (View texture) → **MVP** — canvas renders pixel-perfect
3. US2 (Zoom) + US3 (Pan) → Core navigation — full editing workflow possible
4. US4 (Pixel grid) + US5 (Cursor preview) → Precision aids — pixel-level accuracy
5. US6 (Status bar) → Feedback — complete editing experience
6. Polish → Production-ready

### Single Developer Strategy (Recommended)

1. Phase 1 → Phase 2 → Phase 3 (MVP, stop and test)
2. Phase 4 → Phase 5 (sequentially, test each)
3. Phase 6 → Phase 7 → Phase 8 (sequentially, test each)
4. Phase 9 (edge cases and final validation)

---

## Notes

- **No backend changes**: This feature is 100% frontend TypeScript
- **No new npm packages**: Uses only HTML5 Canvas 2D API + existing React/Zustand
- [P] tasks = different files, no dependencies on incomplete parallel tasks
- [Story] label maps task to specific user story for traceability
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
