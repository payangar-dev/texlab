# Tasks: Tool System — Brush, Eraser, Fill, ColorPicker, Line, Selection

**Input**: Design documents from `/specs/003-tool-system/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Required — SC-005 mandates comprehensive automated tests for all tools. Constitution Principle IV (Test-First for Domain) applies.

**Organization**: Tasks grouped by user story. Each story produces an independently testable tool.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Create directory structure and register new modules so the project compiles throughout development.

- [x] T001 Create `src-tauri/src/domain/tools/` directory with empty module files (`mod.rs`, `brush.rs`, `eraser.rs`, `fill.rs`, `color_picker.rs`, `line.rs`, `selection_tool.rs`), create empty `src-tauri/src/domain/selection.rs`, and register all new modules in `src-tauri/src/domain/mod.rs` (`pub mod selection`, `pub mod tools` + re-exports for `Selection`, `BrushSize`, tool types)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types and infrastructure that ALL tool implementations depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Add `InvalidBrushSize { size: u8 }` variant to `DomainError` enum in `src-tauri/src/domain/error.rs` — add `Display` match arm ("Invalid brush size: {size}, must be 1..=16") and keep derives intact
- [x] T003 [P] Implement `Selection` value object in `src-tauri/src/domain/selection.rs` — fields: `left`, `top`, `right`, `bottom` (all `u32`, private). Constructor `new(x1, y1, x2, y2)` normalizes to min/max. Methods: `left()`, `top()`, `right()`, `bottom()`, `width()`, `height()`, `contains(x, y)`, `clip(canvas_width, canvas_height) -> Option<Self>`. Derives: `Clone, Copy, Debug, PartialEq, Eq`. Unit tests: normalization, accessors, contains, clip fully inside, clip partial, clip fully outside returns None, zero-area selection
- [x] T004 [P] Add `buffer_mut(&mut self) -> Result<&mut PixelBuffer, DomainError>` method to `Layer` in `src-tauri/src/domain/layer.rs` — returns `LayerLocked` error if `self.locked` is true, otherwise returns `&mut self.buffer`. Unit tests: unlocked returns Ok, locked returns Err(LayerLocked), mutation through returned reference works, locked layer blocks tool usage pattern (create ToolContext from buffer_mut on locked layer → Err before any tool code runs, covering FR-010/SC-004)
- [x] T005 Implement core tool infrastructure in `src-tauri/src/domain/tools/mod.rs`: (1) `BrushSize` value object — newtype over `u8`, `new(size) -> Result`, `value() -> u8`, `DEFAULT = 1`, derives `Clone, Copy, Debug, PartialEq, Eq`; (2) `ToolContext<'a>` struct — `buffer: &'a mut PixelBuffer`, `color: Color`, `brush_size: BrushSize`; (3) `ToolResult` enum — `PixelsModified`, `ColorPicked(Color)`, `SelectionChanged(Option<Selection>)`, `NoOp`, derives `Clone, Debug, PartialEq`; (4) `Tool` trait — `name() -> &str`, `on_press(&mut self, ctx, x, y)`, `on_drag(&mut self, ctx, x, y)`, `on_release(&mut self, ctx, x, y)` all returning `Result<ToolResult, DomainError>`; (5) `pub fn bresenham_line(x0: i32, y0: i32, x1: i32, y1: i32) -> Vec<(i32, i32)>` — all-octant Bresenham, inclusive of both endpoints; (6) Declare submodules (`pub mod brush`, etc.) and re-export tool structs. Unit tests for `BrushSize` (valid 1, valid 16, invalid 0, invalid 17) and `bresenham_line` (horizontal, vertical, diagonal, single point, steep slope, all points connected)

**Checkpoint**: Foundation ready — `cargo test --lib domain` passes. All tool implementations can now begin.

---

## Phase 3: User Story 1 — Paint pixels with a brush (Priority: P1) 🎯 MVP

**Goal**: Users can paint pixels on the active layer with a configurable square brush (1–16px).

**Independent Test**: Create a PixelBuffer, create a BrushTool, call on_press/on_drag/on_release — painted pixels appear at correct coordinates with correct color.

- [x] T006 [US1] Implement `BrushTool` with comprehensive tests in `src-tauri/src/domain/tools/brush.rs` — struct with `last_pos: Option<(u32, u32)>`, implements `Default` (name: "Brush"). `on_press`: stamp N×N square at (x,y) using `fill_rect`, store position, return `PixelsModified`. `on_drag`: interpolate from `last_pos` to (x,y) via `bresenham_line`, stamp at each interpolated point, update `last_pos`, return `PixelsModified`. `on_release`: return `NoOp`. Unit tests covering: (AC1) single pixel at correct coordinates with 1px brush, (AC2) continuous drag path with no gaps — verify all pixels along path are painted (SC-002), (AC3) N×N square with sizes 2/4/8/16 — top-left anchoring, (AC5) stroke extending beyond canvas is silently clipped, edge case: fast diagonal drag produces gap-free stroke via interpolation

**Checkpoint**: Brush tool fully functional — `cargo test --lib domain::tools::brush` passes.

---

## Phase 4: User Story 2 — Erase pixels (Priority: P1)

**Goal**: Users can erase pixels on the active layer, setting them to fully transparent.

**Independent Test**: Paint pixels, create EraserTool, erase them — erased pixels become fully transparent (alpha = 0).

- [x] T007 [P] [US2] Implement `EraserTool` with comprehensive tests in `src-tauri/src/domain/tools/eraser.rs` — struct with `last_pos: Option<(u32, u32)>`, implements `Default` (name: "Eraser"). Identical behavior to BrushTool but always uses `Color::TRANSPARENT` regardless of `ctx.color`. Unit tests covering: (AC1) erased pixel is fully transparent (r=0, g=0, b=0, a=0), (AC2) N×N square erased with top-left anchoring, (AC3) continuous drag erase with no gaps, edge case: erasing already-transparent pixels is harmless

**Checkpoint**: Eraser tool fully functional — `cargo test --lib domain::tools::eraser` passes.

---

## Phase 5: User Story 3 — Fill a contiguous area with color (Priority: P2)

**Goal**: Users can flood-fill a contiguous same-color region with the selected color.

**Independent Test**: Create a solid-colored rectangle in a PixelBuffer, fill it with a new color — the entire rectangle changes.

- [x] T008 [P] [US3] Implement `FillTool` with comprehensive tests in `src-tauri/src/domain/tools/fill.rs` — stateless struct (no fields), implements `Default` (name: "Fill"). `on_press`: check bounds first — if (x,y) out of canvas return `NoOp` (FR-011 silent clip), then read target pixel color, short-circuit if same as fill color (return `NoOp` per FR-012), otherwise BFS flood fill using `VecDeque` from `std::collections` with `Vec<bool>` visited bitmap, 4-directional connectivity (up/down/left/right), return `PixelsModified`. `on_drag`/`on_release`: return `NoOp`. Unit tests covering: (AC1) fill contiguous region replaces all connected pixels, (AC2) isolated single pixel only changes that pixel, (AC3) no-op when clicking on pixel already matching fill color, (AC4) fill 64×64 solid area completes successfully (SC-003), (AC5) fill stops at canvas boundaries — no wrap-around, edge case: fill region surrounded by different-colored border, edge case: fill on out-of-bounds coordinate returns NoOp (FR-011)

**Checkpoint**: Fill tool fully functional — `cargo test --lib domain::tools::fill` passes.

---

## Phase 6: User Story 4 — Pick a color from the canvas (Priority: P2)

**Goal**: Users can sample a pixel's color from the canvas to set it as the active color.

**Independent Test**: Paint a pixel of known color, use ColorPickerTool on it — returned color matches.

- [x] T009 [P] [US4] Implement `ColorPickerTool` with comprehensive tests in `src-tauri/src/domain/tools/color_picker.rs` — stateless struct (no fields), implements `Default` (name: "Color Picker"). `on_press`: check bounds first — if (x,y) out of canvas return `NoOp` (FR-011 silent clip), otherwise call `buffer.get_pixel(x, y)` and return `ColorPicked(color)`. `on_drag`/`on_release`: return `NoOp`. Unit tests covering: (AC1) picks correct RGBA color from opaque pixel, (AC2) picks fully transparent color (r=0, g=0, b=0, a=0), edge case: out-of-bounds returns NoOp (FR-011)

**Checkpoint**: Color picker tool fully functional — `cargo test --lib domain::tools::color_picker` passes.

---

## Phase 7: User Story 5 — Draw straight lines (Priority: P2)

**Goal**: Users can draw pixel-perfect straight lines between two points.

**Independent Test**: Click at point A, release at point B — a straight line connects the two points.

- [x] T010 [P] [US5] Implement `LineTool` with comprehensive tests in `src-tauri/src/domain/tools/line.rs` — struct with `start_pos: Option<(u32, u32)>`, implements `Default` (name: "Line"). `on_press`: store start position, return `NoOp`. `on_drag`: return `NoOp` (no preview in this feature). `on_release`: draw Bresenham line from `start_pos` to (x,y) using `bresenham_line`, set each pixel via `set_pixel` with clipping (skip out-of-bounds points), return `PixelsModified`. Unit tests covering: (AC1) line from (0,0) to (5,5) draws correct pixels with correct color, (AC2) horizontal line from (0,5) to (10,5) produces exactly 11 pixels (SC-006), (AC3) diagonal line has no gaps, (AC4) same start and end produces single pixel, (AC5) line partially outside canvas only draws in-bounds pixels, edge case: vertical line exact pixel count

**Checkpoint**: Line tool fully functional — `cargo test --lib domain::tools::line` passes.

---

## Phase 8: User Story 6 — Select a rectangular region (Priority: P3)

**Goal**: Users can define a rectangular selection region on the canvas.

**Independent Test**: Drag from point A to point B — selection bounds are correctly computed and queryable.

- [x] T011 [P] [US6] Implement `SelectionTool` with comprehensive tests in `src-tauri/src/domain/tools/selection_tool.rs` — struct with `start_pos: Option<(u32, u32)>`, implements `Default` (name: "Selection"). `on_press`: store start position, return `NoOp`. `on_drag`: compute `Selection::new(start, current)`, clip to canvas via `Selection::clip(buffer.width(), buffer.height())`, return `SelectionChanged(clipped)`. `on_release`: if start == release position return `SelectionChanged(None)` to clear selection (FR-014), otherwise compute and clip selection, return `SelectionChanged(Some(sel))` — new selection replaces previous (FR-013 handled by caller). Unit tests covering: (AC1) drag creates normalized selection with correct bounds, (AC2) creating new selection replaces previous (verified by caller pattern), (AC3) click without drag clears selection (returns None), (AC4) selection clipped to canvas dimensions, edge case: reverse-direction drag (bottom-right to top-left) normalizes correctly

**Checkpoint**: Selection tool fully functional — `cargo test --lib domain::tools::selection_tool` passes.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all tools.

- [x] T012 Run full domain test suite `cargo test --lib domain` — verify all tools, selection, and existing domain tests pass together without regressions
- [x] T013 Verify domain purity: confirm no `use` statements in `domain/tools/` or `domain/selection.rs` reference external crates (`tauri`, `serde`, `image`) and no `Serialize`/`Deserialize` derives exist on new types

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately
- **Foundational (Phase 2)**: Depends on Phase 1. T002, T003, T004 are parallel. T005 depends on T002 (InvalidBrushSize) and T003 (Selection for ToolResult). **BLOCKS all user stories.**
- **User Stories (Phases 3–8)**: All depend on Phase 2 completion. After Phase 2, all stories can proceed in parallel (each tool is in its own file with no cross-dependencies).
- **Polish (Phase 9)**: Depends on all user stories complete.

### User Story Dependencies

- **US1 — Brush (P1)**: Phase 2 only. No dependencies on other stories. 🎯 MVP
- **US2 — Eraser (P1)**: Phase 2 only. No dependencies on other stories. Parallel with US1.
- **US3 — Fill (P2)**: Phase 2 only. No dependencies on other stories. Parallel with US1/US2.
- **US4 — Color Picker (P2)**: Phase 2 only. No dependencies on other stories. Parallel with all.
- **US5 — Line (P2)**: Phase 2 only. No dependencies on other stories. Parallel with all.
- **US6 — Selection (P3)**: Phase 2 only (uses `Selection` from Phase 2). Parallel with all.

### Within Each User Story

- Single task per story (implementation + tests in same file, Rust convention)
- Tests validate all acceptance scenarios from spec.md
- Story complete when `cargo test --lib domain::tools::{tool_name}` passes

### Parallel Opportunities

After Phase 2 completes, **all 6 tools (T006–T011) can be implemented in parallel** — they are in separate files with no cross-dependencies:

```
T006 [US1] brush.rs       ─┐
T007 [US2] eraser.rs      ─┤
T008 [US3] fill.rs        ─┼─ All parallel after Phase 2
T009 [US4] color_picker.rs─┤
T010 [US5] line.rs        ─┤
T011 [US6] selection_tool.rs─┘
```

---

## Parallel Example: Phase 2 Foundational

```bash
# These 3 tasks can run in parallel (different files):
Task T002: "Add InvalidBrushSize to DomainError in domain/error.rs"
Task T003: "Implement Selection value object in domain/selection.rs"
Task T004: "Add buffer_mut() to Layer in domain/layer.rs"

