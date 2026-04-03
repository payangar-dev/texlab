# Tasks: Centralize keyboard shortcuts with Command + Keybinding registries

**Input**: Design documents from `/specs/034-command-keybinding-registries/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Existing test file `src/hooks/useKeyboardShortcuts.test.ts` will be migrated to cover the new system.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure for the command system

- [x] T001 Create directory structure: `src/commands/` and `src/commands/definitions/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core registry classes, key normalization, context system, and dispatcher hook. These are the building blocks all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 [P] Create type definitions (CommandDefinition, KeybindingDefinition, CommandCategory, KeybindingMatch) in `src/commands/types.ts`
- [x] T003 [P] Implement CommandRegistry class with registerCommand (throws on duplicate id), getCommand, and executeCommand (precondition check → execute) in `src/commands/commandRegistry.ts`
- [x] T004 [P] Implement normalizeKeyEvent (e.key for letters, e.code→base-key map for symbols/Space/digits, Mod+Alt+Shift+ prefix order) and KeybindingRegistry class with registerKeybinding, findMatch (key+trigger+when evaluation), and getKeybindingsForCommand in `src/commands/keybindingRegistry.ts`
- [x] T005 [P] Implement context system: initContext (focusin/focusout listeners setting inputFocused), getContext (returns Map with inputFocused eager + dialogOpen via lazy document.querySelector("dialog[open]")), and evaluateWhen (split on && with ! negation support, null = always match) in `src/commands/context.ts`
- [x] T006 Implement useCommandDispatcher React hook: single window keydown+keyup listeners, keydown pipeline (skip e.repeat → normalize → getContext → findMatch for keydown → precondition → preventDefault → execute), keyup pipeline (normalize → findMatch for keyup → execute), cleanup on unmount, in `src/commands/dispatcher.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — All shortcuts handled by a single registry (Priority: P1) 🎯 MVP

**Goal**: Replace all 3 scattered `window.addEventListener("keydown", ...)` calls with the centralized command system. Every existing shortcut works identically through the registry.

**Independent Test**: Press every shortcut listed in FR-011 (B, E, G, I, L, M, V, Z, [, ], X, Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, Ctrl+=, Ctrl+-, Ctrl+0, Ctrl+1, Space hold, Ctrl+Shift+R, Delete) and verify identical behavior. Inspect the registry to confirm all commands are listed with metadata.

### Implementation for User Story 1

- [x] T007 [P] [US1] Add `requestCanvasRedraw` module-level export to `src/components/canvas/CanvasViewport.tsx` following the existing `finalizeActiveStroke` pattern (module-level variable set during component mount, exported function calls it)
- [x] T008 [P] [US1] Add `triggerLayoutReset` module-level export to `src/components/shell/DockLayout.tsx` following the same module-level callback pattern (variable set to `doReset` during mount, exported function calls it)
- [x] T009 [P] [US1] Define 8 tool commands (tools.brush, tools.eraser, tools.fill, tools.eyedropper, tools.line, tools.selection, tools.move, tools.zoom) with keybindings (b, e, g, i, l, m, v, z) and finalizeActiveStroke() call before setActiveToolType in `src/commands/definitions/tools.ts`
- [x] T010 [P] [US1] Define 5 edit commands (edit.undo with Mod+z, edit.redo with Mod+Shift+z and Mod+y, edit.brushSizeDecrease with BracketLeft, edit.brushSizeIncrease with BracketRight, edit.swapColors with x) in `src/commands/definitions/edit.ts`
- [x] T011 [P] [US1] Define 6 view commands (view.zoomIn Mod+=, view.zoomOut Mod+-, view.fitToViewport Mod+0 with texture-loaded precondition, view.resetZoom Mod+1, view.panStart Space keydown, view.panEnd Space keyup) with requestCanvasRedraw calls and exported isPanHeld() function in `src/commands/definitions/view.ts`. Zoom and Space keybindings use `when: null` (always fire, bypass input suppression)
- [x] T012 [P] [US1] Define 1 layer command (layers.removeActive with Delete keybinding and ≥2 layers precondition) calling removeLayer IPC in `src/commands/definitions/layers.ts`
- [x] T013 [P] [US1] Define 1 layout command (layout.reset with Mod+Shift+r keybinding, `when: null`) calling triggerLayoutReset in `src/commands/definitions/layout.ts`
- [x] T014 [US1] Wire all registration functions (registerToolCommands, registerEditCommands, registerViewCommands, registerLayerCommands, registerLayoutCommands) in initializeCommands() entry point in `src/commands/index.ts`
- [x] T015 [US1] Mount useCommandDispatcher hook and call initializeCommands() in `src/components/shell/AppShell.tsx`
- [x] T016 [US1] Remove old keyboard handlers: delete useKeyboardShortcuts call and spaceHeldRef usage from `src/components/canvas/CanvasViewport.tsx`, remove global Delete keydown useEffect from `src/components/layers/LayersPanel.tsx`, remove Ctrl+Shift+R keydown useEffect from `src/components/shell/DockLayout.tsx`, and delete `src/hooks/useKeyboardShortcuts.ts`
- [x] T017 [US1] Update `src/components/canvas/useViewportControls.ts`: remove local spaceHeldRef creation, import isPanHeld() from `src/commands/definitions/view.ts`, replace all `spaceHeldRef.current` reads with `isPanHeld()` calls

**Checkpoint**: All existing shortcuts work identically through the centralized command system. No scattered window listeners remain.

---

## Phase 4: User Story 2 — Shortcuts suppressed in text input contexts (Priority: P2)

**Goal**: Ensure global shortcuts are suppressed when typing in text fields, textareas, contentEditable elements, and when a dialog is open — while allowing explicitly opt-in keybindings (zoom, space, layout reset) to fire regardless.

**Independent Test**: Focus a layer rename input, type `B` → character inserted, brush not selected. Focus hex color input, type `E` → character inserted, eraser not selected. Open a dialog, press shortcut keys → no commands fire. Verify Ctrl+= still zooms in all contexts.

### Implementation for User Story 2

- [x] T018 [US2] Review and harden contentEditable detection in initContext: ensure focusin handler checks target.isContentEditable in addition to INPUT/TEXTAREA tagName, and ensure focusout correctly resets inputFocused only when the new activeElement is not also an input, in `src/commands/context.ts`
- [x] T019 [US2] Validate that all keybindings with `when: null` (view.zoomIn, view.zoomOut, view.fitToViewport, view.resetZoom, view.panStart, view.panEnd, layout.reset) correctly bypass context suppression, and that all other keybindings use the default suppression clause, in `src/commands/definitions/view.ts` and `src/commands/definitions/layout.ts`

**Checkpoint**: Typing in any text input or contentEditable never triggers global shortcuts. Zoom and layout reset work in all contexts.

---

## Phase 5: User Story 3 — Conflict detection at registration time (Priority: P3)

**Goal**: Detect and warn when two keybindings with the same key combination and overlapping contexts are registered, preventing ambiguous shortcut behavior.

**Independent Test**: Register two commands with the same keybinding (e.g., `Ctrl+S`) and verify a console.warn is emitted. Register two commands with the same key but different `when` clauses and verify no warning.

### Implementation for User Story 3

- [x] T020 [US3] Add conflict detection logic to registerKeybinding in `src/commands/keybindingRegistry.ts`: on registration, iterate existing bindings for same key+trigger, compare when clauses (identical or both null/default = conflict → console.warn with both command IDs; different when = no conflict)

**Checkpoint**: Registering conflicting keybindings produces a clear console warning. Context-differentiated bindings are allowed.

---

## Phase 6: User Story 4 — Commands are discoverable with metadata (Priority: P3)

**Goal**: Enable programmatic discovery of all commands with their labels, categories, and keybindings — the foundation for a future command palette and keybinding editor.

**Independent Test**: Call `getAllCommands()` and verify every command has id, label, and category. Call `getCommandsByCategory("tools")` and verify all 8 tool commands are returned. Call `getCategories()` and verify ["edit", "layers", "layout", "tools", "view"] are returned.

### Implementation for User Story 4

- [x] T021 [US4] Add discovery query APIs to CommandRegistry: getAllCommands() returning all commands sorted by category then label, getCommandsByCategory(category) returning filtered+sorted list, and getCategories() returning categories with ≥1 command, in `src/commands/commandRegistry.ts`

**Checkpoint**: All commands are discoverable via the registry with full metadata.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Test migration and final cleanup

- [x] T022 Migrate existing tests from `src/hooks/useKeyboardShortcuts.test.ts` to `src/commands/__tests__/` covering: normalizeKeyEvent (letter keys, Mod combos, Shift+symbol, Space, Delete), evaluateWhen (conjunction, negation, null bypass), CommandRegistry (register, duplicate rejection, executeCommand with precondition), KeybindingRegistry (register, findMatch with context)
- [x] T023 Clean up: remove any unused imports across modified files, verify no `window.addEventListener("keydown"` or `window.addEventListener("keyup"` calls exist outside `src/commands/dispatcher.ts` (except local React onKeyDown handlers in LayerRow), delete `src/hooks/useKeyboardShortcuts.test.ts` after migration

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — this is the MVP
- **US2 (Phase 4)**: Depends on Phase 3 (needs commands defined with correct `when` clauses)
- **US3 (Phase 5)**: Depends on Phase 2 only (conflict detection is a registry feature)
- **US4 (Phase 6)**: Depends on Phase 2 only (query APIs are registry features)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (Phase 2) — no other story dependencies. This IS the MVP.
- **US2 (P2)**: Depends on US1 (needs commands with `when` clauses to validate). Can verify/refine context behavior.
- **US3 (P3)**: Independent of other stories — can start after Phase 2. Adds conflict detection to registry.
- **US4 (P3)**: Independent of other stories — can start after Phase 2. Adds query APIs to registry.

### Within Each Phase

- Foundational: T002-T005 in parallel → T006 (depends on all)
- US1: T007-T008 (add exports, parallel) → T009-T013 (define commands, parallel) → T014 (wire index) → T015 (mount) → T016 (remove old) → T017 (update viewport controls)
- US3 and US4 can run in parallel (different methods on different classes)

### Parallel Opportunities

- **Phase 2**: T002, T003, T004, T005 — all different files, no interdependencies
- **Phase 3**: T007+T008 (exports, different files); T009-T013 (definitions, all different files); T016 removals touch 3 files but are one logical operation
- **Phase 5 + Phase 6**: US3 and US4 can run in parallel (keybindingRegistry vs commandRegistry)

---

## Parallel Example: Phase 2 (Foundational)

```text
# Launch all foundational tasks together:
Task T002: "Create type definitions in src/commands/types.ts"
Task T003: "Implement CommandRegistry in src/commands/commandRegistry.ts"
Task T004: "Implement KeybindingRegistry in src/commands/keybindingRegistry.ts"
Task T005: "Implement context system in src/commands/context.ts"

# Then sequentially:
Task T006: "Implement useCommandDispatcher in src/commands/dispatcher.ts"
```

## Parallel Example: Phase 3 (US1 Definitions)

```text
# Launch all command definitions together:
Task T009: "Define tool commands in src/commands/definitions/tools.ts"
Task T010: "Define edit commands in src/commands/definitions/edit.ts"
Task T011: "Define view commands in src/commands/definitions/view.ts"
Task T012: "Define layer commands in src/commands/definitions/layers.ts"
Task T013: "Define layout commands in src/commands/definitions/layout.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (1 task)
2. Complete Phase 2: Foundational (5 tasks) — BLOCKS everything
3. Complete Phase 3: US1 — All shortcuts through registry (10 tasks)
4. **STOP and VALIDATE**: Every shortcut from FR-011 works identically
5. This alone delivers the core value: centralized, declarative, discoverable shortcuts

### Incremental Delivery

1. Setup + Foundational → Core infrastructure ready
2. US1 (P1) → All shortcuts migrated → **MVP complete**
3. US2 (P2) → Context suppression hardened → Text input safety guaranteed
4. US3 (P3) + US4 (P3) → Conflict detection + discovery APIs → Developer safeguards in place
5. Polish → Tests migrated, cleanup verified

### Single Developer Flow

All phases are sequential for a single developer. Within each phase, [P] tasks can be written in parallel by an AI agent. Recommended commit points:
- After Phase 2 (foundational infrastructure)
- After Phase 3 (MVP — all shortcuts working)
- After Phases 4-6 (all stories complete)
- After Phase 7 (polish and tests)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- `when: null` on a keybinding means "always fire" (bypass context suppression) — used for zoom, space-to-pan, layout reset
- Default `when` (not specified) = `"!inputFocused && !dialogOpen"` — matches current suppression behavior
- Module-level callback pattern (like `finalizeActiveStroke`) is used for cross-component function access: `requestCanvasRedraw` and `triggerLayoutReset`
- `isPanHeld()` replaces the `spaceHeldRef` React ref — now a plain function export from view command definitions
- No new npm dependencies required
- No Rust backend changes required
