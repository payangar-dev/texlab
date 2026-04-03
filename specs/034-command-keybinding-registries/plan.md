# Implementation Plan: Centralize keyboard shortcuts with Command + Keybinding registries

**Branch**: `034-command-keybinding-registries` | **Date**: 2026-04-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/034-command-keybinding-registries/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Replace all scattered `window.addEventListener("keydown", ...)` calls with a centralized **Command Registry** (declarative command definitions with metadata) and **Keybinding Registry** (key-to-command mappings with context-aware dispatch). This is a frontend-only infrastructure refactor — no Rust backend changes. All existing shortcuts continue to work identically, but are now discoverable, conflict-checked, and programmatically executable.

## Technical Context

**Language/Version**: TypeScript 5.7 (frontend only — no Rust changes)
**Primary Dependencies**: React 19, Zustand 5, @tauri-apps/api 2.10
**Storage**: N/A (user keybinding customization out of scope)
**Testing**: Vitest + jsdom
**Target Platform**: Windows / macOS / Linux desktop (Tauri v2)
**Project Type**: Desktop app (pixel art editor)
**Performance Goals**: Key dispatch < 1ms (instant feel, no perceptible latency)
**Constraints**: Must preserve all existing shortcut behavior exactly; space-to-pan hold behavior requires keyup tracking
**Scale/Scope**: ~25 commands, ~30 keybindings, 4 categories (Tools, Edit, View, Layers)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Clean Architecture | ✅ PASS | Frontend-only feature. No Rust layer changes. New `src/commands/` directory follows existing frontend organization. |
| II. Domain Purity | ✅ PASS | No Rust domain changes. Command/keybinding registries are frontend infrastructure. |
| III. Dual-Access State | ✅ PASS | Commands invoke existing Zustand store actions and Tauri IPC calls. No new state source — stores remain caches of Rust state. |
| IV. Test-First for Domain | ✅ PASS | Registry logic (registration, conflict detection, key normalization, context evaluation) will be unit-tested with Vitest. No DOM required for registry tests. |
| V. Progressive Processing | ✅ N/A | No texture conversion changes. |
| VI. Simplicity | ✅ PASS | Simple string-based context keys (not expression trees). `when` clauses are conjunctions of `key` or `!key`. No premature abstraction for future keybinding editor. |
| VII. Component-Based UI | ✅ PASS | Registries are app-level infrastructure consumed by the shell, not panel-specific. Dispatcher mounts at AppShell level. |

**Code Review Gates**:
- No `use` statements in domain/use_cases referencing external crates → N/A (frontend only)
- No Serialize/Deserialize on domain types → N/A
- No business logic in commands/ → N/A
- All domain functions covered by unit tests → Registry + dispatcher logic will have unit tests

**Gate result: PASS** — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/034-command-keybinding-registries/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
  commands/                        # NEW — Command & Keybinding system
    types.ts                       # Command, Keybinding, CommandContext types
    commandRegistry.ts             # CommandRegistry: register, get, list, conflict detection
    keybindingRegistry.ts          # KeybindingRegistry: key-to-command mapping
    context.ts                     # evaluateContext(): reads DOM state for context keys
    dispatcher.ts                  # useCommandDispatcher hook: single window listener
    definitions/
      tools.ts                     # Tool commands: brush, eraser, fill, eyedropper, line, selection, move, zoom
      edit.ts                      # Edit commands: undo, redo, brush size, color swap
      view.ts                      # View commands: zoom in/out/fit/reset, space-to-pan
      layers.ts                    # Layer commands: delete layer
      layout.ts                    # Layout commands: reset layout
    index.ts                       # initializeCommands(): registers all definitions

  hooks/
    useKeyboardShortcuts.ts        # REMOVED (replaced by dispatcher)

  components/
    canvas/CanvasViewport.tsx       # MODIFIED — remove useKeyboardShortcuts, add requestCanvasRedraw export
    layers/LayersPanel.tsx          # MODIFIED — remove global Delete keydown listener
    shell/DockLayout.tsx            # MODIFIED — remove global Ctrl+Shift+R keydown listener
    shell/AppShell.tsx              # MODIFIED — mount useCommandDispatcher at app level
```

**Structure Decision**: New `src/commands/` directory at the same level as existing `src/hooks/`, `src/store/`, `src/components/`. Command definitions are split by category for maintainability (~5-8 commands per file). The dispatcher is a single hook mounted once at AppShell level, replacing all 3 scattered global listeners.

## Complexity Tracking

> No constitution violations — this section is empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
