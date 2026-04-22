---
description: "Task list for 011-palette-panel"
---

# Tasks: Palette Panel (create, load, save, switch, scopes)

**Input**: Design documents from `/specs/011-palette-panel/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Required. TexLab constitution Principle IV (Test-First for Domain) mandates unit tests for domain and use-case logic; frontend tests mock `invoke()`. Every domain/use-case/infra task below includes its own unit tests in the same file.

**Organization**: Grouped by user story. US1 (P1) is the MVP. US2–US4 can be delivered incrementally after the Foundational phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no open dependency on in-flight tasks)
- **[Story]**: US1/US2/US3/US4 — maps to spec.md user stories
- File paths are absolute from the repo root

## Path Conventions

Tauri v2 desktop app with Rust backend + React frontend:

- Backend: `src-tauri/src/{domain,use_cases,infrastructure,commands}`
- Frontend: `src/{api,store,components,commands}`
- Rust tests: colocated in `#[cfg(test)] mod tests` inside each file
- Infra fixtures: `src-tauri/tests/fixtures/`
- Frontend tests: colocated `*.test.ts(x)` files (vitest)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — fixtures, dependency bumps, directory skeletons.

- [X] T001 Add `serde_json = "1"` explicitly to `src-tauri/Cargo.toml` under `[dependencies]` (currently only available transitively via `tauri`)
- [X] T002 [P] Create fixture `src-tauri/tests/fixtures/palette_valid.texpal` — version 1, id `2f0c1e4b8a1e4cfe9aab04d611ebbe49`, name "Nether Tones", 4 hex colors
- [X] T003 [P] Create fixture `src-tauri/tests/fixtures/palette_malformed.texpal` — truncated JSON (missing closing `}`) for FR-021 tests
- [X] T004 [P] Create fixture `src-tauri/tests/fixtures/palette_wrong_version.texpal` — valid JSON but `"version": 2`
- [X] T005 [P] Create empty directory `src/components/palette/` with a `.gitkeep` so later tasks can add files into it

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain layer, port, filesystem I/O, base `PaletteService`, state plumbing, and the minimum Tauri commands + frontend store required to *read* palettes and *switch* the active one. No user story can start until this phase is complete.

**⚠️ CRITICAL**: Blocks Phases 3–6.

### Domain (`src-tauri/src/domain/`)

- [X] T006 Create module shell `src-tauri/src/domain/palette.rs` and register it in `src-tauri/src/domain/mod.rs` (add `pub mod palette;`)
- [X] T007 [P] Implement `PaletteName` newtype in `src-tauri/src/domain/palette.rs` with private field, `new(raw: &str)` returning `Result<Self, DomainError>`, NFC normalization, 1–64 length bounds, whitespace rejection + inline `#[cfg(test)]` unit tests
- [X] T008 [P] Implement `PaletteId(u128)` in `src-tauri/src/domain/palette.rs` with `new_v4()`, `from_hex(&str)`, `to_hex_string()` (32-char zero-padded) + unit tests
- [X] T009 [P] Implement `PaletteScope` enum (`Global`, `Project`) with `Copy + Eq + Hash` in `src-tauri/src/domain/palette.rs` + unit tests
- [X] T010 [P] Add `from_hex_rgb(&str) -> Result<Color, DomainError>` and `to_hex_rgb(&self) -> String` methods to `src-tauri/src/domain/color.rs` + unit tests (round-trip, case tolerance, bad input rejection). This is shared by import/export and `add_color_to_active_palette`.
- [X] T011 Implement `Swatch`, `Palette`, `AddColorOutcome` in `src-tauri/src/domain/palette.rs` — `Palette::new`, `add_color` (force `a=255`, dedupe → `AddColorOutcome::{Added,AlreadyPresent}`), `remove_color_at`, `remove_color`, `rename`, `colors()`, `len`, `is_empty` + unit tests covering FR-011 dedupe, ordering, out-of-range removal
- [X] T012 Extend `src-tauri/src/domain/error.rs` `DomainError` with `InvalidInput { reason: String }` (used by `PaletteName::new`, `Color::from_hex_rgb`)
- [X] T013 Export new types from `src-tauri/src/domain/mod.rs` — `pub use palette::{Palette, Swatch, PaletteName, PaletteId, PaletteScope, AddColorOutcome};`
- [X] T014 Add `PaletteStore` trait to `src-tauri/src/domain/ports.rs` — `list`, `read`, `write`, `delete` returning `Result<_, DomainError>` — with an in-memory `HashMapPaletteStore` test double in the existing `#[cfg(test)]` block (used by later `PaletteService` tests)

