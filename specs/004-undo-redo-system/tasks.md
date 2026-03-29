# Tasks: Undo/Redo System (Snapshot-Based)

**Input**: Design documents from `/specs/004-undo-redo-system/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: Included — Constitution Principle IV mandates unit test coverage for all domain and use case logic.

**Organization**: Tasks grouped by user story. Backend only (domain + use_cases).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- All paths relative to `src-tauri/src/`

---

## Phase 1: Setup

**Purpose**: Extend existing domain types to support snapshot restoration

- [x] T001 Add `EmptyHistory` variant to `DomainError` in src-tauri/src/domain/error.rs
- [x] T002 [P] Add `restore_from_snapshot()` method to `Layer` (bypasses lock, replaces buffer + all properties) in src-tauri/src/domain/layer.rs
- [x] T003 [P] Add `restore_from_snapshots()` method to `LayerStack` (replaces all layers from snapshot data) in src-tauri/src/domain/layer_stack.rs

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Snapshot types and UndoManager that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Implement `LayerSnapshot` (from_layer, fields), `TextureSnapshot` (capture, restore_to), `OperationType` enum, and `UndoEntry` (new, accessors) in src-tauri/src/domain/undo.rs
- [x] T005 Implement `UndoManager` (new, push, pop_undo, push_redo, pop_redo, can_undo, can_redo, undo_count, redo_count, clear) with VecDeque undo stack, Vec redo stack, and max_depth eviction in src-tauri/src/domain/undo.rs
- [x] T006 Register `pub mod undo;` and add re-exports (`LayerSnapshot`, `TextureSnapshot`, `OperationType`, `UndoEntry`, `UndoManager`) in src-tauri/src/domain/mod.rs
- [x] T007 Unit tests for snapshot round-trip: create LayerSnapshot from Layer, restore, verify pixel-perfect equality; capture TextureSnapshot from multi-layer stack, restore, verify all layers match in src-tauri/src/domain/undo.rs
- [x] T008 Unit tests for UndoManager: push+pop_undo, push+pop_redo, max_depth eviction drops oldest, push clears redo (fork behavior), can_undo/can_redo state, clear empties both stacks, undo_count/redo_count accuracy in src-tauri/src/domain/undo.rs

**Checkpoint**: Snapshot infrastructure ready — EditorService implementation can begin

---

## Phase 3: User Story 1 — Undo a Drawing Mistake (Priority: P1) 🎯 MVP

**Goal**: Users can undo drawing operations (brush, eraser, fill, line) and the texture reverts to its exact prior state

**Independent Test**: Perform a draw operation via EditorService, call undo(), verify the texture's pixel data matches the pre-operation state exactly

### Implementation for User Story 1

- [x] T009 [US1] Implement `EditorService` struct (texture + undo_manager + pending_snapshot), `new()`, `with_max_history()`, `texture()`, `texture_mut()` in src-tauri/src/use_cases/editor_service.rs
- [x] T010 [US1] Implement `apply_tool_press()` (captures pending snapshot, delegates to tool.on_press via ToolContext), `apply_tool_drag()` (delegates to tool.on_drag), `apply_tool_release()` (delegates to tool.on_release, commits UndoEntry if PixelsModified occurred, discards pending if no modification) in src-tauri/src/use_cases/editor_service.rs
- [x] T011 [US1] Implement `undo()` (pop from undo stack, capture current state as redo entry, restore snapshot to layer stack) and `can_undo()` in src-tauri/src/use_cases/editor_service.rs
- [x] T012 [US1] Register `pub mod editor_service;` in src-tauri/src/use_cases/mod.rs
- [x] T013 [US1] Unit tests: single brush stroke + undo reverts pixels; multiple operations + sequential undo in reverse order; undo all operations back to initial state matches texture construction state; undo on empty history returns EmptyHistory error; ColorPicker tool does not create undo entry; SelectionTool does not create undo entry; undo restores exact pixel-level state in src-tauri/src/use_cases/editor_service.rs

**Checkpoint**: Drawing undo is fully functional. Users can undo brush/eraser/fill/line strokes.

---

## Phase 4: User Story 2 — Redo a Reverted Action (Priority: P2)

**Goal**: Users can redo previously undone operations, and performing a new operation after undo discards redo history

**Independent Test**: Draw, undo, redo — verify texture matches post-draw state. Then draw, undo, draw again — verify redo is unavailable.

### Implementation for User Story 2

- [x] T014 [US2] Implement `redo()` (pop from redo stack, capture current state as undo entry, restore snapshot to layer stack) and `can_redo()` in src-tauri/src/use_cases/editor_service.rs
- [x] T015 [US2] Unit tests: single undo + redo restores; multiple undo + multiple redo in order; redo on empty returns EmptyHistory error; new operation after undo clears all redo entries (fork behavior); can_undo/can_redo report correctly at all times (empty, mid-history, after fork) in src-tauri/src/use_cases/editor_service.rs

**Checkpoint**: Full undo/redo cycle works for drawing operations. Fork behavior verified.

---

## Phase 5: User Story 3 — Undo Layer Management Actions (Priority: P3)

**Goal**: Users can undo/redo layer structural changes (add, remove, reorder) and property changes (opacity, blend mode, visibility, name, locked)

**Independent Test**: Add a layer, undo — layer disappears. Change opacity, undo — opacity reverts. Each layer operation is independently undoable/redoable.

### Implementation for User Story 3

- [x] T016 [P] [US3] Implement `add_layer()` and `remove_layer()` with undo recording (snapshot before, apply mutation, push entry) in src-tauri/src/use_cases/editor_service.rs
- [x] T017 [US3] Implement `move_layer()` with undo recording in src-tauri/src/use_cases/editor_service.rs
- [x] T018 [US3] Implement `set_layer_opacity()`, `set_layer_blend_mode()`, `set_layer_visibility()`, `set_layer_name()`, `set_layer_locked()` with undo recording (each change = separate undo entry) in src-tauri/src/use_cases/editor_service.rs
- [x] T019 [US3] Unit tests: add layer + undo removes it; remove layer + undo restores it with content and properties; reorder layers + undo reverts order; each property change (opacity, blend_mode, visibility, name, locked) + undo reverts value; same property changed 3 times in succession produces 3 separate undo steps; undo bypasses layer lock; mixed draw + layer ops undo in correct order in src-tauri/src/use_cases/editor_service.rs

**Checkpoint**: All six operation types (draw, layer add/remove/reorder/property change) are undoable and redoable.

---

## Phase 6: User Story 4 — History Limit Protection (Priority: P4)

**Goal**: History is bounded at 100 entries. Oldest entries are silently evicted when the limit is exceeded.

**Independent Test**: Perform 101+ operations, verify only the last 100 are reachable via undo.

### Implementation for User Story 4

- [x] T020 [US4] Unit tests: perform 101 operations, verify undo_count is 100; verify oldest operation is unreachable; verify newest 100 operations are all undoable; verify memory stays bounded (no leak in undo/redo cycle at capacity) in src-tauri/src/use_cases/editor_service.rs

**Checkpoint**: History limit is enforced and tested. No implementation task needed — UndoManager eviction was built in Phase 2.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and edge case coverage

- [x] T021 Verify all public types from domain/undo.rs are properly re-exported in src-tauri/src/domain/mod.rs
- [x] T022 Run `cargo test` full suite from src-tauri/, verify zero regressions with existing domain tests (layer, layer_stack, pixel_buffer, tools, color, blend, selection)
- [x] T023 Run quickstart.md verification commands: `cargo test --lib domain::undo` and `cargo test --lib use_cases::editor_service`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001 for EmptyHistory, T002/T003 for restore methods)
- **US1 (Phase 3)**: Depends on Phase 2 — BLOCKS US2
- **US2 (Phase 4)**: Depends on US1 (redo requires undo to exist)
- **US3 (Phase 5)**: Depends on Phase 2. Can run in parallel with US1/US2 in theory, but shares editor_service.rs
- **US4 (Phase 6)**: Depends on Phase 2. Tests only — UndoManager eviction already implemented
- **Polish (Phase 7)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational. No other story dependencies. **MVP scope.**
- **US2 (P2)**: Depends on US1 (redo is meaningless without undo)
- **US3 (P3)**: Depends on T009 (EditorService struct from US1). Adds layer operation methods to EditorService
- **US4 (P4)**: Depends on Foundational. Tests only — validates UndoManager behavior at capacity

### Recommended Execution Order

```
Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) → Phase 6 (US4) → Phase 7 (Polish)
```

Sequential is recommended since most tasks modify the same two files (domain/undo.rs, use_cases/editor_service.rs).

### Parallel Opportunities

- **Phase 1**: T002 and T003 can run in parallel (different files: layer.rs, layer_stack.rs)
- **Phase 2**: T007 and T008 can run in parallel after T004+T005 (independent test suites in same file)
- **Phase 5**: T016-T018 are sequential (all modify editor_service.rs)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (extend DomainError, add restore methods)
2. Complete Phase 2: Foundational (snapshot types, UndoManager, tests)
3. Complete Phase 3: US1 — draw + undo
4. **STOP and VALIDATE**: `cargo test` — all undo tests pass, no regressions
5. US1 alone delivers the core safety net for texture editing

### Incremental Delivery

1. Setup + Foundational → Snapshot infrastructure ready
2. Add US1 (draw undo) → Test → **MVP delivered**
3. Add US2 (redo) → Test → Full undo/redo cycle for drawing
4. Add US3 (layer ops) → Test → Complete operation coverage
5. Add US4 (history limit) → Test → Bounded memory guarantee
6. Polish → Final validation

---

## Notes

- All tasks are backend-only (Rust). No frontend/UI tasks.
- All tests use in-memory data — no filesystem, no Tauri runtime.
- Undo restores state by wholesale snapshot replacement, bypassing layer locks (FR-010).
- Each tool press-drag-release cycle = one undo entry (not per-pixel).
- Each layer property change = one separate undo entry (no coalescing).
- History depth is hardcoded at 100 for now (configurable later).
