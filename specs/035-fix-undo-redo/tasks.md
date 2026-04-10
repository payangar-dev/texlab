# Tasks: Fix Undo/Redo System

**Input**: Design documents from `/specs/035-fix-undo-redo/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/tauri-ipc.md, quickstart.md

**Tests**: Included — Constitution Principle IV mandates test-first for domain logic, and spec defines explicit acceptance scenarios.

**Organization**: Tasks grouped by user story. US1+US2 are combined (same code path, both P1).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in all descriptions

---

## Phase 1: Setup

**Purpose**: No project scaffolding needed — project already exists. Verify baseline.

- [ ] T001 Run `cargo test` in `src-tauri/` to confirm all existing tests pass before changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: New domain types and restore infrastructure that ALL user stories depend on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 Add `PropertyChange` enum (Opacity, BlendMode, Visibility, Name, Locked) in `src-tauri/src/domain/undo.rs`
- [ ] T003 Add `UndoPayload` enum (SingleLayer, FullStack, Property) in `src-tauri/src/domain/undo.rs`
- [ ] T004 Update `UndoEntry` to store `UndoPayload` instead of `TextureSnapshot` — update `new()`, `into_parts()`, accessor methods in `src-tauri/src/domain/undo.rs`
- [ ] T005 [P] Add `restore_single_layer(LayerSnapshot)` method to `LayerStack` that restores a single layer by ID without replacing the entire stack, in `src-tauri/src/domain/layer_stack.rs`
- [ ] T006 [P] Add `read_property(layer_id, &PropertyChange) -> PropertyChange` and `apply_property(layer_id, PropertyChange)` helper methods on `EditorService` for symmetric property capture/restore in `src-tauri/src/use_cases/editor_service.rs`
- [ ] T007 Add `pending_draw_layer_id: Option<LayerId>` field to `EditorService` struct, initialize to `None` in constructors, in `src-tauri/src/use_cases/editor_service.rs`
- [ ] T008 Rewrite `apply_history_swap` to match on `UndoPayload` variant — SingleLayer: capture/restore single layer; FullStack: capture/restore all layers (existing behavior); Property: read/set property value — in `src-tauri/src/use_cases/editor_service.rs`
- [ ] T009 Update existing `UndoManager` tests in `src-tauri/src/domain/undo.rs` to use `UndoEntry::new(op, UndoPayload::FullStack(...))` instead of `UndoEntry::new(op, TextureSnapshot)`
- [ ] T010 [P] Add unit tests for `LayerStack::restore_single_layer` — restore preserves other layers, error on unknown ID — in `src-tauri/src/domain/layer_stack.rs`

**Checkpoint**: New types compile. `apply_history_swap` handles all 3 payload variants. All existing tests updated and passing.

---

## Phase 3: User Story 1 + User Story 2 — Undo Individual & Rapid Strokes (Priority: P1) MVP

**Goal**: Each completed paint stroke (press, drag, release) produces exactly one independently undoable entry using a `SingleLayer` payload. Rapid successive strokes (< 500ms apart) create separate entries.

**Independent Test**: Draw three separate strokes. Press Ctrl+Z three times. Each press removes exactly one stroke. Then draw 4 strokes rapidly (< 500ms apart). Press Ctrl+Z four times. Each press removes one stroke.

### Tests

- [ ] T011 [US1] Add unit test: single brush stroke produces `UndoPayload::SingleLayer` entry (not FullStack) in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T012 [US1] Add unit test: undo single stroke restores pixels to pre-stroke state in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T013 [US1] Add unit test: three strokes → three undos → each reverts one stroke in reverse order in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T014 [US2] Add unit test: multiple back-to-back strokes (no delay) produce separate undo entries in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T015 [US1] Add unit test: undo on empty history returns `DomainError::EmptyHistory` (existing test, verify still passes) in `src-tauri/src/use_cases/editor_service.rs` tests

### Implementation

- [ ] T016 [US1] Update `apply_tool_press` to set `pending_draw_layer_id = Some(layer_id)` in `src-tauri/src/use_cases/editor_service.rs`
- [ ] T017 [US1] Update `apply_tool_release` to extract the affected layer from `pending_snapshot` as `UndoPayload::SingleLayer(layer_snapshot)` using `pending_draw_layer_id`, then push to undo manager, in `src-tauri/src/use_cases/editor_service.rs`
- [ ] T018 [US1] Clear `pending_draw_layer_id` in `apply_tool_release` (both success and no-modification paths) in `src-tauri/src/use_cases/editor_service.rs`
- [ ] T019 [US1] Verify all existing `editor_service` stroke tests pass with the new SingleLayer payload — fix any assertion that inspects snapshot internals in `src-tauri/src/use_cases/editor_service.rs` tests

**Checkpoint**: All stroke-level undo tests pass. Each stroke produces a SingleLayer payload. Rapid strokes produce separate entries.

---

## Phase 4: User Story 3 — Undo During Active Stroke (Priority: P2)

**Goal**: Pressing Ctrl+Z mid-stroke (mouse held down) finalizes the in-progress stroke as a complete undo entry, then undoes it (effectively cancelling the stroke). The cancelled stroke is redoable via Ctrl+Y.

**Independent Test**: Draw one stroke. Start a second stroke. While holding mouse, press Ctrl+Z. The second stroke is cleanly cancelled and the canvas shows only the first stroke. Press Ctrl+Y — the second stroke reappears.

### Tests

- [ ] T020 [US3] Add unit test: undo during active stroke with pixels modified — finalizes as entry then undoes it, canvas returns to pre-stroke state — in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T021 [US3] Add unit test: undo during active stroke with NO pixels modified — discards pending, undoes previous action — in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T022 [US3] Add unit test: redo after mid-stroke undo restores the cancelled stroke — in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T023 [US3] Add unit test: subsequent undo/redo operations remain consistent after mid-stroke undo — in `src-tauri/src/use_cases/editor_service.rs` tests

### Implementation

- [ ] T024 [US3] Add mid-stroke finalization logic at the start of `EditorService::undo()` — if `pending_snapshot.is_some()`, finalize the stroke (push SingleLayer entry if pixels modified, clear pending state), then proceed with normal undo — in `src-tauri/src/use_cases/editor_service.rs`
- [ ] T025 [US3] In `undo` command in `src-tauri/src/commands/history_commands.rs`, after undo completes, check if `active_tool` exists and clear it (`state.active_tool = None`) to signal stroke cancellation

**Checkpoint**: Mid-stroke undo works correctly. Tool state is cleaned up. Redo after mid-stroke undo restores the stroke.

---

## Phase 5: User Story 4 — Undo Layer Operations Individually (Priority: P2)

**Goal**: Each layer operation (add, remove, reorder, rename, visibility, blend mode, opacity, locked) creates a separate undo entry. Property changes use `UndoPayload::Property` (metadata only, no pixel data). Structural changes (add, remove, reorder) use `UndoPayload::FullStack`.

**Independent Test**: Add a layer, rename it, change blend mode. Ctrl+Z three times: first reverts blend mode, then name, then removes the layer.

### Tests

- [ ] T026 [P] [US4] Add unit tests for each layer property: set_opacity, set_blend_mode, set_visibility, set_name, set_locked each produce `UndoPayload::Property` with the correct old value — in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T027 [P] [US4] Add unit tests: add_layer and remove_layer produce `UndoPayload::FullStack` — in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T028 [US4] Add unit test: undo layer rename reverts name, undo layer opacity reverts value, undo layer add removes the layer — in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T029 [US4] Add unit test: mixed draw + layer operations undo in correct reverse order — in `src-tauri/src/use_cases/editor_service.rs` tests

### Implementation

- [ ] T030 [US4] Update `with_layer_undo` to capture `PropertyChange` from the layer's current state before mutation and push `UndoPayload::Property { layer_id, change }` in `src-tauri/src/use_cases/editor_service.rs`
- [ ] T031 [US4] Update `add_layer`, `add_layer_above`, `duplicate_layer`, `remove_layer`, `move_layer` to push `UndoPayload::FullStack(TextureSnapshot::capture(...))` explicitly in `src-tauri/src/use_cases/editor_service.rs`
- [ ] T032 [US4] Update existing layer operation tests to account for new payload types in `src-tauri/src/use_cases/editor_service.rs` tests

**Checkpoint**: All layer operations are individually undoable. Property changes store metadata only. Structural changes store full stack.

---

## Phase 6: User Story 5 — Redo After Undo (Priority: P2)

**Goal**: Redo (Ctrl+Y / Ctrl+Shift+Z) restores undone actions correctly for all payload types. New action after undo clears the redo stack. Redo on empty stack is a no-op.

**Independent Test**: Draw two strokes. Undo both. Redo one — first stroke reappears. Draw a new stroke — redo is no longer available.

### Tests

- [ ] T033 [US5] Add unit test: redo after draw undo with SingleLayer payload restores pixels correctly in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T034 [US5] Add unit test: redo after property undo with Property payload restores property value in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T035 [US5] Add unit test: redo after structural undo with FullStack payload restores layer stack in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T036 [US5] Add unit test: new action after undo clears redo stack entirely in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T037 [US5] Add unit test: redo on empty stack returns `DomainError::EmptyHistory` in `src-tauri/src/use_cases/editor_service.rs` tests

### Implementation

- [ ] T038 [US5] Verify `apply_history_swap` redo path pushes correct payload variant for all 3 types — no code change expected if Phase 2 was implemented correctly, but verify with tests in `src-tauri/src/use_cases/editor_service.rs`

**Checkpoint**: Redo works for all payload types. Fork behavior (new action clears redo) works correctly.

---

## Phase 7: User Story 6 — Efficient Undo Capture (Priority: P3)

**Goal**: Undo entries capture only the data modified by the action. Memory is proportional to changes, not total texture size * history depth.

**Independent Test**: Perform 50 paint operations on a 5-layer texture. Verify undo entries contain only the affected layer's data for draws, only metadata for property changes.

### Tests

- [ ] T039 [US6] Add unit test: draw entry on 5-layer texture contains SingleLayer (1 layer snapshot), not 5 layer snapshots — in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T040 [US6] Add unit test: property change entry contains no pixel data (PropertyChange variant only) — in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T041 [US6] Add unit test: 50 sequential draws on 5-layer texture — total memory of undo entries scales with single-layer size, not 5x — in `src-tauri/src/use_cases/editor_service.rs` tests

### Implementation

- [ ] T042 [US6] No additional code changes expected — efficiency is delivered by the `UndoPayload` architecture from Phase 2 + Phases 3-5. This phase validates the architecture meets memory goals.

**Checkpoint**: Memory efficiency verified. SingleLayer entries are ~1/N the size of FullStack (where N = layer count).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases from spec, regression validation, cleanup.

- [ ] T043 Handle edge case: undo history at max capacity evicts oldest entries correctly with mixed payload types in `src-tauri/src/domain/undo.rs` tests
- [ ] T044 Handle edge case: compound operation — delete layer with painted content produces single FullStack undo entry that restores both layer and content in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T045 Handle edge case: undo layer deletion then continue editing the restored layer — verify subsequent draws create proper SingleLayer entries in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T046 Handle edge case: undo creation of the only remaining layer — verify system follows minimum-layer policy (block undo or restore default empty state) in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T047 Handle edge case: rapid alternation between undo and redo (100+ operations) maintains consistent stacks in `src-tauri/src/use_cases/editor_service.rs` tests
- [ ] T048 Run full `cargo test` suite in `src-tauri/` to confirm zero regressions
- [ ] T049 Run quickstart.md validation — execute all 8 test scenarios from `specs/035-fix-undo-redo/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — run immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1+US2 (Phase 3)**: Depends on Phase 2 — First user-facing increment (MVP)
- **US3 (Phase 4)**: Depends on Phase 3 (needs SingleLayer payload for stroke finalization)
- **US4 (Phase 5)**: Depends on Phase 2 only — Can run in parallel with Phase 3
- **US5 (Phase 6)**: Depends on Phases 3, 4, 5 (needs all payload types implemented to test redo)
- **US6 (Phase 7)**: Depends on Phases 3, 4, 5 (validates architecture across all payload types)
- **Polish (Phase 8)**: Depends on all user stories complete