# Then T005 (depends on T002 + T003):
Task T005: "Implement core tool types in domain/tools/mod.rs"
```

## Parallel Example: All User Stories

```bash
# After Phase 2, launch ALL tool implementations in parallel:
Task T006: "BrushTool in domain/tools/brush.rs"
Task T007: "EraserTool in domain/tools/eraser.rs"
Task T008: "FillTool in domain/tools/fill.rs"
Task T009: "ColorPickerTool in domain/tools/color_picker.rs"
Task T010: "LineTool in domain/tools/line.rs"
Task T011: "SelectionTool in domain/tools/selection_tool.rs"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T005)
3. Complete Phase 3: User Story 1 — Brush (T006)
4. **STOP and VALIDATE**: `cargo test --lib domain::tools::brush` passes
5. Brush tool is usable — core painting capability delivered

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add Brush (US1) → Test → MVP delivered ✅
3. Add Eraser (US2) → Test → Paint + erase ✅
4. Add Fill, ColorPicker, Line (US3–5) → Test → Full painting toolkit ✅
5. Add Selection (US6) → Test → Region operations ready ✅
6. Polish (Phase 9) → Final validation ✅

### Parallel Execution Strategy

All 6 tool implementations are independent (separate files, no cross-dependencies). After Phase 2:

1. Launch all 6 tool agents in parallel
2. Each produces a self-contained file with implementation + tests
3. Merge results, run full test suite
4. Fix any integration issues in Phase 9

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Every tool file includes `#[cfg(test)] mod tests` with comprehensive coverage (SC-005)
- All code is pure domain — `std` only, no external crates
- `bresenham_line` is the only shared utility (used by Brush, Eraser, Line)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
