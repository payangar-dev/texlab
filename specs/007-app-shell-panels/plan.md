# Implementation Plan: App Shell with Dockable Panel System

**Branch**: `007-app-shell-panels` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-app-shell-panels/spec.md`

## Summary

Implement the complete TexLab editor shell using dockview as the panel layout engine. The shell consists of a custom title bar, a fixed tools sidebar, five dockable panels (Sources, Layers, Color, Palette, Model Preview), the canvas viewport as the permanent center area, and a status bar. Users can rearrange panels by drag-and-drop and resize dock zones via splitters. The workspace layout persists across sessions via Tauri commands writing to the app data directory.

## Technical Context

**Language/Version**: Rust >= 1.77 (backend), TypeScript ^5.7 (frontend)
**Primary Dependencies**: tauri ^2.10, react ^19.2, dockview ^5.2 (NEW), zustand ^5.0, lucide-react (NEW)
**Storage**: App data directory (`workspace.json`) via Tauri path API
**Testing**: vitest + @testing-library/react (frontend), cargo test (backend)
**Target Platform**: Windows, macOS, Linux (desktop via Tauri)
**Project Type**: Desktop application (Tauri v2)
**Performance Goals**: Shell renders < 2s (SC-001), drag-and-dock < 3s with visual feedback (SC-002)
**Constraints**: Dark theme per design files, panels always visible (no close/hide), canvas locked in center, dock only (no floating)
**Scale/Scope**: 5 dockable panels + canvas + title bar + sidebar + status bar

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Clean Architecture | PASS | Layout save/load commands in `commands/`, file I/O in `infrastructure/`. No domain logic needed — panel layout is a UI concern. |
| II. Domain Purity | PASS | No domain types affected. No new serde derives on domain types. |
| III. Dual-Access State | PASS | Layout state is frontend-only (dockview manages it). Editor state (textures, layers) remains in Rust `Mutex<AppState>` unchanged. |
| IV. Test-First | PASS | Layout store tests mock `invoke()`. Component tests for panels. Backend command tests with temp dir. |
| V. Progressive Processing | N/A | No asset conversion involved. |
| VI. Simplicity | PASS | Using dockview (zero-dep, proven library) instead of custom dock system. File-based persistence via two simple Tauri commands. |
| VII. Component-Based UI | PASS | Each panel is a self-contained React component with its own Zustand subscription. Custom panel header with grip + title per design. |

**Gate result**: ALL PASS — proceed to Phase 0.

**Post-Phase 1 re-check**: All principles still satisfied. Layout persistence uses Tauri app data directory (infrastructure layer). No domain types introduced. Panel components are independent and subscribe to their own state slices.

## Project Structure

### Documentation (this feature)

```text
specs/007-app-shell-panels/
  plan.md              # This file
  research.md          # Phase 0 output — decisions and rationale
  data-model.md        # Phase 1 output — entities and types
  quickstart.md        # Phase 1 output — dev setup and workflow
  contracts/
    ipc-commands.md    # Phase 1 output — Tauri IPC contracts for layout
  tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src-tauri/src/
  commands/
    layout_commands.rs       # NEW — save_workspace_layout, load_workspace_layout
    mod.rs                   # MODIFIED — export layout_commands, register in handler
  infrastructure/
    workspace_io.rs          # NEW — read/write workspace.json in app data dir
    mod.rs                   # MODIFIED — export workspace_io
  lib.rs                     # MODIFIED — register new commands in generate_handler!

src/
  components/
    shell/
      AppShell.tsx           # NEW — orchestrates: TitleBar + Content + StatusBar
      TitleBar.tsx           # NEW — custom title bar (app name, menu labels, window controls)
      ToolsSidebar.tsx       # NEW — fixed vertical strip with tool icons
      DockLayout.tsx         # NEW — DockviewReact wrapper, default layout builder, persistence
    panels/
      PanelHeader.tsx        # NEW — custom dockview tab component (grip icon + title, no close)
      SourcesPanel.tsx       # NEW — placeholder panel body
      LayersPanel.tsx        # NEW — placeholder panel body
      ColorPanel.tsx         # NEW — placeholder panel body
      PalettePanel.tsx       # NEW — placeholder panel body
      ModelPreviewPanel.tsx  # NEW — placeholder panel body
    canvas/
      CanvasViewport.tsx     # MODIFIED — adapt to work inside dockview panel container
    status-bar/
      StatusBar.tsx          # EXISTING — no changes expected
  store/
    layoutStore.ts           # NEW — save/load layout JSON via Tauri commands
  api/
    commands.ts              # MODIFIED — add saveWorkspaceLayout, loadWorkspaceLayout wrappers
  styles/
    dockview-theme.css       # NEW — dark theme overrides matching design colors
  App.tsx                    # MODIFIED — replace flex layout with AppShell
  index.css                  # MODIFIED — import dockview base CSS

src-tauri/
  tauri.conf.json            # MODIFIED — decorations: false for custom title bar
  capabilities/default.json  # MODIFIED — add path permissions for app data dir
```

**Structure Decision**: Follows existing Clean Architecture layout. New `shell/` directory groups the app chrome (title bar, sidebar, dock layout). New `panels/` directory holds dockable panel placeholder components. Layout persistence goes commands -> infrastructure with no domain involvement since layout is purely a UI concern.

## Complexity Tracking

| Deviation | Why Needed | Constitution Principle | Justification |
|-----------|------------|----------------------|---------------|
| FR-004 removes close/hide from panels | Spec FR-004: "Panels MUST NOT have a close/hide button; all panels are always visible." Spec clarification (2026-03-30) confirmed this. | VII. Component-Based UI — states "The docking framework manages minimize, close, and detach." | The constitution describes dockview's capabilities, not a mandate to expose all features to users. FR-004 is a deliberate product constraint: panels are always visible in this feature. Close/hide will be a separate feature per spec clarification. The docking framework still supports these operations internally — they are simply not exposed in the UI. |
| Workspace path uses Tauri app_data_dir | Cross-platform correctness requires platform-standard paths (Windows: %APPDATA%, macOS: ~/Library/Application Support, Linux: ~/.local/share). | VII. Component-Based UI — states "saved to ~/.texlab/workspace.json" | The `~/.texlab/` path was simplified notation. Using Tauri's `app_data_dir()` is the correct cross-platform approach. Documented in research.md Decision 3 with full rationale. |
