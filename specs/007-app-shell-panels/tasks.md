# Tasks: App Shell with Dockable Panel System

**Input**: Design documents from `/specs/007-app-shell-panels/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-commands.md, quickstart.md

**Tests**: Constitution mandates Zustand store tests mock `invoke()` and infrastructure I/O has test coverage. Test tasks included for new store and infrastructure modules.

**Organization**: Tasks grouped by user story. US1 (P1) is the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, configure Tauri, create initial theme CSS

- [x] T001 Install npm dependencies: `dockview@^5.2` and `lucide-react` via `npm install`
- [x] T002 [P] Update src-tauri/tauri.conf.json — set `decorations: false` on the main window, update default size to 1440x900
- [x] T003 [P] Update src-tauri/capabilities/default.json — add `core:window:allow-minimize`, `core:window:allow-maximize`, `core:window:allow-unmaximize`, `core:window:allow-toggle-maximize`, and `core:path:default` permissions
- [x] T004 [P] Create src/styles/dockview-theme.css — import dockview base CSS (`dockview/dist/styles/dockview.css`), add initial dark theme skeleton with CSS variables for panel backgrounds (#252525), tab bar (#2A2A2A), separators (#3A3A3A), sash handles; full overrides completed in T021 (US4)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend persistence infrastructure, panel constants, reusable panel header component, and infrastructure tests

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 [P] Implement workspace file I/O in src-tauri/src/infrastructure/workspace_io.rs — `write_workspace`, `read_workspace`, `delete_workspace` functions using `std::fs`; export module in src-tauri/src/infrastructure/mod.rs
- [x] T006 [P] Create panel ID constants in src/components/panels/constants.ts — `PANEL_IDS` object with all 6 identifiers (`sources`, `canvas`, `layers`, `color`, `palette`, `model-preview`) and `PanelId` type
- [x] T007 [P] Create PanelHeader custom tab component in src/components/panels/PanelHeader.tsx — receives `IDockviewPanelHeaderProps`, renders lucide `GripHorizontal` icon (12px, #555555) + title label (Inter 10px 600, #CCCCCC), background #2A2A2A, height 28px, no close button
- [x] T008 [P] Add layout API wrappers in src/api/commands.ts — `saveWorkspaceLayout(layoutJson: string)` and `loadWorkspaceLayout(): Promise<string | null>` using Tauri invoke
- [x] T009 Implement layout Tauri commands in src-tauri/src/commands/layout_commands.rs — `save_workspace_layout` and `load_workspace_layout` per contracts/ipc-commands.md; add `Io` variant to AppError in src-tauri/src/error.rs if needed; export in src-tauri/src/commands/mod.rs; register both commands in `generate_handler![]` in src-tauri/src/lib.rs
- [x] T010 Write tests for workspace I/O in src-tauri/src/infrastructure/workspace_io.rs (test module or src-tauri/tests/) — test `write_workspace` creates file and parent directories, `read_workspace` returns `None` when file is missing, `read_workspace` returns content when file exists, `delete_workspace` succeeds even when file is already absent; use `tempdir` or `std::env::temp_dir()` as test fixture

**Checkpoint**: Foundation ready — backend persistence works with tests, panel infrastructure in place

---

## Phase 3: User Story 1 — Default Editor Layout (Priority: P1) MVP

**Goal**: On launch, user sees the full editor workspace: title bar, tools sidebar, Sources panel (left), canvas viewport (center), Layers/Color/Palette/Model Preview panels (right), and status bar.

**Independent Test**: Launch the application and confirm all panels are visible in their expected positions with correct proportions (1440x900 window, Sources ~240px, right dock ~280px, sidebar ~48px).

### Implementation for User Story 1

- [x] T011 [P] [US1] Create TitleBar component in src/components/shell/TitleBar.tsx — height 36px, background #161616, `data-tauri-drag-region` for window dragging; contains: "TexLab" label (Inter 13px 600, #E0E0E0), menu labels (File/Edit/View/Tools/Help as non-functional text, Inter 12px, #999999), window control buttons (minimize/maximize/close using `getCurrentWindow()` from `@tauri-apps/api`)
- [x] T012 [P] [US1] Create ToolsSidebar component in src/components/shell/ToolsSidebar.tsx — width 48px, background #252525, vertical layout with 4px gap, 8px/4px padding; renders 6 tool buttons (Brush, Eraser, Fill, Eyedropper, Line, Selection) + divider + Undo/Redo action buttons using lucide-react icons; active tool highlighted with #4A9FD8 background via `useToolStore`; each button 36px x 36px with cornerRadius 6
- [x] T013 [P] [US1] Create 5 placeholder panel body components in src/components/panels/ — SourcesPanel.tsx, LayersPanel.tsx, ColorPanel.tsx, PalettePanel.tsx, ModelPreviewPanel.tsx; each displays its panel title as centered placeholder text in #666666; background #252525; each component accepts `IDockviewPanelProps` from dockview
- [x] T014 [P] [US1] Adapt CanvasViewport in src/components/canvas/CanvasViewport.tsx — wrap as a dockview-compatible component (accepting `IDockviewPanelProps` or wrapping existing component); ensure container div fills the dockview panel with `width: 100%` and `height: 100%`; verify `useResizeObserver` still detects size changes from dockview splitter resizing
- [x] T015 [US1] Create DockLayout component in src/components/shell/DockLayout.tsx — renders `DockviewReact` with `className="dockview-theme-dark"`, `disableFloating={true}`, `defaultTabComponent={PanelHeader}`; registers all 6 panel components; `onReady` callback builds default layout: Sources (left, 240px), Canvas (center), Layers (right, 280px), Color (below Layers), Palette (below Color), Model Preview (below Palette); hides canvas group header after layout is built
- [x] T016 [US1] Create AppShell component in src/components/shell/AppShell.tsx — vertical flex container (100vh): TitleBar (fixed 36px) + horizontal content area (ToolsSidebar fixed 48px + DockLayout fills remaining) + StatusBar (fixed 28px); background #1E1E1E
- [x] T017 [US1] Update src/App.tsx — replace current CanvasViewport + StatusBar layout with `<AppShell />`; update src/index.css — import dockview theme CSS from `./styles/dockview-theme.css`

**Checkpoint**: User Story 1 complete — launching the app shows the full default editor layout with all panels in correct positions

---

## Phase 4: User Story 2 — Rearrange Panels by Drag and Drop (Priority: P2)

**Goal**: User can grab a panel by its grip icon and drag it to a new position (left, right, above, below, or as a tab). Layout adjusts fluidly. Canvas always stays in center.

**Independent Test**: Drag the Layers panel header to the left dock alongside Sources. Verify it docks correctly, layout adjusts, and canvas remains central.

### Implementation for User Story 2

- [x] T018 [US2] Add drag-and-drop constraints in src/components/shell/DockLayout.tsx — handle dockview drop events to prevent panels from being dropped into the canvas group (use `onWillShowOverlay` or locked group API); verify that when a panel is dragged, visual drop indicators appear on valid targets; verify canvas panel cannot be dragged (hidden header already prevents this)
- [x] T019 [US2] Handle edge cases in src/components/shell/DockLayout.tsx — when all panels are moved out of a dock zone (e.g., right area emptied), verify the canvas expands to fill freed space; when a panel is dragged onto the canvas area, verify it gets rejected or redirected to a valid dock zone; set `minimumWidth` and `minimumHeight` constraints on dockview panels (e.g., min 120px wide, min 80px tall) so panels maintain viable dimensions when the window is resized very small (spec edge case: panels must not overlap or break layout)

**Checkpoint**: User Story 2 complete — panels can be freely rearranged while canvas remains locked in center

---

## Phase 5: User Story 4 — Dark Theme Consistency (Priority: P2)

**Goal**: All shell areas use a consistent dark color scheme matching the UI design files.

**Independent Test**: Visually compare the rendered application against the design reference (`ui-design` file). All backgrounds, text, borders, and icons match documented token values.

### Implementation for User Story 4

- [x] T020 [US4] Complete dockview dark theme overrides in src/styles/dockview-theme.css — override all dockview CSS variables: panel content area (#252525), tab/header bar (#2A2A2A), active tab indicator (#4A9FD8), sash/separator (#3A3A3A with 1px width), group header border (#3A3A3A), drag overlay colors; ensure tab text uses Inter 10px 600 #CCCCCC
- [x] T021 [US4] Verify text and icon color hierarchy across all components — titles #CCCCCC, primary text #E0E0E0, secondary #888888, muted #666666, dim #555555, icons #555555; fix any component that deviates from the design token reference in research.md

**Checkpoint**: User Story 4 complete — all shell areas visually consistent with dark theme

---

## Phase 6: User Story 3 — Persist and Restore Workspace Layout (Priority: P3)

**Goal**: User's panel arrangement survives application restarts. First launch uses default layout. Invalid saved data falls back gracefully.

**Independent Test**: Rearrange panels, close the application, reopen it. Verify layout is identical to the previous session.

### Implementation for User Story 3

- [x] T022 [US3] Create layout persistence store in src/store/layoutStore.ts — `saveLayout(api: DockviewApi)` function that serializes via `api.toJSON()`, wraps in `WorkspaceFile` (version + dockview data), and calls `saveWorkspaceLayout`; `loadLayout()` function that calls `loadWorkspaceLayout`, parses JSON, validates version field; `resetLayout()` that calls `saveWorkspaceLayout` with empty string or deletes file
- [x] T023 [US3] Integrate persistence into DockLayout in src/components/shell/DockLayout.tsx — in `onReady`: call `loadLayout()`, if valid use `api.fromJSON()` wrapped in try-catch (fallback to default layout on error); subscribe to `api.onDidLayoutChange` with debounced `saveLayout()` (300-500ms debounce to avoid excessive writes); dispose subscription on unmount; verify that splitter-resized dimensions (FR-014) are included in the serialized layout and restored correctly on reload
- [x] T024 [US3] Implement "Reset layout" action — add keyboard shortcut `Ctrl+Shift+R` (via useKeyboardShortcuts or new handler) that calls `resetLayout()` then rebuilds default layout via DockLayout; wire to the "View" menu label in TitleBar as a placeholder click handler
- [x] T025 [US3] Handle persistence edge cases in src/components/shell/DockLayout.tsx — if restored layout is missing any panel ID from `PANEL_IDS`, fallback to default layout; if `workspace.json` has incompatible version, fallback to default layout; if `fromJSON` throws, log warning, delete saved file, apply default layout
- [x] T026 [US3] Write tests for layout persistence store in src/store/layoutStore.test.ts — mock `invoke()` for `saveWorkspaceLayout` and `loadWorkspaceLayout`; test `saveLayout` serializes and calls invoke with correct JSON structure (version + dockview), test `loadLayout` parses valid JSON and returns layout, test `loadLayout` returns null on missing data, test `loadLayout` returns null on invalid/corrupted JSON, test `resetLayout` clears saved layout; follow existing store test patterns (editorStore.test.ts, toolStore.test.ts)

**Checkpoint**: User Story 3 complete — layout persists across sessions with graceful fallback, store fully tested

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final quality pass across all user stories

- [x] T027 [P] Run biome lint and format on all new and modified files — `npx biome check --write src/components/shell/ src/components/panels/ src/store/layoutStore.ts src/api/commands.ts src/styles/`
- [x] T028 Verify all acceptance scenarios from spec.md — check US1 default layout (SC-004), US2 drag-and-dock (SC-002), US3 persistence (SC-003), US4 theme consistency (SC-005), and render time (SC-001 < 2s)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001 for npm deps); T009 depends on T005 (workspace_io); T010 depends on T005
- **US1 (Phase 3)**: Depends on Phase 2 completion (panel constants, PanelHeader, API wrappers)
- **US2 (Phase 4)**: Depends on US1 (layout must exist to drag panels)
- **US4 (Phase 5)**: Depends on US1 (components must exist to style). Can run in parallel with US2.
- **US3 (Phase 6)**: Depends on US1 (layout must exist to persist). Can start after US1 independent of US2/US4.
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundational → US1 (no other story dependencies) — **MVP**
- **US2 (P2)**: US1 → US2 (needs panels to drag)
- **US4 (P2)**: US1 → US4 (needs components to style). Independent of US2.
- **US3 (P3)**: US1 → US3 (needs layout to persist). Independent of US2/US4.

### Within Each User Story

- Parallel [P] tasks can all start at once (different files)
- Sequential tasks depend on earlier tasks within the same phase
- DockLayout (T015) depends on all panel components (T013, T014)
- AppShell (T016) depends on TitleBar (T011), ToolsSidebar (T012), DockLayout (T015)
- App.tsx update (T017) depends on AppShell (T016)

### Parallel Opportunities

**Phase 2** (all [P] tasks can run in parallel):
- T005 (workspace_io) || T006 (constants) || T007 (PanelHeader) || T008 (API wrappers)
- T010 (workspace_io tests) runs after T005

**Phase 3** (parallel component creation):
- T011 (TitleBar) || T012 (ToolsSidebar) || T013 (panels) || T014 (CanvasViewport adapt)

**Phase 4+5** (US2 and US4 can run in parallel after US1)

---

## Parallel Example: User Story 1

```bash
# After Phase 2 is complete, launch all independent US1 components together:
Task T011: "Create TitleBar in src/components/shell/TitleBar.tsx"
Task T012: "Create ToolsSidebar in src/components/shell/ToolsSidebar.tsx"
Task T013: "Create 5 placeholder panels in src/components/panels/"
Task T014: "Adapt CanvasViewport in src/components/canvas/CanvasViewport.tsx"

# Then sequentially:
Task T015: "Create DockLayout" (needs T013 + T014)
Task T016: "Create AppShell" (needs T011 + T012 + T015)
Task T017: "Update App.tsx" (needs T016)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install deps, config)
2. Complete Phase 2: Foundational (backend persistence with tests, panel infra)
3. Complete Phase 3: User Story 1 (default layout)
4. **STOP and VALIDATE**: Launch app → all 6 panels visible in correct positions
5. Demo: full editor shell is functional

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Default layout works → **MVP complete**
3. US2 + US4 (parallel) → Panels draggable + theme polished
4. US3 → Layout persists across sessions (with store tests)
5. Polish → Final verification

### Parallel Team Strategy

With multiple developers after Phase 2:

- Developer A: US1 shell components (TitleBar, ToolsSidebar, panels)
- Developer B: US1 DockLayout + AppShell (after A provides components)
- After US1: Dev A takes US2 (DnD), Dev B takes US3 (persistence)
- US4 (theme) can be done by either

---

## Notes

- [P] tasks = different files, no dependencies on incomplete parallel tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable after US1 foundation
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- dockview handles most DnD and layout complexity — US2 is primarily constraint configuration
- Layout persistence uses raw JSON strings (no domain types) per Clean Architecture
