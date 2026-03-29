# Tasks: PNG I/O + AppState + Tauri Commands

**Input**: Design documents from `/specs/005-png-state-commands/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/tauri-commands.md, quickstart.md

**Tests**: Infrastructure round-trip tests included (called out in plan.md). No other test tasks unless requested.

**Organization**: Tasks grouped by user story. 7 user stories across 3 priority tiers.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Add new dependencies and prepare test infrastructure

- [x] T001 Add `image = { version = "0.25", default-features = false, features = ["png"] }` and `tauri-plugin-dialog = "2"` to src-tauri/Cargo.toml
- [x] T002 [P] Install `@tauri-apps/plugin-dialog` npm package and add `"dialog:default"` permission to src-tauri/capabilities/default.json
- [x] T003 [P] Create PNG test fixture files (16x16 RGBA with alpha, 16x16 RGB without alpha, 32x32 fully transparent) in src-tauri/tests/fixtures/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Expand `AppState` with `editor: Option<EditorService>`, `active_tool: Option<Box<dyn Tool>>`, and `active_layer_id: Option<LayerId>` fields in src-tauri/src/state.rs
- [x] T005 [P] Add `From<DomainError>` impl to `AppError` in src-tauri/src/error.rs
- [x] T006 [P] Implement `PngReader` struct implementing `domain::ports::ImageReader` (read PNG → PixelBuffer via `image::open().to_rgba8()`) in src-tauri/src/infrastructure/png_reader.rs
- [x] T007 [P] Implement `PngWriter` struct implementing `domain::ports::ImageWriter` (write PixelBuffer → PNG via `ImageBuffer::from_raw().save()`) in src-tauri/src/infrastructure/png_writer.rs
- [x] T008 Declare `png_reader` and `png_writer` modules in src-tauri/src/infrastructure/mod.rs
- [x] T009 Implement all DTO structs (`EditorStateDto`, `TextureMetadataDto`, `LayerInfoDto`, `CompositeDto`, `ToolResultDto`, `ColorDto`, `SelectionDto`) with `serde::Serialize` derives and `From` conversion impls from domain types in src-tauri/src/commands/dto.rs
- [x] T010 [P] Create commands module structure: mod.rs with sub-module declarations (dto, texture_commands, tool_commands, layer_commands, history_commands, state_commands) and re-exports of all command functions in src-tauri/src/commands/mod.rs
- [x] T011 Write PNG round-trip integration tests for `PngReader` and `PngWriter` using test fixtures (read RGBA, read RGB→RGBA conversion, write then re-read, error on missing file) in src-tauri/src/infrastructure/png_reader.rs and src-tauri/src/infrastructure/png_writer.rs

**Checkpoint**: Infrastructure compiles, PNG round-trip tests pass, DTOs and module structure ready

---

## Phase 3: User Story 1 — Open and View a Texture (Priority: P1) MVP

**Goal**: User opens a PNG file and the application loads it into an editable texture with pixel data available for display

**Independent Test**: Open a PNG via `open_texture` command, then call `get_editor_state` and `get_composite` to verify texture metadata and RGBA pixel data are returned correctly

### Implementation for User Story 1

- [x] T012 [US1] Implement `open_texture` command: accept `filePath`, `namespace`, `texturePath` params, read PNG via `PngReader`, check unsaved changes guard, create `Texture` + `EditorService`, set `active_layer_id` to first layer, clear `active_tool`, store in `AppState`, emit `state-changed` event, return `EditorStateDto` in src-tauri/src/commands/texture_commands.rs
- [x] T013 [P] [US1] Implement `get_editor_state` (return `EditorStateDto` or empty state if no texture) and `get_composite` (return `CompositeDto`) commands in src-tauri/src/commands/state_commands.rs
- [x] T014 [US1] Register `open_texture`, `get_editor_state`, `get_composite` in `generate_handler![]` and add `.plugin(tauri_plugin_dialog::init())` in src-tauri/src/lib.rs

**Checkpoint**: `open_texture` loads a PNG, `get_editor_state` returns metadata and layers, `get_composite` returns RGBA bytes. `cargo check` passes.

---

## Phase 4: User Story 2 — Draw on a Texture (Priority: P1)

**Goal**: User selects a tool and draws on the active layer via press/drag/release lifecycle, pixels are modified and composited result is returned

**Independent Test**: Open a texture, call `tool_press`/`tool_drag`/`tool_release` with brush tool, verify `ToolResultDto` contains `pixels_modified` result type and updated composite data

### Implementation for User Story 2

- [x] T015 [US2] Implement `tool_press`, `tool_drag`, `tool_release` commands in src-tauri/src/commands/tool_commands.rs. `tool_press`: create tool instance from `tool` string (`"brush"` → `BrushTool`, etc.), store in `AppState.active_tool`, update `active_layer_id`, call `apply_tool_press`. `tool_drag`/`tool_release`: reuse tool from `AppState.active_tool` (error if None), call `apply_tool_drag`/`apply_tool_release`. `tool_release` clears `active_tool` after call. All: layer lookup by hex ID, `ToolContext` construction, composite in `ToolResultDto` when pixels modified.
- [x] T016 [US2] Register `tool_press`, `tool_drag`, `tool_release` in `generate_handler![]` in src-tauri/src/lib.rs

**Checkpoint**: All 6 tools (brush, eraser, fill, color_picker, line, selection) produce correct results via IPC commands. `cargo check` passes.

---

## Phase 5: User Story 3 — Save a Texture (Priority: P1)

**Goal**: User saves the composited texture as a PNG file, dirty flag is cleared

**Independent Test**: Open a texture, draw a pixel, call `save_texture` with a path, verify file is written and `get_editor_state` shows `dirty: false`

### Implementation for User Story 3

- [x] T017 [US3] Implement `save_texture` command: composite all layers via `PngWriter`, write to path, mark texture clean, emit `state-changed` event in src-tauri/src/commands/texture_commands.rs
- [x] T018 [US3] Register `save_texture` in `generate_handler![]` in src-tauri/src/lib.rs

**Checkpoint**: Open → edit → save → reopen cycle produces correct PNG output. `cargo check` passes.

---

## Phase 6: User Story 4 — Create a New Texture (Priority: P2)

**Goal**: User creates a blank texture with specified dimensions, namespace, and path, starting with one transparent layer

**Independent Test**: Call `create_texture` with valid params, verify `get_editor_state` returns correct dimensions and one layer named "Layer 1"

### Implementation for User Story 4

- [x] T019 [US4] Implement `create_texture` command: validate params, check unsaved changes guard, create blank `Texture` with one transparent layer, set `active_layer_id` to first layer, clear `active_tool`, store in `AppState`, emit `state-changed` event, return `EditorStateDto` in src-tauri/src/commands/texture_commands.rs
- [x] T020 [US4] Register `create_texture` in `generate_handler![]` in src-tauri/src/lib.rs

**Checkpoint**: `create_texture` produces a blank texture with correct dimensions. `cargo check` passes.

---

## Phase 7: User Story 5 — Manage Layers (Priority: P2)

**Goal**: User manages the layer stack: create, delete, reorder layers and adjust properties (opacity, visibility, blend mode, name, lock)

**Independent Test**: Open a texture, add a layer, change its opacity, toggle visibility, reorder, verify `get_editor_state` reflects each change and `get_composite` output changes accordingly

### Implementation for User Story 5

- [x] T021 [US5] Implement `add_layer`, `remove_layer`, `move_layer` commands delegating to `EditorService` layer methods, emit `state-changed`, return `EditorStateDto` in src-tauri/src/commands/layer_commands.rs
- [x] T022 [US5] Implement `set_layer_opacity`, `set_layer_visibility`, `set_layer_blend_mode`, `set_layer_name`, `set_layer_locked` commands in src-tauri/src/commands/layer_commands.rs
- [x] T023 [US5] Register all 8 layer commands in `generate_handler![]` in src-tauri/src/lib.rs

**Checkpoint**: All layer CRUD and property operations work via IPC. Composite output reflects changes. `cargo check` passes.

---

## Phase 8: User Story 6 — Undo and Redo Actions (Priority: P2)

**Goal**: User undoes and redoes editing operations (drawing, layer changes), state reverts/reapplies correctly

**Independent Test**: Open a texture, draw, undo, verify state reverts to pre-draw, redo, verify state restores the draw

### Implementation for User Story 6

- [x] T024 [US6] Implement `undo` and `redo` commands delegating to `EditorService.undo()`/`.redo()`, emit `state-changed`, return `EditorStateDto` in src-tauri/src/commands/history_commands.rs
- [x] T025 [US6] Register `undo` and `redo` in `generate_handler![]` in src-tauri/src/lib.rs

**Checkpoint**: Undo reverts last operation, redo reapplies it, `can_undo`/`can_redo` flags are accurate. `cargo check` passes.

---

## Phase 9: User Story 7 — Query Editor State (Priority: P3)

**Goal**: The editor state query returns complete, accurate information including texture metadata, all layer info, and undo/redo availability, usable by both frontend and MCP

**Independent Test**: Perform a sequence of operations (open, draw, add layer, undo), call `get_editor_state` after each, verify response completeness and accuracy

### Implementation for User Story 7

- [x] T026 [US7] Verify and refine `EditorStateDto` construction to ensure all fields are populated correctly after every operation type (open, create, draw, layer ops, undo/redo) — adjust `From` conversion in src-tauri/src/commands/dto.rs if needed

**Checkpoint**: `get_editor_state` accurately reflects the full editor state at any point in the workflow. `cargo check` and `cargo test` pass.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Frontend wiring and final verification

- [x] T027 [P] Define TypeScript DTO interfaces and typed `invoke()` wrapper functions for all 18 commands in src/api/commands.ts
- [x] T028 [P] Implement Zustand `editorStore` with `state-changed` event listener that auto-refreshes state from Rust in src/store/editorStore.ts
- [x] T029 Run `cargo test` and `cargo check` to verify all existing + new tests pass with no warnings

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — BLOCKS US2, US3 (need an open texture)
- **US2 (Phase 4)**: Depends on US1 (must have a texture to draw on)
- **US3 (Phase 5)**: Depends on US1 (must have a texture to save). Can run in parallel with US2.
- **US4 (Phase 6)**: Depends on Foundational only — can run in parallel with US1
- **US5 (Phase 7)**: Depends on US1 or US4 (need a texture with layers)
- **US6 (Phase 8)**: Depends on US2 (need operations to undo)
- **US7 (Phase 9)**: Depends on all prior stories being implemented
- **Polish (Phase 10)**: Depends on all user stories being complete

### User Story Dependencies

```
Setup → Foundational → US1 (Open) → US2 (Draw) → US6 (Undo/Redo)
                    ↘             ↘ US3 (Save)
                     US4 (Create) → US5 (Layers) → US7 (State Query) → Polish