### Infrastructure (`src-tauri/src/infrastructure/`)

- [X] T015 [P] Implement `.texpal` codec in `src-tauri/src/infrastructure/palette_file.rs` — private `TexpalFile` struct with serde derives, `encode(&Palette) -> Result<String, AppError>`, `decode(&str) -> Result<Palette, AppError>` enforcing `version == 1`, dedupe + warn log on duplicate colors, reject empty/oversized names, reject bad hex + unit tests using the three fixtures from Phase 1
- [X] T016 [P] Implement `palette-state.json` codec in `src-tauri/src/infrastructure/palette_state_io.rs` — read/write an `ActiveMemoryFile { version, global: Option<String>, projects: HashMap<String,String> }`, atomic write via `.tmp + rename`, graceful recovery on missing/corrupt + unit tests in `tempfile`-style temp dirs
- [X] T017 [P] Implement `FilesystemPaletteStore` in `src-tauri/src/infrastructure/palette_store_fs.rs` — construct from a directory path, build filename via the sanitization rules in research.md §5, implement all `PaletteStore` methods + unit tests (round-trip, name-collision suffixing, list returns stable order)
- [X] T018 Register new infra modules in `src-tauri/src/infrastructure/mod.rs` (`pub mod palette_file; pub mod palette_state_io; pub mod palette_store_fs;`)

### Use cases (`src-tauri/src/use_cases/`)

- [X] T019 Create `src-tauri/src/use_cases/palette_service.rs` with `PaletteService` owning `global: Box<dyn PaletteStore + Send + Sync>`, `project: Option<Box<dyn PaletteStore + Send + Sync>>`, `active: ActiveMemory`. Implement `list_all`, `read`, `set_active_palette(Option<PaletteId>)`, `set_project_store`, `clear_project_store`. Include unit tests using the in-memory `PaletteStore` double from T014. Cover FR-023a fallback ordering (project-first alphabetical, then global alphabetical) when the remembered id is missing.
- [X] T020 Register `pub mod palette_service;` in `src-tauri/src/use_cases/mod.rs`

### State + commands (`src-tauri/src/{state,commands}`)

