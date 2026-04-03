# Feature Specification: Centralize keyboard shortcuts with Command + Keybinding registries

**Feature Branch**: `034-command-keybinding-registries`  
**Created**: 2026-04-03  
**Status**: Draft  
**Input**: GitHub issue #34 — Centralize keyboard shortcuts with Command + Keybinding registries

## User Scenarios & Testing *(mandatory)*

### User Story 1 - All shortcuts handled by a single registry (Priority: P1)

A user presses keyboard shortcuts (tool selection, undo/redo, zoom, etc.) and they are dispatched through a centralized command system instead of scattered `window.addEventListener` calls. All existing shortcuts continue to work exactly as before, but are now declarative entries in a registry rather than inline handler code.

**Why this priority**: This is the foundational behavior — without a centralized dispatcher, nothing else works. It replaces the current fragmented approach while preserving existing functionality.

**Independent Test**: Can be tested by verifying every existing shortcut still works identically after the migration, and that all commands are registered in a single discoverable registry.

**Acceptance Scenarios**:

1. **Given** the application is loaded with a texture open, **When** the user presses `B`, **Then** the brush tool is selected (same as current behavior), dispatched through the command registry
2. **Given** the application is loaded, **When** the user presses `Ctrl+Z`, **Then** undo is triggered through the command system
3. **Given** the application is loaded, **When** the user presses `Ctrl+Shift+R`, **Then** the layout resets through the command system
4. **Given** the application is loaded, **When** the user presses `Delete`, **Then** the active layer is removed through the command system (if more than one layer exists)
5. **Given** all commands are registered, **When** a developer inspects the registry, **Then** every application-level shortcut is listed with its metadata (label, category, default keybinding)

---

### User Story 2 - Shortcuts suppressed in text input contexts (Priority: P2)

A user is typing in a text field (e.g., renaming a layer, entering a hex color value) and presses a key that is normally a shortcut (e.g., `B` for brush, `E` for eraser). The shortcut is NOT triggered because the dispatcher recognizes the input context and suppresses global shortcuts.

**Why this priority**: Without context-aware suppression, the centralized dispatcher would break text input across the application. This is essential for usability.

**Independent Test**: Can be tested by focusing a text input, pressing shortcut keys, and verifying no commands fire.

**Acceptance Scenarios**:

1. **Given** the user is renaming a layer (text input focused), **When** the user types `B`, **Then** the character `B` is inserted into the text field and the brush tool is NOT selected
2. **Given** the user is editing a hex color input, **When** the user types `E`, **Then** the character `E` is inserted and the eraser tool is NOT selected
3. **Given** a modal dialog is open, **When** the user presses shortcut keys, **Then** global shortcuts are suppressed
4. **Given** no text field is focused and no dialog is open, **When** the user presses `B`, **Then** the brush tool is selected normally

---

### User Story 3 - Conflict detection at registration time (Priority: P3)

A developer registers two commands with the same keybinding. The system detects this conflict at registration time and reports it, preventing ambiguous shortcut behavior.

**Why this priority**: Conflict detection prevents subtle bugs as the application grows and more commands are added. It is a developer-facing safeguard, not user-facing.

**Independent Test**: Can be tested by attempting to register two commands with the same key combination and verifying a conflict warning is raised.

**Acceptance Scenarios**:

1. **Given** a command is registered with keybinding `Ctrl+S`, **When** another command attempts to register with the same keybinding `Ctrl+S`, **Then** a conflict is detected and reported (warning/error)
2. **Given** two commands have different `when` context clauses but the same key, **When** they are registered, **Then** no conflict is reported (same key is allowed in different contexts)

---

### User Story 4 - Commands are discoverable with metadata (Priority: P3)

Each registered command carries metadata — a human-readable label, a category (e.g., "Tools", "Edit", "View", "Layers"), and its default keybinding. This metadata is queryable so a future keybinding editor or command palette can list all available commands.

**Why this priority**: Discoverability is the strategic goal that enables future features (keybinding editor, command palette). It does not change user behavior now but is essential for the long-term architecture.

**Independent Test**: Can be tested by querying the registry for all commands and verifying each has a label, category, and default keybinding.