```

- **US1 (P1)**: After Foundational — no story dependencies
- **US4 (P2)**: After Foundational — independent of US1, can run in parallel
- **US2 (P1)**: After US1 — needs open_texture to exist
- **US3 (P1)**: After US1 — needs open_texture to exist, parallel with US2
- **US5 (P2)**: After US1 or US4 — needs a texture
- **US6 (P2)**: After US2 — needs editing operations to undo
- **US7 (P3)**: After all stories — verification of completeness

### Within Each User Story

- Implementation tasks are ordered: core command → registration
- All layer commands in US5 can be implemented in parallel (different functions, same file — split if needed)

### Parallel Opportunities

- **Phase 1**: T002 and T003 in parallel (different files)
- **Phase 2**: T005, T006, T007 in parallel (different files). T009, T010 in parallel.
- **Phase 3**: T012 and T013 in parallel (different files)
- **Phase 5 + Phase 4**: US3 can run in parallel with US2 (both depend on US1, not each other)
- **Phase 6 + Phase 3**: US4 can run in parallel with US1 (both depend on Foundational only)
- **Phase 10**: T027 and T028 in parallel (different files)

---

## Parallel Example: Foundational Phase

```bash
# After T004 (AppState), launch in parallel:
Task T005: "Add From<DomainError> to AppError in error.rs"
Task T006: "Implement PngReader in infrastructure/png_reader.rs"
Task T007: "Implement PngWriter in infrastructure/png_writer.rs"

