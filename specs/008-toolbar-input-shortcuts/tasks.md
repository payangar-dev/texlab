# Tasks: Tool Bar + Tool Input Handling + Keyboard Shortcuts

**Input**: Design documents from `/specs/008-toolbar-input-shortcuts/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/tool-commands.md, quickstart.md

**Tests**: Domain unit tests are included per constitution principle IV (Test-First for Domain). Frontend tests deferred (vitest not yet configured).

**Organization**: Tasks are grouped by user story. US1 and US4 are both P1 but separated for independent testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational — Backend Domain

**Purpose**: Domain-layer changes that all user stories depend on. Pure Rust, no external deps.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 [P] Expand BrushSize valid range from 1..=16 to 1..=32 in `src-tauri/src/domain/tools/mod.rs` — update `new()` validation, update existing tests, add test for `BrushSize::new(32)`
- [x] T002 Add `opacity: f32` field to `ToolContext` in `src-tauri/src/domain/tools/mod.rs` — clamp 0.0–1.0 at construction. Update all `ToolContext` construction sites in `src-tauri/src/use_cases/editor_service.rs` (`run_tool()`) to pass `opacity` (default 1.0 for now). **Note**: modifies same file as T001 — must run after T001.
- [x] T003 Implement per-pixel opacity blending in `BrushTool::stamp()` in `src-tauri/src/domain/tools/brush.rs` — when `ctx.opacity < 1.0`, blend brush color with existing pixel (`result = existing * (1-opacity) + brush * opacity`). Add unit tests: opacity 1.0 = overwrite, opacity 0.5 = blend, opacity 0.0 = no-op. **Depends on T002** (reads `ctx.opacity`).
- [x] T004 [P] Add brush-size stamp support to `LineTool::on_release()` in `src-tauri/src/domain/tools/line.rs` — for each Bresenham point, stamp a `brush_size × brush_size` square centered on the point (matching BrushTool pattern). Apply `ctx.opacity` blending the same way as BrushTool. Add unit test: line with brush_size=3 produces wider line.
- [x] T005 [P] Add `pick_color_composite(x: u32, y: u32) -> Result<Color, DomainError>` to `EditorService` in `src-tauri/src/use_cases/editor_service.rs` — calls `self.texture.composite()`, reads pixel at (x,y). Add unit test with 2-layer texture verifying composite color is returned

**Checkpoint**: All domain logic is implemented and tested. `cargo test` passes.

**Parallelization**: T001, T004, T005 can run in parallel (different files). T002 must follow T001 (same file). T003 must follow T002 (dependency). T004 applies opacity independently — if implementing after T002, use `ctx.opacity`; otherwise defer opacity to integration.

---

## Phase 2: Foundational — Commands + Frontend Store/API

**Purpose**: Bridge layer between domain changes and UI. Backend command params + frontend state/API updates.

- [x] T006 Update `tool_press`, `tool_drag`, `tool_release` commands in `src-tauri/src/commands/tool_commands.rs` — add `opacity: f32` parameter to all three, add `pipette_mode: String` to `tool_press` only. In `tool_press`: when `tool == "color_picker"` and `pipette_mode == "composite"`, call `editor.pick_color_composite(x, y)` instead of tool's `on_press()`. Update `run_tool()` call to pass opacity.
- [x] T007 [P] Expand `ToolType` union, add `secondaryColor`, `opacity`, `pipetteMode`, `swapColors()` in `src/store/toolStore.ts` — rename `"rectangle"` → `"selection"`, add `"move"` | `"zoom"`. Add `secondaryColor: ColorDto` (default white), `opacity: number` (default 100, range 0–100), `pipetteMode: "composite" | "active_layer"` (default `"composite"`), `swapColors()` action, `setOpacity()` action, `setPipetteMode()` action
- [x] T008 [P] Update invoke wrappers in `src/api/commands.ts` — add `opacity: number` param to `toolPress`, `toolDrag`, `toolRelease`. Add `pipetteMode: string` param to `toolPress`. Update invoke payloads with snake_case keys matching Rust command params
- [x] T009 [P] Add `bresenhamLine(x0, y0, x1, y1): Array<{x, y}>` utility to `src/components/canvas/math.ts` — TypeScript port of the Rust `bresenham_line()` algorithm for frontend line preview rendering

**Checkpoint**: Backend compiles with new params. Frontend store and API are updated. `cargo test` passes.

---

## Phase 3: User Story 1 — Select and Use Drawing Tools (Priority: P1) 🎯 MVP

**Goal**: All 8 tools appear in the toolbar, are selectable, and invoke the correct drawing behavior on the canvas. Pipette returns picked color to the frontend.

**Independent Test**: Open a texture, click each tool in the toolbar — it highlights. Draw with Brush, erase with Eraser, fill with Fill, pick color with Pipette. Move/Zoom are selectable but have no canvas effect. Cursor changes per tool.

- [x] T010 [P] [US1] Update `ToolsSidebar` in `src/components/shell/ToolsSidebar.tsx` — rename `"rectangle"` → `"selection"` in TOOLS array, add `"move"` (lucide `Move` icon) and `"zoom"` (lucide `ZoomIn` icon) entries. Update imports.
- [x] T011 [P] [US1] Add disabled state to `ToolsSidebar` in `src/components/shell/ToolsSidebar.tsx` — when `editorStore.texture` is null, disable all tool buttons (not just undo/redo). Tools should be visually dimmed and non-interactive (reuse existing disabled styling on ToolButton).
- [x] T012 [US1] Handle non-drawing tools and tool results in `src/components/canvas/useViewportControls.ts` — skip `toolPress` call when `activeToolType` is `"move"` or `"zoom"`. In `handleToolResult()`: handle `"color_picked"` by calling `toolStore.setActiveColor(result.pickedColor)`. Pass `opacity / 100` and `pipetteMode` from toolStore to `toolPress`/`toolDrag`/`toolRelease` calls.
- [x] T013 [US1] Add per-tool cursor styling in `src/components/canvas/useViewportControls.ts` — update the `updateCursor()` function to map `activeToolType` to a CSS cursor: `"brush"/"eraser"/"line"/"fill"` → `crosshair`, `"eyedropper"` → `crosshair` (or `copy`), `"selection"` → `crosshair`, `"move"` → `move`, `"zoom"` → `zoom-in`. Preserve existing `grab`/`grabbing` for pan mode.

**Checkpoint**: All 8 tools appear in toolbar. Drawing tools work on canvas. Pipette picks color (composite by default). Move/Zoom are no-ops with appropriate cursors. Tools disabled when no texture. **Note**: US1 acceptance scenario 6 (Pipette "active layer" mode) is fully testable only after US3 delivers the sampling mode toggle in the options bar. The backend supports both modes from Phase 2.

---

## Phase 4: User Story 4 — Mouse Input and Continuous Drawing (Priority: P1)

**Goal**: Smooth, gap-free strokes with rAF throttling. Shift+Click draws straight lines from last stroke endpoint. Mid-stroke tool switch finalizes the stroke.

**Independent Test**: Draw a fast diagonal with Brush — no pixel gaps. Draw a point, then Shift+Click elsewhere — straight line appears. Switch tool mid-drag — stroke finalizes cleanly.

- [x] T014 [US4] Implement rAF-gated throttle for `toolDrag` in `src/components/canvas/useViewportControls.ts` — add `pendingDragRef` and `dragRafRef` refs. On pointermove in tool mode: store latest pixel in `pendingDragRef`, schedule rAF if not already scheduled. In rAF callback: call `toolDrag` with pending pixel, clear ref. On pointerup: flush any pending drag before calling `toolRelease`.
- [x] T015 [US4] Implement Shift+Click straight line in `src/components/canvas/useViewportControls.ts` — add `lastStrokeEndPointRef` (set on tool release to final pixel). On pointerdown with `e.shiftKey` and `lastStrokeEndPointRef` is set: call `toolPress(lastPoint)` → `toolDrag(clickedPoint)` → `toolRelease(clickedPoint)` sequentially. If no last point, fall through to normal press.
- [x] T016 [US4] Implement mid-stroke tool switch finalization — in `ToolsSidebar.tsx` onClick handler: if `interactionModeRef.current === "tool"`, call `toolRelease` with last known cursor position before `setActiveToolType`. Requires passing `interactionModeRef` and release-triggering callback through context or props. Same logic needed in keyboard shortcut tool switching (US2).

**Checkpoint**: Strokes are smooth at high-speed drawing. Shift+Click produces straight lines. Tool switching mid-stroke is safe.

---

## Phase 5: User Story 2 — Keyboard Shortcuts for Fast Tool Switching (Priority: P2)

**Goal**: Single-key shortcuts switch tools instantly. `[`/`]` adjust brush size. `X` swaps colors. Shortcuts suppressed in text inputs.

**Independent Test**: Press B, E, G, I, L, M, V, Z — toolbar highlights the correct tool each time. Press `]` 5 times — brush size increases by 5. Press X — colors swap. Click in a text field and press B — no tool switch.

**Depends on**: T016 (mid-stroke finalization logic from US4) — keyboard shortcut tool switching must reuse the same finalization mechanism.

- [x] T017 [US2] Add shortcut suppression guard and tool selection shortcuts in `src/hooks/useKeyboardShortcuts.ts` — add `shouldSuppressShortcut(e)` check (return true if target is INPUT/TEXTAREA/contentEditable or inside `dialog[open]`). Add single-key handler (no Ctrl/Meta): B→brush, E→eraser, G→fill, I→eyedropper, L→line, M→selection, V→move, Z→zoom. Call `toolStore.setActiveToolType()`. Integrate mid-stroke finalization from T016 before switching.
- [x] T018 [US2] Add `[`/`]` brush size and `X` color swap shortcuts in `src/hooks/useKeyboardShortcuts.ts` — `[` decreases `brushSize` by 1 (min 1), `]` increases by 1 (max 32). `X` calls `toolStore.swapColors()`. All gated by `shouldSuppressShortcut()`.

**Checkpoint**: All 8 tool shortcuts work. Brush size adjustable via keyboard. Color swap works. No false activations in text fields.

---

## Phase 6: User Story 5 — Line Tool for Straight Lines (Priority: P2)

**Goal**: Line tool shows a live preview while dragging and draws lines with the current brush size.

**Independent Test**: Select Line tool, click and drag — preview line appears following cursor. Release — line is drawn on canvas. Set brush size to 3, draw a line — it's 3px wide.

- [x] T019 [US5] Add `linePreviewRef` to `CanvasRendererApi` and set/clear it on Line tool interactions in `src/components/canvas/useCanvasRenderer.ts` and `src/components/canvas/useViewportControls.ts` — add `linePreviewRef: RefObject<{startX: number, startY: number} | null>` to CanvasRendererApi. In useViewportControls: on pointerDown when tool is "line", set `linePreviewRef.current = {startX: pixel.x, startY: pixel.y}`. On pointerUp/release, set `linePreviewRef.current = null`.
- [x] T020 [US5] Render line preview overlay in `src/components/canvas/useCanvasRenderer.ts` — in the render loop, after cursor preview: if `linePreviewRef.current` and `cursorPixelRef.current` are both set, compute Bresenham points using `bresenhamLine()` from math.ts, draw semi-transparent filled pixels (respecting `brushSizeRef`) at each point in texture space. Use `rgba(255, 255, 255, 0.3)` fill color.

**Checkpoint**: Line tool shows live preview during drag. Lines respect brush size.

---

## Phase 7: User Story 3 — Tool Options Bar (Priority: P3)

**Goal**: A contextual options bar displays relevant controls for the active tool. Brush shows size + opacity, Eraser shows size, Pipette shows sampling mode toggle.

**Independent Test**: Select Brush — options bar shows size and opacity controls. Change opacity to 50% — subsequent strokes are semi-transparent. Select Pipette — toggle between composite and active layer modes.

- [x] T021 [US3] Create `ToolOptionsBar` component in `src/components/shell/ToolOptionsBar.tsx` — horizontal bar below title bar. Reads `activeToolType` from toolStore. Per-tool content: **Brush**: numeric input for size (1–32) + numeric input for opacity (0–100%). **Eraser**: numeric input for size (1–32). **Pipette/Eyedropper**: toggle button for composite/active-layer mode. **Line**: numeric input for size (1–32). **Fill/Selection/Move/Zoom**: empty or label only. Style: dark background matching titlebar, 32px height, controls aligned left with 8px gap.
- [x] T022 [US3] Integrate `ToolOptionsBar` in `src/components/shell/AppShell.tsx` — add between `<TitleBar>` and the main flex row. Render conditionally (always visible, content changes based on tool).

**Checkpoint**: Options bar updates on tool switch. Brush size and opacity controls work. Pipette mode toggle switches between composite and active layer sampling. **This completes US1 acceptance scenario 6** (Pipette active layer mode now accessible via toggle).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verify edge cases, ensure all acceptance criteria are met.

- [x] T023 Verify edge cases from spec — test: mid-stroke tool switch finalizes correctly, no-texture disabled state, shortcut suppression in modals, brush size clamp at 1 and 32, Shift+Click with no previous point, right-click produces no action
- [x] T024 Run `cargo test` across all backend changes and fix any failures

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Foundational Backend ──→ Phase 2: Commands + Store/API ──→ All User Stories
                                                                    ├── Phase 3: US1 (P1) 🎯 MVP
                                                                    ├── Phase 4: US4 (P1)
                                                                    │     └── T016 ──→ Phase 5: US2 (P2)
                                                                    ├── Phase 6: US5 (P2)
                                                                    └── Phase 7: US3 (P3)
                                                                          └── Phase 8: Polish
```

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2. No other story deps. **MVP target.** US1 acceptance scenario 6 (Pipette active-layer) fully testable after US3.
- **US4 (P1)**: Depends on Phase 2. Benefits from US1 (toolbar disabled state) but testable independently.
- **US2 (P2)**: Depends on Phase 2 **+ T016** (mid-stroke finalization from US4). Keyboard shortcut tool switching reuses the same finalization logic.
- **US5 (P2)**: Depends on Phase 2 (bresenhamLine in math.ts). Independent of other stories.
- **US3 (P3)**: Depends on Phase 2 (toolStore with opacity/pipetteMode). Independent but delivers most value after US1+US2. Completes US1-6 coverage.

