# Tasks: Project Scaffolding

**Input**: Design documents from `/specs/001-project-scaffolding/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: No tests requested for this scaffolding feature. Testing infrastructure (vitest) is deferred to a future feature.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create all configuration and dependency files needed before any source code can be written or compiled.

- [ ] T001 Create package.json with React 19, TypeScript 5, Vite 6, @tauri-apps/api, @tauri-apps/cli, zustand 5, and npm scripts (dev, build, tauri) at repo root
- [ ] T002 [P] Create src-tauri/Cargo.toml with tauri ^2.10, serde ^1, serde_json ^1, thiserror ^2, [lib] name="app_lib" crate-type=["staticlib","cdylib","rlib"], and [[bin]] section
- [ ] T003 [P] Create src-tauri/build.rs with tauri_build::build() call
- [ ] T004 [P] Create vite.config.ts with @vitejs/plugin-react, clearScreen: false, strictPort: true, server.watch.ignored: ["**/src-tauri/**"], Tauri env-based build targets
- [ ] T005 [P] Create tsconfig.json and tsconfig.node.json for TypeScript strict mode compilation

**Checkpoint**: All config files exist. `npm install` can run successfully.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tauri application configuration that MUST be in place before the app can compile or launch.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T006 Create src-tauri/tauri.conf.json with identifier "com.texlab.app", productName "TexLab", window config (title: "TexLab", 1280x800 default, 1024x768 minimum), build commands pointing to Vite
- [ ] T007 [P] Create src-tauri/capabilities/default.json with core:default permission scoped to main window
- [ ] T008 [P] Create src-tauri/icons/ directory with placeholder icon files required by Tauri build (icon.png, icon.ico at minimum)

**Checkpoint**: Tauri configuration complete. Source code implementation can begin.

---

## Phase 3: User Story 1 — Developer launches the application (Priority: P1) 🎯 MVP

**Goal**: A developer can clone the repo, install dependencies, run the app, and see a blank window titled "TexLab" that exits cleanly.

**Independent Test**: `npm install && npm run tauri dev` → window titled "TexLab" appears with blank page, no console errors. Close window → process exits cleanly.

### Implementation for User Story 1

- [ ] T009 [P] [US1] Create src-tauri/src/error.rs with AppError enum (no variants yet) implementing serde::Serialize
- [ ] T010 [P] [US1] Create src-tauri/src/state.rs with empty AppState struct wrapped in std::sync::Mutex
- [ ] T011 [US1] Create src-tauri/src/lib.rs with Tauri builder: manage(Mutex::new(AppState)), generate_handler![], import error and state modules only (architecture layers added in US2)
- [ ] T012 [US1] Create src-tauri/src/main.rs as thin desktop entry point calling app_lib::run() with windows_subsystem="windows" attribute
- [ ] T013 [P] [US1] Create index.html at repo root with Vite entry point referencing /src/main.tsx, title "TexLab"
- [ ] T014 [P] [US1] Create src/App.tsx as empty functional component returning an empty fragment
- [ ] T015 [US1] Create src/main.tsx with ReactDOM.createRoot rendering App in StrictMode
- [ ] T016 [US1] Verify: run `cargo build` from src-tauri/ (zero warnings) and `npm run build` from root (zero warnings)

**Checkpoint**: Application compiles and launches. Window titled "TexLab" appears with blank page. Clean exit on close. SC-001, SC-002, SC-005 validated.

---

## Phase 4: User Story 2 — Developer navigates the project structure (Priority: P2)

**Goal**: A developer exploring the repo finds a clear clean architecture layout with 5 backend layers and 4 frontend areas, each directory non-empty.

**Independent Test**: Open project in IDE, verify all expected directories exist with placeholder files. `cargo build` still compiles with zero warnings after adding module declarations.

### Implementation for User Story 2

- [ ] T017 [P] [US2] Create 5 backend architecture layer modules in src-tauri/src/: domain/mod.rs, use_cases/mod.rs, infrastructure/mod.rs, commands/mod.rs, mcp/mod.rs — each with a doc comment describing the layer's purpose
- [ ] T018 [US2] Add mod declarations for all 5 architecture layers in src-tauri/src/lib.rs (domain, use_cases, infrastructure, commands, mcp)
- [ ] T019 [P] [US2] Create 4 frontend directories with .gitkeep files: src/api/.gitkeep, src/components/.gitkeep, src/hooks/.gitkeep, src/store/.gitkeep
- [ ] T020 [US2] Verify: all directories from plan.md exist and are non-empty, `cargo build` still zero warnings (SC-003)

**Checkpoint**: Full directory structure in place. Architecture boundaries visible in IDE. SC-003 validated.

---

## Phase 5: User Story 3 — Developer understands project conventions (Priority: P3)

**Goal**: A new contributor finds documented conventions covering architecture pattern, directory roles, naming conventions, and how to add a new feature.

**Independent Test**: Read CONTRIBUTING.md and CLAUDE.md — both cover the required topics. No contradictions between the two documents.

### Implementation for User Story 3

- [ ] T021 [P] [US3] Create CONTRIBUTING.md at repo root covering: architecture pattern (clean architecture layers), directory roles (each dir's purpose), naming conventions (Rust + TypeScript), development guidelines (how to add a feature, commit conventions), and minimum toolchain versions (Rust ≥ 1.77, Node.js ≥ 20 LTS)
- [ ] T022 [US3] Review and update CLAUDE.md to ensure it covers all FR-005 requirements for AI agent context (architecture, directory purposes, key rules) — verify no contradictions with CONTRIBUTING.md (SC-004)

**Checkpoint**: Both conventions documents complete. SC-004 validated.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all user stories.

- [ ] T023 Run full quickstart.md verification checklist: app launches, clean exit, cargo build zero warnings, npm run build zero warnings, all directories non-empty, conventions docs complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on User Story 1 (needs lib.rs to exist for adding mod declarations)
- **User Story 3 (Phase 5)**: Can start after Foundational (no code dependencies), but best after US2 so conventions reflect final structure
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 (T011 lib.rs must exist before T018 adds mod declarations to it)
- **User Story 3 (P3)**: Can start after Foundational — independent of US1/US2, but recommended after US2 for accuracy

### Within Each User Story

- Rust files (error.rs, state.rs) before lib.rs (which imports them)
- lib.rs before main.rs (which calls it)
- App.tsx before main.tsx (which imports it)
- Implementation before verification

### Parallel Opportunities

**Phase 1** — all [P] tasks (T002-T005) can run in parallel after T001:
```
T001 (package.json) → T002, T003, T004, T005 in parallel
```

**Phase 2** — T007, T008 in parallel after T006:
```
T006 (tauri.conf.json) → T007, T008 in parallel
```

**Phase 3 (US1)** — Rust and frontend can progress in parallel:
```
Rust track:  T009 + T010 in parallel → T011 → T012
Front track: T013 + T014 in parallel → T015
Both tracks → T016 (verify)
```

**Phase 4 (US2)** — backend modules and frontend dirs in parallel:
```
T017 (backend modules) + T019 (frontend dirs) in parallel → T018 (wire lib.rs) → T020 (verify)
```

**Phase 5 (US3)** — T021 can start in parallel with US2 if needed:
```
T021 (CONTRIBUTING.md) + T022 (CLAUDE.md review) — sequential preferred for consistency
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (5 tasks)
2. Complete Phase 2: Foundational (3 tasks)
3. Complete Phase 3: User Story 1 (8 tasks)
4. **STOP and VALIDATE**: `npm run tauri dev` → window appears, blank page, clean exit
5. App is runnable — foundation for all future features

### Incremental Delivery

1. Setup + Foundational → Config files ready, `npm install` works
2. User Story 1 → App launches and runs (MVP!)
3. User Story 2 → Architecture visible in IDE, all dirs non-empty
4. User Story 3 → Conventions documented for contributors
5. Polish → Full validation pass

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in same phase
- [Story] label maps task to specific user story for traceability
- No test tasks included — testing infrastructure deferred to future feature
- Commit after each phase or logical group
- Stop at any checkpoint to validate story independently
- Total: 23 tasks across 6 phases
