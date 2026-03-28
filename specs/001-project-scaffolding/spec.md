# Feature Specification: Project Scaffolding

**Feature Branch**: `001-project-scaffolding`
**Created**: 2026-03-28
**Status**: Draft
**Input**: GitHub Issue #1 — "Project scaffolding: Tauri v2 + React + Vite + TypeScript"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer launches the application for the first time (Priority: P1)

A developer clones the repository, installs dependencies, and runs the application. The app starts successfully and displays an empty window titled "TexLab". This confirms that the desktop application shell is functional and ready for feature development.

**Why this priority**: Without a working application shell, no subsequent feature can be developed or tested. This is the foundational prerequisite for all future work.

**Independent Test**: Run the application start command from a fresh clone; the app window appears with the correct title and no errors in the console.

**Acceptance Scenarios**:

1. **Given** a fresh clone of the repository with dependencies installed, **When** the developer starts the application, **Then** a desktop window titled "TexLab" appears without errors.
2. **Given** the application is running, **When** the developer inspects the window, **Then** the window displays a blank page (default background, no content) ready for future UI integration.
3. **Given** the application is running, **When** the developer closes the window, **Then** the application exits cleanly without orphaned processes.

---

### User Story 2 - Developer navigates the project structure (Priority: P2)

A developer opens the project in their IDE and finds a clear, well-organized directory structure. The backend follows a clean architecture pattern with distinct layers (domain logic, use cases, infrastructure, commands, MCP integration). The frontend follows a standard component-based structure. This predictable layout enables developers to find and place code without guessing.

**Why this priority**: A well-defined project structure establishes conventions that prevent architectural drift. Setting it right from the start avoids costly refactoring later.

**Independent Test**: Open the project in an IDE and verify that each folder exists in the expected location with its intended role documented.

**Acceptance Scenarios**:

1. **Given** the project is cloned, **When** a developer explores the backend source, **Then** they find separate directories for domain logic, use cases, infrastructure, commands, and MCP integration.
2. **Given** the project is cloned, **When** a developer explores the frontend source, **Then** they find separate directories for components, hooks, store, and API communication.
3. **Given** the project is cloned, **When** a developer reads the project conventions documents (`CLAUDE.md` and `CONTRIBUTING.md`), **Then** they understand the purpose of each directory and where to place new code.

---

### User Story 3 - Developer understands project conventions (Priority: P3)

A new contributor opens the project and finds conventions documents (`CLAUDE.md` and `CONTRIBUTING.md`) that document the project's architectural decisions, naming conventions, and development guidelines. This enables consistent contributions without requiring oral knowledge transfer.

**Why this priority**: Documented conventions reduce onboarding time and prevent style inconsistencies, but they depend on the project structure (P2) being in place first.

**Independent Test**: Read the conventions documents and verify they collectively cover architecture decisions, naming conventions, and contribution guidelines specific to this project.

**Acceptance Scenarios**:

1. **Given** a developer opens the project for the first time, **When** they read the conventions documents, **Then** they understand the architectural pattern used (clean architecture layers).
2. **Given** a developer wants to add new code, **When** they consult the conventions documents, **Then** they know which directory to place their code in and what naming conventions to follow.

---

### Edge Cases

- What happens when a required system dependency is missing (e.g., Rust toolchain not installed)? The build process should produce a clear error message indicating which dependency is missing.
- What happens when the developer runs the app on an unsupported platform? The build configuration should clearly state supported platforms.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST be initialized as a desktop application with a native backend and a web-based frontend.
- **FR-002**: The application MUST launch and display a window titled "TexLab" with default dimensions of 1280x800 (minimum 1024x768).
- **FR-003**: The backend source code MUST be organized into distinct layers: domain logic, use cases, infrastructure, commands, and MCP integration.
- **FR-004**: The frontend source code MUST be organized into distinct areas: components, hooks, state management, and API communication.
- **FR-005**: The project MUST include two conventions documents: a `CLAUDE.md` for AI agent context (architectural pattern, directory purposes, key rules) and a `CONTRIBUTING.md` for human contributors (naming conventions, development guidelines, how to add a new feature).
- **FR-006**: The project MUST include proper dependency management configuration for both the backend (Rust ≥ 1.77) and frontend (Node.js ≥ 20 LTS) ecosystems. Minimum toolchain versions MUST be documented in the conventions documents.
- **FR-007**: The application MUST exit cleanly when the window is closed, without leaving orphaned processes.
- **FR-008**: The project MUST support a library build target for the backend, enabling unit testing of core logic independently from the application shell.

### Key Entities

- **Application Shell**: The native desktop window that hosts the frontend. Configured with app name, default dimensions, and window behavior.
- **Project Structure**: The directory layout that enforces architectural boundaries between domain, use cases, infrastructure, commands, and MCP layers.
- **Conventions Documents**: Two complementary files — `CLAUDE.md` (AI-facing architectural context) and `CONTRIBUTING.md` (human-facing contribution guidelines). Both codify the same architectural decisions but serve different audiences.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can go from a fresh clone to a running application in under 5 minutes (excluding dependency download time).
- **SC-002**: The application window appears within 10 seconds of running the start command on a standard development machine.
- **SC-003**: 100% of the defined directory structure exists and is non-empty (containing at least a placeholder or module declaration).
- **SC-004**: The conventions documents (`CLAUDE.md` and `CONTRIBUTING.md`) collectively cover at least: architecture pattern, directory roles, naming conventions, and how to add a new feature.
- **SC-005**: The project builds successfully with zero warnings from `cargo build` (Rust) and `npm run build` (frontend). Stricter linting (clippy, tsc --noEmit) is deferred to a future CI/quality feature.

## Clarifications

### Session 2026-03-28

- Q: Quel artefact incarne le "conventions file" de FR-005 ? → A: Les deux — CLAUDE.md pour les agents IA, CONTRIBUTING.md pour les contributeurs humains.
- Q: Que doit afficher la fenêtre au lancement (scaffolding) ? → A: Page totalement vide (fond par défaut, zéro contenu).
- Q: Versions minimales requises pour Rust et Node.js ? → A: Rust ≥ 1.77, Node.js ≥ 20 LTS.
- Q: Périmètre de "zero warnings" (SC-005) ? → A: `cargo build` + `npm run build` (compilation des deux côtés).

## Assumptions

- The target development environment has the Rust toolchain (≥ 1.77) and Node.js runtime (≥ 20 LTS) pre-installed.
- This is the first feature of the project; there is no existing application code to integrate with.
- The UI design referenced in `ui-design/` at the repo root will inform future features but is not required for this scaffolding step.
- The MCP directory in the backend structure is a placeholder for future AI integration and does not need functional code at this stage.
- Windows is the primary development platform, but the project should not include platform-specific workarounds that would prevent future cross-platform support.
- The label `milestone:foundation` indicates this is Phase 0 work — the absolute minimum needed to begin feature development.