### Within Each Phase

- Tasks marked [P] within a phase can run in parallel
- Non-[P] tasks must run in listed order within their phase
- All tasks in a phase complete before next phase begins

### Parallel Opportunities

Within Phase 1:
- T001, T004, T005 — different files, fully parallel
- T002 must follow T001 (same file: mod.rs)
- T003 must follow T002 (depends on opacity field)

Within Phase 2:
- T007, T008, T009 — different frontend files, fully parallel
- T006 depends on Phase 1 completion

Within Phase 3 (US1):
- T010, T011 — both modify ToolsSidebar.tsx but different sections, nearly parallel
- T012, T013 depend on T007/T008 (updated API)

---

## Parallel Example: Phase 1

```
# Three tasks can run simultaneously:
T001: "Expand BrushSize range in domain/tools/mod.rs"
T004: "Brush-size stamps in domain/tools/line.rs"
T005: "pick_color_composite() in use_cases/editor_service.rs"

# Then sequentially:
T002: "Add opacity to ToolContext in domain/tools/mod.rs" (after T001)
T003: "Opacity blending in domain/tools/brush.rs" (after T002)
```

## Parallel Example: User Stories After Phase 2

```
# After Phase 2, these stories can start in parallel:
US1: "Toolbar updates in ToolsSidebar.tsx + useViewportControls.ts"
US4: "Mouse input in useViewportControls.ts"
US5: "Line preview in useCanvasRenderer.ts"
US3: "Options bar in new ToolOptionsBar.tsx"

# US2 must wait for US4's T016 (mid-stroke finalization):
US2: "Shortcuts in useKeyboardShortcuts.ts" (after T016)
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Foundational Backend
2. Complete Phase 2: Commands + Store/API
3. Complete Phase 3: US1 — Toolbar + Basic Tool Usage
4. **STOP and VALIDATE**: All 8 tools selectable, drawing tools functional, Pipette works
5. This is a usable editor increment

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. + US1 → Toolbar complete, basic drawing works (**MVP**)
3. + US4 → Smooth input, Shift+Click, throttle
4. + US2 → Keyboard shortcuts for fast workflow (after US4 T016)
5. + US5 → Line tool with preview
6. + US3 → Options bar for fine control (completes Pipette mode toggle)
7. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Domain tests required per constitution (principle IV)
- Frontend tests deferred — vitest not yet configured
- Brush opacity = simple per-pixel blend (not per-stroke mask) — see research.md R1
- Move/Zoom tools are placeholders — full behavior scoped to future features