- [X] T021 Extend `src-tauri/src/state.rs` `AppState` with `palette_service: Option<PaletteService>` (populated in T025's `setup(...)` closure — `None` until then because `PaletteService` requires an `app_data_dir`-derived path at construction) and `current_project_path: Option<PathBuf>` (defaults to `None`). Add a `palette_service_mut() -> Result<&mut PaletteService, AppError>` accessor mirroring the existing `editor_mut()` pattern, returning `AppError::Internal("palette service not initialized")` when `None`.
- [X] T022 Append `PaletteDto`, `PaletteScopeDto` (as `String` alias via serde) and `PaletteListDto` to `src-tauri/src/commands/dto.rs` per contracts/commands.md — camelCase rename, `From<&Palette>` conversion (scope → lowercase string, colors → hex via `Color::to_hex_rgb`)
- [X] T023 Create `src-tauri/src/commands/palette_commands.rs` with `get_palettes` and `set_active_palette` Tauri commands and a shared `emit_state_changed` call on the latter (use existing helper in `commands/mod.rs`). Include a `build_palette_list_dto` helper that sorts project-first alphabetical then global alphabetical and sets `canCreateProjectPalette`.
- [X] T024 Register `pub mod palette_commands; pub use palette_commands::*;` in `src-tauri/src/commands/mod.rs`
- [X] T025 Wire `lib.rs` — instantiate the global `FilesystemPaletteStore` rooted at `app.path().app_data_dir()?.join("palettes")` via a `setup(|app| …)` closure, construct `PaletteService`, replace `AppState::default()` with the populated state, and register `get_palettes` + `set_active_palette` in `tauri::generate_handler![]`

### Frontend foundational (`src/`)

- [X] T026 [P] Add `PaletteDto`, `PaletteScopeDto`, `PaletteListDto` TypeScript types and `getPalettes()` / `setActivePalette(id: string | null)` wrappers to `src/api/commands.ts`
- [X] T027 [P] Add hex helpers `hexToColorDto(hex: string): ColorDto` and `colorDtoToHex(color: ColorDto): string` in a new `src/utils/colorHex.ts` + colocated `colorHex.test.ts` (round-trip, case tolerance, alpha drop)
- [X] T028 Create `src/store/paletteStore.ts` — Zustand store mirroring `PaletteListDto` (`palettes`, `activePaletteId`, `canCreateProjectPalette`, `pipetteActive: false`) with `refreshState()` action and the same `state-changed` listener pattern as `editorStore`
- [X] T029 [P] Add `src/store/paletteStore.test.ts` with `invoke()` mocked — cover `refreshState` population and clearing
- [X] T030 Initialize the palette store listener in `src/components/shell/AppShell.tsx` next to the existing editor-store init (call `initPaletteListener()` + initial `refreshState()`)

**Checkpoint**: `getPalettes()` returns the seeded palette from `<app_data_dir>/palettes/palette_valid.texpal`; `setActivePalette(id)` round-trips through `state-changed`. User stories may now proceed in parallel.

---

## Phase 3: User Story 1 — Use an existing palette to paint (Priority: P1) 🎯 MVP

**Goal**: Open the Palette panel, pick a palette from the dropdown, left/right-click swatches to drive the primary/secondary colors, and paint on the canvas with exactly those colors.

**Independent Test**: Seed `<app_data_dir>/palettes/` with a single fixture palette. Launch the app. Without ever using keyboard shortcuts, open the panel, select the palette in the dropdown, left-click a swatch, paint on the canvas — the pixels must equal that swatch byte-for-byte. (Quickstart §US1 — maps to SC-001.)

### Tests for US1

- [X] T031 [P] [US1] Create `src/components/palette/PaletteDropdown.test.tsx` — mounts dropdown, asserts palettes are rendered and selecting one calls the passed `onSelect` with the correct id
- [X] T032 [P] [US1] Create `src/components/palette/SwatchGrid.test.tsx` — renders ordered swatches, left-click and right-click fire the expected `toolStore` mutation, active primary/secondary indicators render when the color matches

### Implementation for US1

- [X] T033 [P] [US1] Implement `src/components/palette/PaletteDropdown.tsx` — plain select/listbox listing palettes (label only for now; scope icons land in US3) with controlled `activePaletteId` and `onSelect(id)`
- [X] T034 [P] [US1] Implement `src/components/palette/SwatchGrid.tsx` — ordered grid of color tiles rendered from `palette.colors` hex strings; `onMouseDown` branches on `button === 0|2` to write `toolStore.activeColor` / `secondaryColor`; adds a primary/secondary ring when the tile's color equals the corresponding slot
- [X] T035 [US1] Rewrite `src/components/panels/PalettePanel.tsx` from the current placeholder — compose `PaletteDropdown` + `SwatchGrid`, read from `paletteStore`, render "No palettes — create one" empty state when list is empty, render "This palette has no swatches" when `activePalette.colors.length === 0`
- [X] T036 [US1] Prevent context menu from eating right-click inside `SwatchGrid.tsx` (`onContextMenu={e => e.preventDefault()}`)

**Checkpoint**: US1 ships the "use palettes I already have" experience. Verifiable against the seeded fixture from Phase 1.

---

## Phase 4: User Story 2 — Build a palette by capturing colors (Priority: P2)

**Goal**: Create named palettes, append colors via pipette-from-canvas or current-primary-color, and remove colors via the Delete key.

**Independent Test**: Click *New Palette*, name it, confirm → add one pipette color + one primary-color swatch, Delete one → the remaining swatch is what we expect. (Quickstart §US2 — maps to SC-002.)

### Tests for US2

- [X] T037 [P] [US2] Extend `#[cfg(test)] mod tests` in `src-tauri/src/use_cases/palette_service.rs` — cover create (rejects duplicate name within a scope, auto-selects the created palette), rename (duplicate rejection), delete (auto-reselect next available via FR-023a), add_color dedupe (`AddColorOutcome::AlreadyPresent`), remove_color_at bounds
- [X] T038 [P] [US2] Add `src/components/palette/NewPaletteDialog.test.tsx` — name validation errors are surfaced inline, submit fires callback with `{ name }` (scope prop arrives in US3)
- [X] T039 [P] [US2] Add `src/store/paletteStore.test.ts` cases — `setPipetteActive(true)` then `tool change` → resets to `false`; `setPipetteActive(true)` then `Escape` command → resets to `false`; two consecutive `PaletteActionBar` pipette-button clicks round-trip `false → true → false` (FR-010 re-click exit)
- [X] T040 [P] [US2] Add `src/components/panels/PalettePanel.test.tsx` — clicking *Add Primary* calls `addColorToActivePalette` with the current primary hex; pressing Delete removes the swatch equal to the primary via `remove_color_from_active_palette_at`

### Backend implementation for US2

- [X] T041 [US2] Extend `src-tauri/src/use_cases/palette_service.rs` with `create_palette(name, scope)` (enforces unique `PaletteName` per scope — byte-exact compare on Unix, case-insensitive compare gated on `#[cfg(target_os = "windows")]` to match NTFS semantics; writes to the appropriate store; auto-sets active), `rename_palette(id, new_name)` (re-serializes the `.texpal` with the new name, keeps the `PaletteId`, and deletes the previous file *only if* its sanitized basename differs from the new one — research.md §5), `delete_palette(id)` (triggers the FR-023a reselect), `add_color_to_active_palette(color)` returning `AddColorOutcome`, `remove_color_from_active_palette_at(index)`. Unit tests cover the Windows-vs-Unix fork via `#[cfg(target_os)]`-guarded cases. Blocks T042/T043.
- [X] T042 [US2] Extend `src-tauri/src/commands/palette_commands.rs` with `create_palette`, `rename_palette`, `delete_palette`, `add_color_to_active_palette`, `remove_color_from_active_palette_at` per contracts/commands.md, emitting `state-changed` on each. Map `DomainError::InvalidInput` → `AppError::Validation("invalid-palette-name:<reason>")`, existing-name conflict → `"duplicate-palette-name"`, missing id → `"palette-not-found"`, parse errors on hex → `"invalid-color-hex"`, missing active palette → `"no-active-palette"`, out-of-range → `"palette-index-out-of-range"`. Wrap `std::io::Error` from filesystem calls as `AppError::Internal(format!("io-error:{reason}"))` so the frontend classifier in T077 can match the `io-error:<reason>` code documented in contracts/commands.md.
- [X] T043 [US2] Append `AddColorResultDto` to `src-tauri/src/commands/dto.rs` (camelCase, includes post-mutation `PaletteDto`)
- [X] T044 [US2] Register the five new commands in `src-tauri/src/lib.rs` `generate_handler![]`

### Frontend implementation for US2

- [X] T045 [P] [US2] Add api wrappers in `src/api/commands.ts` — `createPalette(name, scope)`, `renamePalette(id, newName)`, `deletePalette(id)`, `addColorToActivePalette(hex)`, `removeColorFromActivePaletteAt(index)` (scope param can default to `"global"` until US3 wires the selector)
- [X] T046 [P] [US2] Implement `src/components/palette/NewPaletteDialog.tsx` — modal with text input, live validation mirroring `PaletteName` rules, submit + cancel buttons; default scope="global" (scope selector added in US3)
- [X] T047 [P] [US2] Implement `src/components/palette/RenamePaletteDialog.tsx` — same pattern as NewPaletteDialog, pre-fills the current name
- [X] T048 [P] [US2] Implement `src/components/palette/PaletteActionBar.tsx` — horizontal bar with *New*, *Rename*, *Delete*, *Pipette*, *Add Primary* buttons (Save/Load land as disabled placeholders here — enabled in US4). Uses `lucide-react` icons: `Plus`, `Pencil`, `Trash2`, `Pipette`, `Palette`. The *Pipette* button is a **toggle**: each click flips `paletteStore.pipetteActive` (FR-010 re-click exit path). The button renders in its "active" visual style when `pipetteActive === true`.
- [X] T049 [US2] Wire `PaletteActionBar` into `src/components/panels/PalettePanel.tsx` above the dropdown; handlers call the api wrappers and open the dialogs; delete flow shows an inline confirm popover (no OS dialog)
- [X] T050 [US2] Extend `src/store/paletteStore.ts` with `pipetteActive` toggles — `setPipetteActive(bool)`, subscribe to `toolStore.activeToolType` changes and reset to `false` on any transition
- [X] T051 [US2] Intercept canvas press in `src/components/canvas/CanvasViewport.tsx` — when `paletteStore.getState().pipetteActive` is true: read the composite pixel at `(x, y)`, convert to hex, call `addColorToActivePalette`, short-circuit the active tool. Visually flash the clicked swatch on `added === false` by passing the result to `SwatchGrid` via a one-shot pulse prop (see T053).
- [X] T052 [US2] Create `src/commands/definitions/palette.ts` registering two commands: `palette.deleteActiveSwatch` (reads active palette + `toolStore.activeColor`, finds the index, calls `removeColorFromActivePaletteAt`; no-op if no match — FR-012) and `palette.exitPipette` (sets `pipetteActive = false`). Bind `Delete` → `palette.deleteActiveSwatch`, `Escape` → `palette.exitPipette`. Import and call its registration function from `src/commands/index.ts`.
- [X] T053 [US2] Add a brief pulse animation in `src/components/palette/SwatchGrid.tsx` keyed off `AddColorResultDto.added === false` — pulses the swatch at `index`. Implement as a keyframe + ref-based class toggle.

**Checkpoint**: Users can author palettes end-to-end within the app.

---

## Phase 5: User Story 3 — Scope routing: global vs. project (Priority: P2)

**Goal**: Scope the creation, listing, and active-palette memory of palettes to global vs. current project. Differentiate scopes visually in the dropdown. Disable project-scope operations when no project is open.

**Independent Test**: Create one palette in each scope (with `current_project_path` set via the stub command from T054), close the project → only the global one is listed; reopen the project → both appear with distinct scope icons. (Quickstart §US3 — maps to SC-004/SC-005/SC-008.)

### Tests for US3

- [X] T054 [P] [US3] Extend `#[cfg(test)] mod tests` in `src-tauri/src/use_cases/palette_service.rs` — (a) `set_project_store` then create a project palette → `list_all` contains both, project-first alphabetical; (b) `clear_project_store` → only global palettes listed; (c) `set_active_palette` tracks per-project memory independently; (d) after clearing and restoring the same project, the remembered project palette is reactivated; (e) *stale-cache defeat* — write a palette directly into the in-memory test store (simulating an out-of-band file edit), then call `set_project_store` with that same store and verify `list_all` returns the new entry even if the service had been operating on a previous snapshot
- [X] T055 [P] [US3] Add `src/components/palette/PaletteDropdown.test.tsx` cases asserting the scope icon renders (`aria-label` for global vs. project) in front of each row
- [X] T056 [P] [US3] Add `src/components/palette/NewPaletteDialog.test.tsx` case — when `canCreateProjectPalette === false` the project radio is disabled with a title tooltip

### Backend implementation for US3

- [X] T057 [US3] Extend `src-tauri/src/use_cases/palette_service.rs` `ActiveMemory` with a per-project map and the full FR-023a fallback chain (research.md §6). Persist via the `palette-state.json` codec (T016). When `set_project_store(store)` is called, invalidate any cached project-scope palette state and re-`list()` from the new store so that files modified behind the service's back (edge case "Concurrent edits to a project palette from outside the app") are picked up on project re-open.
- [X] T058 [US3] Add `set_current_project_path(path: Option<String>)` Tauri command in `src-tauri/src/commands/palette_commands.rs` that (a) updates `AppState.current_project_path`, (b) instantiates or clears `PaletteService.project`, (c) triggers the active-palette restore, (d) emits `state-changed`. Register in `lib.rs`. (Stub for the future project subsystem — documented as such in a file-level Rustdoc comment.)
- [X] T059 [US3] Reject project-scope mutation paths when `current_project_path.is_none()` in `create_palette`, `import_palette` (returns `AppError::Validation("no-project-open")`). Verified by T054.
- [X] T060 [US3] Update `build_palette_list_dto` (T023) to combine both stores and set `canCreateProjectPalette` from `current_project_path.is_some()`

### Frontend implementation for US3

- [X] T061 [P] [US3] Extend `src/components/palette/PaletteDropdown.tsx` — render a `Globe` (global) or `FolderClosed` (project) icon from `lucide-react` next to each palette row, with `aria-label` set accordingly
- [X] T062 [P] [US3] Extend `src/components/palette/NewPaletteDialog.tsx` — scope radio group (`global` / `project`), disabled + tooltip when `canCreateProjectPalette === false`. Thread the selected scope through the `onSubmit` handler to `createPalette`.
- [X] T063 [US3] Add `setCurrentProjectPath(path: string | null)` wrapper in `src/api/commands.ts` — documented as "dev stub until project system lands; call from the browser devtools to exercise US3 manually"
- [X] T064 [US3] Thread `canCreateProjectPalette` from `paletteStore` into `PaletteActionBar` (disable any project-specific affordances) and `NewPaletteDialog`

---

## Phase 6: User Story 4 — Save and load palettes as files (Priority: P3)

**Goal**: Export the active palette to a `.texpal` file and import a `.texpal` file into a chosen scope, with full conflict resolution (Cancel / Rename / Overwrite). Reject malformed files with a clear message.

**Independent Test**: Save → delete → load → round-trip a palette, then load it again → conflict dialog appears with *Rename* default and behaves per FR-020a. (Quickstart §US4 — maps to SC-006 / SC-007.)

### Tests for US4

- [X] T065 [P] [US4] Extend `#[cfg(test)] mod tests` in `src-tauri/src/use_cases/palette_service.rs` — export→in-memory-read round-trip, import success with explicit id preservation, import with `strategy=None` on collision returns the sentinel validation error containing `palette-name-collision:<id>:<suggested>`, each branch of `ImportStrategy::{Cancel, Rename, Overwrite}`
- [X] T066 [P] [US4] Extend `#[cfg(test)] mod tests` in `src-tauri/src/infrastructure/palette_file.rs` — round-trip via `palette_valid.texpal`, `decode` rejects `palette_malformed.texpal` (parse error string contains `"invalid-palette-file"`), `decode` rejects `palette_wrong_version.texpal`
- [X] T067 [P] [US4] Add `src/components/palette/ImportConflictDialog.test.tsx` — *Rename* is default and focused, suggested name is editable, each action fires the correct strategy callback
- [X] T068 [P] [US4] Add `src/components/palette/PaletteActionBar.test.tsx` — clicking *Save* opens the dialog stub, clicking *Load* after a collision opens `ImportConflictDialog`, malformed-file error path surfaces a toast

### Backend implementation for US4

- [X] T069 [US4] Add `ImportStrategy` (Rust enum tagged `action`: `Cancel | Rename { new_name } | Overwrite`) to `src-tauri/src/use_cases/palette_service.rs`. Implement `export_palette(id, dest_path)` and `import_palette(source_path, scope, strategy)` with suggested-name generation (`"<name> (2)"` → `(3)` …, bounded to 999).
- [X] T070 [US4] Add `export_palette` and `import_palette` Tauri commands in `src-tauri/src/commands/palette_commands.rs`. `import_palette` returns the `palette-name-collision:<existing-id>:<suggested-name>` validation error when `strategy: None` hits a collision. Add `ImportStrategyDto` to `src-tauri/src/commands/dto.rs` (tagged union matching the frontend shape).
- [X] T071 [US4] Register `export_palette`, `import_palette` in `src-tauri/src/lib.rs`

### Frontend implementation for US4

- [X] T072 [P] [US4] Add api wrappers `exportPalette(id, destinationPath)` and `importPalette(sourcePath, scope, strategy?)` + `ImportStrategyDto` TypeScript type to `src/api/commands.ts`
- [X] T073 [P] [US4] Implement `src/components/palette/ImportConflictDialog.tsx` — three-action dialog per FR-020a, default *Rename* with editable suggestion, returns `ImportStrategyDto` to caller
- [X] T074 [P] [US4] Implement scope-picker dialog `src/components/palette/ImportScopeDialog.tsx` — minimal radio global/project, disables project when `canCreateProjectPalette === false`
- [X] T075 [US4] Enable the *Save* button in `src/components/palette/PaletteActionBar.tsx` — opens `@tauri-apps/plugin-dialog` `save` with `{ filters: [{ name: "TexLab Palette", extensions: ["texpal"] }], defaultPath: "<palette-name>.texpal" }`, calls `exportPalette` on confirm, logs/toasts any error
- [X] T076 [US4] Enable the *Load* button in `src/components/palette/PaletteActionBar.tsx` — opens `@tauri-apps/plugin-dialog` `open` with the `.texpal` filter, opens `ImportScopeDialog` to pick destination, calls `importPalette`. On rejection matching `palette-name-collision:<id>:<suggested>`, parse the payload, open `ImportConflictDialog`, re-invoke `importPalette` with the chosen strategy. Re-loop if the user's renamed value also collides.
- [X] T077 [US4] Centralize palette-error mapping in a new `src/api/paletteErrors.ts` that classifies `AppError` strings into `{ kind: "collision" | "malformed" | "nameInvalid" | "duplicate" | "generic", … }` + colocated `paletteErrors.test.ts`
- [X] T078 [US4] Surface malformed-file toasts within ≤ 2 s (SC-007) from the Load handler using the classification from T077 — lightweight toast helper (inline styled `div`, no new library)

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T079 [P] Run `specs/011-palette-panel/quickstart.md` end-to-end (US1 → US2 → US3 → US4 + edge cases) and fix any gaps discovered
- [X] T080 [P] Measure palette-switch latency with 256 swatches (SC-003) — profile once in the browser devtools; if over budget, memoize `SwatchGrid` rows by color string
- [X] T081 [P] Update `CLAUDE.md` "Key Concepts" section with a Palette Panel + `.texpal` entry (1–2 lines)
- [X] T082 Remove any residual `#![allow(dead_code, unused_imports)]` in new modules and confirm `cargo clippy --all-targets` is clean for the new crate paths
- [X] T083 Confirm `dialog:default` and `core:path:default` capability grants in `src-tauri/capabilities/default.json` still cover all palette I/O paths (no changes expected — verify and document)

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: no dependencies — start immediately.
- **Phase 2 (Foundational)**: depends on Phase 1. **Blocks all user stories.**
- **Phase 3 (US1, P1, MVP)**: depends on Phase 2 only.
- **Phase 4 (US2, P2)**: depends on Phase 2. Can run in parallel with US3/US4 if staffed.
- **Phase 5 (US3, P2)**: depends on Phase 2. Touches `NewPaletteDialog.tsx` and `PaletteDropdown.tsx` — coordinate with US2 if both are in flight concurrently on those files.
- **Phase 6 (US4, P3)**: depends on Phase 2. Touches `PaletteActionBar.tsx` — merges cleanly after US2 creates the component.
- **Phase 7 (Polish)**: depends on at least US1 being complete; US2–US4 tasks in Phase 7 require their respective phases.

### Within a phase

- Rust: `domain` → `use_cases` → `commands` → `lib.rs registration`.
- Frontend: `api wrappers` → `paletteStore` → components → `PalettePanel` wiring.
- Tests are written alongside the implementation they cover (constitution Principle IV).

### Parallel opportunities

- Phase 1: T002/T003/T004 and T005 can run in parallel (different files).
- Phase 2 domain: T007/T008/T009/T010 can run in parallel (all in `palette.rs` but different structs — split commits by struct, or batch them into a single commit).
- Phase 2 infrastructure: T015/T016/T017 live in three different files → fully parallel.
- Phase 2 frontend: T026/T027 are parallel; T028 follows T026; T029 can run in parallel with T028.
- **After Phase 2 completes, US1–US4 can each be owned by a different engineer.**
- Within US1: T031/T032 (tests) and T033/T034 (components) are pairwise parallel.
- Within US2: T037/T038/T039/T040 are independent tests; T045/T046/T047/T048 are independent component files.
- Within US4: T065/T066/T067/T068 are independent tests; T072/T073/T074 are independent component files.

---

## Parallel Example: User Story 1

```bash
# After Phase 2 is green (cargo test + vitest both pass), kick off US1 in parallel:

# Engineer A — tests first
#   Task T031: src/components/palette/PaletteDropdown.test.tsx
#   Task T032: src/components/palette/SwatchGrid.test.tsx

# Engineer B — component shells
#   Task T033: src/components/palette/PaletteDropdown.tsx
#   Task T034: src/components/palette/SwatchGrid.tsx

# Then serialize:
#   Task T035: wire into PalettePanel.tsx
#   Task T036: disable context menu in SwatchGrid

# Verification:
pnpm test -- paletteDropdown SwatchGrid PalettePanel
pnpm tauri dev
# → Select the seeded fixture palette; paint with primary; confirm byte-exact pixel match.
```

---

## Implementation Strategy

1. **MVP first**: ship Phase 1 + Phase 2 + Phase 3 (US1). That alone delivers "use pre-existing palettes to paint" — the core value per the spec rationale.
2. **Authoring loop**: add Phase 4 (US2) so users can build palettes inside the app without external tooling.
3. **Scope routing**: add Phase 5 (US3). Note: full manual exercise requires the T058 stub until the project subsystem ships.
4. **Portability**: add Phase 6 (US4) for export/import and conflict handling.
5. **Polish**: Phase 7 wraps up quickstart validation, perf, docs, and warning cleanup.

Each phase ends in a checkpoint that is independently demo-able and testable.

---

## Task totals

- **Setup (Phase 1)**: 5 tasks
- **Foundational (Phase 2)**: 25 tasks (T006–T030)
- **US1 (Phase 3)**: 6 tasks (T031–T036)
- **US2 (Phase 4)**: 17 tasks (T037–T053)
- **US3 (Phase 5)**: 11 tasks (T054–T064)
- **US4 (Phase 6)**: 14 tasks (T065–T078)
- **Polish (Phase 7)**: 5 tasks (T079–T083)
- **Grand total**: **83 tasks**

All tasks follow the required checklist format: `- [ ] TNNN [P?] [Story?] description with file path`.
