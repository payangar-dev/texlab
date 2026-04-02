# Tasks: Layers Panel

**Input**: Design documents from `/specs/010-layers-panel/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc.md, quickstart.md

**Tests**: Domain and use case unit tests are included (constitution mandate IV: Test-First for Domain). Frontend component tests are not included (not explicitly requested).

**Organization**: Tasks are grouped by user story. Backend foundational work is grouped in Phase 2 because it touches shared files (`dto.rs`, `layer_commands.rs`, `lib.rs`) and must be complete before frontend stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install new frontend dependency

- [x] T001 Install @dnd-kit/core and @dnd-kit/sortable via npm in package.json

---

## Phase 2: Foundational (Backend — All Layer Operations)

**Purpose**: Extend backend with domain methods, use case orchestration, DTO changes, and Tauri commands needed across multiple user stories. All domain/use_case methods include unit tests per constitution principle IV.

**Why grouped**: These tasks modify shared Rust files (`dto.rs`, `layer_commands.rs`, `lib.rs`). Completing them together avoids repeated file edits and ensures the backend compiles before any frontend work begins.

- [x] T002 [P] Add `insert_layer(index, layer)` and `index_of(id)` methods with unit tests to LayerStack in src-tauri/src/domain/layer_stack.rs
- [x] T003 [P] Add `duplicate(new_id)` method with unit tests to Layer in src-tauri/src/domain/layer.rs
- [x] T004 Add `add_layer_above(id, name, above_id)` and `duplicate_layer(source_id, new_id)` methods with unit tests to EditorService in src-tauri/src/use_cases/editor_service.rs
- [x] T005 [P] Add `thumbnail: Vec<u8>` field to LayerInfoDto and populate from `layer.buffer().clone_data()` in `From<&Layer>` in src-tauri/src/commands/dto.rs
- [x] T006 Modify `add_layer` command to insert above active layer and add min-1-layer guard to `remove_layer` command in src-tauri/src/commands/layer_commands.rs
- [x] T007 Add `duplicate_layer` Tauri command and register in `generate_handler!` in src-tauri/src/commands/layer_commands.rs and src-tauri/src/lib.rs
- [x] T008 Update `LayerInfoDto` type (add `thumbnail: number[]`) and add `duplicateLayer(layerId)` wrapper in src/api/commands.ts

**Checkpoint**: `cargo test` passes, `npm run typecheck` passes. All backend layer operations are available via IPC.

---

## Phase 3: User Story 1 — View and Select Layers (Priority: P1) MVP

**Goal**: Display a dockable "Layers" panel listing all layers with thumbnails, names, opacity, and visibility state. Users can select a layer by clicking its row.

**Independent Test**: Open a multi-layer texture, verify all layers appear in stacking order (topmost first) with correct metadata. Click a layer row to change the active selection.

### Implementation for User Story 1

- [x] T009 [US1] Create LayerRow component rendering inline thumbnail canvas (18x18), layer name, opacity percentage, visibility icon (Eye/EyeOff), and active highlight style in src/components/layers/LayerRow.tsx
- [x] T010 [US1] Create LayersPanel component with scrollable layer list (reversed stacking order — topmost first), layer click-to-select dispatching to editorStore, empty state message, and panel layout (fixed header area + scrollable list + fixed bottom area) in src/components/layers/LayersPanel.tsx
- [x] T011 [US1] Update panels/LayersPanel.tsx to be thin dockview wrapper delegating to layers/LayersPanel (same pattern as CanvasViewportPanel) in src/components/panels/LayersPanel.tsx

**Checkpoint**: Layers panel displays all layers of the active texture with thumbnails, names, opacity. Clicking a layer selects it. Empty state shown when no texture is open.

---

## Phase 4: User Story 2 — Add, Delete, and Duplicate Layers (Priority: P1)

**Goal**: Users can add, delete, or duplicate layers via action buttons at the bottom of the panel. New/duplicated layers are inserted above the active layer.

**Independent Test**: Use each action button and verify: add creates empty layer above active, duplicate copies active layer with "(copy)" suffix, delete removes active layer (blocked if last layer). Panel and canvas update after each action.

### Implementation for User Story 2

- [x] T012 [US2] Add action bar with Add (Plus icon), Delete (Trash2 icon), and Duplicate (Copy icon) buttons calling addLayer, removeLayer, and duplicateLayer API commands, with last-layer deletion prevention, in src/components/layers/LayersPanel.tsx

**Checkpoint**: Add/Delete/Duplicate buttons work. New layers appear above active. Last layer cannot be deleted. All actions are undoable.

---

## Phase 5: User Story 3 — Toggle Layer Visibility (Priority: P2)

**Goal**: Users can toggle layer visibility by clicking the eye icon. Hidden layers are visually dimmed, and the canvas updates.

**Independent Test**: Click eye icon on a visible layer — it hides (row dimmed, canvas updates). Click again — it reappears.

### Implementation for User Story 3

- [x] T013 [US3] Add visibility toggle click handler on eye icon calling setLayerVisibility, and apply dimmed row style for hidden layers in src/components/layers/LayerRow.tsx

**Checkpoint**: Eye icon toggles visibility. Hidden layers are dimmed. Canvas reflects visibility changes.

---

## Phase 6: User Story 4 — Reorder Layers by Drag and Drop (Priority: P2)

**Goal**: Users can drag layer rows to reorder them. The canvas updates in real time to reflect the new stacking order.

**Independent Test**: Drag a layer from one position to another — list reorders and canvas re-renders. Cancel a drag outside the list — original order preserved.

### Implementation for User Story 4

- [x] T014 [US4] Integrate @dnd-kit DndContext and SortableContext in LayersPanel, make LayerRow a useSortable item, add drag overlay and insertion indicator, convert visual indices (0=top) to backend indices (0=bottom) before calling moveLayer on drag end in src/components/layers/LayersPanel.tsx and src/components/layers/LayerRow.tsx

**Checkpoint**: Layers can be reordered by drag-and-drop. Visual insertion indicator shown during drag. Canvas updates after drop.

---

## Phase 7: User Story 5 — Rename a Layer (Priority: P2)

**Goal**: Users can rename a layer by double-clicking its name or pressing F2. An inline text input appears, confirmed by Enter or blur, cancelled by Escape.

**Independent Test**: Double-click a layer name — input appears with current name pre-filled. Type new name, press Enter — name updates. Press Escape — original name restored.

### Implementation for User Story 5

- [x] T015 [US5] Add inline rename mode triggered by double-click and F2 with controlled input, Enter to confirm (calls setLayerName), Escape to cancel, blur to confirm, and empty name rejection in src/components/layers/LayerRow.tsx

**Checkpoint**: Rename works via double-click and F2. Enter/blur saves, Escape cancels. Empty name rejected.

---

## Phase 8: User Story 6 — Change Layer Blend Mode (Priority: P3)

**Goal**: Users can select a blend mode from a panel-level dropdown that applies to the active layer.

**Independent Test**: Select a layer, open blend mode dropdown — shows Normal/Multiply/Screen/Overlay with current mode selected. Change mode — canvas re-renders with new blending.

### Implementation for User Story 6

- [x] T016 [US6] Create BlendModeSelect dropdown component (Normal/Multiply/Screen/Overlay) in src/components/layers/BlendModeSelect.tsx
- [x] T017 [US6] Integrate BlendModeSelect in LayersPanel between layer list and action bar, reflecting active layer's blend mode and calling setLayerBlendMode on change in src/components/layers/LayersPanel.tsx

**Checkpoint**: Blend mode dropdown shows active layer's mode. Changing mode updates canvas compositing immediately.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases and final verification

- [x] T018 Verify all spec edge cases: empty state message, empty name rejection, 20+ layers scroll with fixed header/action bar, texture switch updates panel, external MCP mutations trigger panel refresh

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup. T002 and T003 are parallel. T004 depends on T002+T003. T005 is parallel with T002/T003. T006 and T007 depend on T004. T008 depends on T005+T007.
- **User Stories (Phase 3+)**: All depend on Foundational (Phase 2) completion
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — No dependencies on other stories
- **US2 (P1)**: Can start after US1 (T010 creates the panel layout that T012 modifies)
- **US3 (P2)**: Can start after US1 (needs LayerRow) — No dependencies on US2/US4/US5/US6
- **US4 (P2)**: Can start after US1 (needs panel + rows) — No dependencies on US2/US3/US5/US6
- **US5 (P2)**: Can start after US1 (needs LayerRow) — No dependencies on US2/US3/US4/US6
- **US6 (P3)**: Can start after US1 (needs panel layout) — No dependencies on US2-US5

### Within Each User Story

- Backend infrastructure complete before frontend (Phase 2 before Phase 3+)
- US1 creates the panel structure that all other stories build on
- US3, US4, US5, US6 modify files created by US1 but touch distinct areas (visibility icon, DnD wrapper, rename input, blend dropdown)

### Parallel Opportunities

- T002 and T003 can run in parallel (different domain files)
- T005 can run in parallel with T002/T003 (different file: dto.rs)
- After US1, stories US3/US4/US5/US6 touch different concerns and could theoretically be developed in parallel by different developers
- T016 and T017 (US6) are sequential but could be parallelized with US3/US4/US5

---

## Parallel Example: Phase 2 (Foundational)

```
# Parallel batch 1 (different domain files):
T002: LayerStack::insert_layer(), index_of() in domain/layer_stack.rs
T003: Layer::duplicate() in domain/layer.rs
T005: LayerInfoDto thumbnail in commands/dto.rs