# After T006+T007, launch in parallel:
Task T009: "DTOs in commands/dto.rs"
Task T010: "Commands module structure in commands/mod.rs"
```

## Parallel Example: User Story 1

```bash
# Launch in parallel (different files):
Task T012: "open_texture in commands/texture_commands.rs"
Task T013: "get_editor_state + get_composite in commands/state_commands.rs"

# Then sequential:
Task T014: "Register commands in lib.rs"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (open + view)
4. **STOP and VALIDATE**: `cargo check`, open a PNG, verify state query returns correct data
5. This alone delivers: open any Minecraft PNG and inspect it

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. US1 (Open/View) → Can open and inspect textures (MVP!)
3. US2 (Draw) → Can edit textures
4. US3 (Save) → Full open-edit-save workflow (core value delivered)
5. US4 (Create) → Can create textures from scratch
6. US5 (Layers) → Non-destructive multi-layer editing
7. US6 (Undo/Redo) → Safety net for all edits
8. US7 (State Query) → Complete state introspection for frontend + MCP
9. Polish → Frontend wiring + verification

### Recommended Approach

Implement sequentially in priority order: US1 → US2 → US3 (all P1, delivers core value), then US4 → US5 → US6 (P2, enriches editing), then US7 (P3) and Polish.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- All commands are thin wrappers: lock state → delegate to EditorService → convert to DTO → emit event → return
- Domain and use_cases layers are UNCHANGED — all new code is in infrastructure/ and commands/
- Every mutating command must emit `"state-changed"` event via `app.emit()`
- Tool commands need a helper to map tool string → tool instance (keep in tool_commands.rs)
- LayerId is serialized as hex string in DTOs, parsed back from hex in commands