### User Story Dependencies

- **US1+US2 (P1)**: Foundational only — can start first
- **US3 (P2)**: Depends on US1 (needs SingleLayer draw workflow)
- **US4 (P2)**: Foundational only — can run in parallel with US1+US2
- **US5 (P2)**: Depends on US1, US3, US4 (tests all payload types)
- **US6 (P3)**: Depends on US1, US4 (validates memory for draw + property payloads)

### Within Each User Story

- Tests MUST be written first and FAIL before implementation
- Domain types before use case logic
- Use case logic before command layer
- Implementation before regression checks
- Story complete before moving to dependent stories

### Parallel Opportunities

- T005 + T006 can run in parallel (different files: layer_stack.rs vs editor_service.rs)
- T009 + T010 can run in parallel (different test files)
- T026 + T027 can run in parallel (different test functions, same file but independent)
- **US1+US2 and US4 can run in parallel** after foundational phase (different code paths in editor_service.rs)

---

## Parallel Example: Foundational Phase

```
# These tasks operate on different files and can run in parallel:
T005: "Add restore_single_layer to LayerStack in domain/layer_stack.rs"
T006: "Add property helpers to EditorService in use_cases/editor_service.rs"

# These test tasks can also run in parallel:
T009: "Update UndoManager tests in domain/undo.rs"
T010: "Add restore_single_layer tests in domain/layer_stack.rs"
```