# Sequential after batch 1:
T004: EditorService methods in use_cases/editor_service.rs (depends on T002+T003)

# Sequential after T004:
T006: Modify add_layer + guard remove_layer in commands/layer_commands.rs
T007: Add duplicate_layer command + register in lib.rs

# After T005+T007:
T008: Frontend API type + wrapper in api/commands.ts
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (@dnd-kit install)
2. Complete Phase 2: Foundational (all backend changes)
3. Complete Phase 3: US1 — View and Select Layers
4. Complete Phase 4: US2 — Add, Delete, Duplicate
5. **STOP and VALIDATE**: Panel shows layers, selection works, CRUD works
6. This is the minimum viable Layers Panel

### Incremental Delivery

1. Setup + Foundational -> Backend ready
2. Add US1 -> Layers visible, selectable -> Validate
3. Add US2 -> CRUD operations -> Validate (MVP!)
4. Add US3 -> Visibility toggle -> Validate
5. Add US4 -> Drag reorder -> Validate
6. Add US5 -> Rename -> Validate
7. Add US6 -> Blend modes -> Validate
8. Polish -> Edge cases verified -> Feature complete

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story from spec.md
- Layer list displayed in reverse order (topmost layer first, but LayerStack stores bottom-first)
- All layer commands return `EditorStateDto` — the panel re-renders from store, no manual state management
- Theme tokens from `src/styles/theme.ts` — use `colors.*`, `fonts.*`, `fontSizes.*`
- Icons from `lucide-react` (already installed): Eye, EyeOff, Plus, Trash2, Copy, ChevronDown, GripHorizontal
- UI design reference: `ui-design` .pen file, component `Panel-Layers`