**Acceptance Scenarios**:

1. **Given** all commands are registered, **When** the registry is queried for commands in the "Tools" category, **Then** all tool selection commands (brush, eraser, fill, etc.) are returned with their labels and keybindings
2. **Given** all commands are registered, **When** the registry is queried for all categories, **Then** categories such as "Tools", "Edit", "View", "Layers" are returned

---

### Edge Cases

- What happens when a keybinding uses a modifier key that differs across operating systems (Ctrl on Windows/Linux vs Cmd on macOS)?
- What happens when the user presses a key that matches no registered command?
- What happens when a command is triggered but its precondition is not met (e.g., Delete layer when only one layer exists)?
- What happens when a `contentEditable` element is focused — are shortcuts suppressed?
- What happens when multiple key events fire rapidly (e.g., holding a key down)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a command registry where each command is identified by a unique string ID
- **FR-002**: Each command MUST carry metadata: a human-readable label, a category, and an optional description
- **FR-003**: System MUST provide a keybinding registry that maps key combinations to command IDs
- **FR-004**: Each keybinding MUST support modifier keys (Ctrl/Cmd, Shift, Alt) and accept platform-agnostic notation (e.g., `Mod` for Ctrl on Windows/Cmd on macOS)
- **FR-005**: System MUST provide a single centralized dispatcher that intercepts keyboard events and routes them to the matching command
- **FR-006**: The dispatcher MUST replace all existing scattered `window.addEventListener("keydown", ...)` listeners for application-level shortcuts
- **FR-007**: The dispatcher MUST support context-aware suppression via `when` clauses (e.g., "not in text input", "editor focused", "layer panel focused")
- **FR-008**: The dispatcher MUST suppress global shortcuts when a text input, textarea, or contentEditable element is focused, unless the keybinding explicitly opts in
- **FR-009**: System MUST detect and report keybinding conflicts at registration time — two commands with the same key combination and overlapping `when` contexts
- **FR-010**: Local UI interactions (F2/Enter/Escape in layer rename) MUST remain as inline React event handlers — they are NOT part of the global registry
- **FR-011**: All existing application-level shortcuts MUST be migrated to the new system with identical behavior: tool selection (B, E, G, I, L, M, V, Z), brush size ([ / ]), color swap (X), undo/redo (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y), zoom (Ctrl+=, Ctrl+-, Ctrl+0, Ctrl+1), space-to-pan, layout reset (Ctrl+Shift+R), and layer delete (Delete)
- **FR-012**: Commands MUST be executable programmatically (not only via keyboard), to support a future command palette
- **FR-013**: A command MUST be able to define a precondition (e.g., "at least 2 layers exist") that is checked before execution

### Key Entities

- **Command**: An action that can be triggered — has a unique ID, label, category, optional description, an execute function, and an optional precondition
- **Keybinding**: A mapping between a key combination (key + modifiers) and a command ID, with an optional `when` context clause
- **Context**: The current application state relevant to shortcut dispatch — whether a text input is focused, which panel is active, whether a dialog is open

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing application-level shortcuts work identically after migration — zero regressions
- **SC-002**: All commands are listed in a single registry with label, category, and default keybinding — no shortcuts exist outside the registry
- **SC-003**: Typing in any text input field does not trigger any global shortcut
- **SC-004**: Registering two commands with the same keybinding and overlapping context produces a detectable conflict warning
- **SC-005**: A developer can add a new command and keybinding in a single declarative registration call, without writing event listener boilerplate

## Assumptions

- This feature is a developer-facing infrastructure refactor — no new user-visible shortcuts are added
- A user-facing keybinding editor is explicitly out of scope (issue states this)
- A command palette UI is out of scope — only the programmatic execution capability is required
- Platform-agnostic key notation (e.g., `Mod` for Ctrl/Cmd) follows industry conventions similar to VS Code
- The `when` clause system uses simple string-based context keys, not arbitrary expressions
- The space-to-pan shortcut requires keydown AND keyup tracking (hold behavior), which the dispatcher must support
- Depends on the existing tool store, viewport store, and layer management commands already in place