## Parallel Example: After Foundational

```
# US1+US2 and US4 can proceed in parallel:
Phase 3 (US1+US2): "Single-layer draw snapshots in editor_service.rs"
Phase 5 (US4): "Layer operation payloads in editor_service.rs"
# Note: while both touch editor_service.rs, they modify different methods
```

---

## Implementation Strategy

### MVP First (US1+US2 Only)

1. Complete Phase 1: Setup (verify baseline)
2. Complete Phase 2: Foundational (new types, restore logic)
3. Complete Phase 3: US1+US2 (single-layer draw snapshots)
4. **STOP and VALIDATE**: Draw strokes, undo/redo, verify correct behavior
5. Core undo/redo is fixed for the most common operation (painting)

### Incremental Delivery

1. Setup + Foundational → New types ready
2. US1+US2 → Draw undo works with targeted snapshots → **MVP**
3. US4 → Layer operations use targeted payloads → Property changes efficient
4. US3 → Mid-stroke undo works → Edge case resolved
5. US5 → Redo verified across all types → Full undo/redo correctness
6. US6 → Memory efficiency validated → Architecture goals met
7. Polish → Edge cases covered → Production-ready

---

## Notes

- All code changes are in Rust backend only (domain/ and use_cases/)
- The only command-layer change is in history_commands.rs (T025) for mid-stroke tool cleanup
- No frontend changes required — existing error handling covers all edge cases
- No IPC signature changes — all commands keep the same input/output types
- Constitution Principle IV (Test-First) drives the test-before-implement ordering
