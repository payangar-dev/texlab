# Implementation Plan: Tool Bar + Tool Input Handling + Keyboard Shortcuts

**Branch**: `008-toolbar-input-shortcuts` | **Date**: 2026-03-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/008-toolbar-input-shortcuts/spec.md`

## Summary

Deliver a complete tool interaction system: a toolbar with 8 tools, a contextual tool options bar, single-key keyboard shortcuts for tool switching and actions, and enhanced mouse input handling (continuous strokes with throttling, Shift+Click lines, Line tool live preview). Much of the foundation already exists — the plan focuses on completing the missing pieces and polishing the interaction model.

## Technical Context

**Language/Version**: Rust ≥ 1.77 (backend), TypeScript ^5.7 (frontend)
**Primary Dependencies**: tauri ^2.10, react ^19.2, zustand ^5.0, lucide-react (icons)
**Storage**: N/A (all state in-memory, Rust `Mutex<AppState>`)
**Testing**: `cargo test` (domain unit tests), vitest (frontend — not yet configured, deferred)
**Target Platform**: Desktop (Windows, macOS, Linux) via Tauri v2
**Project Type**: Desktop application
**Performance Goals**: <50ms input-to-visual feedback, continuous strokes at 60fps
**Constraints**: No pixel gaps in strokes, responsive tool switching
**Scale/Scope**: Single-user desktop app, 8 tools, ~15 keyboard shortcuts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gate

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Clean Architecture | ✅ PASS | New tool options stay in domain (ToolContext). Options bar is frontend. Commands delegate to use_cases. |
| II. Domain Purity | ✅ PASS | ToolContext changes use only std types (f32 for opacity). No serde on domain types. |
| III. Dual-Access State | ✅ PASS | Tool selection is UI interaction state (frontend toolStore). Backend receives tool params per-invocation. Pipette composite sampling handled at EditorService level. |
| IV. Test-First for Domain | ✅ REQUIRED | New domain logic (opacity blending in BrushTool, composite color pick in EditorService) must have unit tests. |
| V. Progressive Processing | ✅ N/A | No asset conversion involved. |
| VI. Simplicity | ✅ PASS | No over-engineering: options bar is a flat component, shortcuts are a keydown handler, throttle uses rAF. BrushSize max expanded from 16→32. |
| VII. Component-Based UI | ✅ PASS | ToolOptionsBar is a new self-contained component in the shell layout. |

## Project Structure

### Documentation (this feature)

```text
specs/008-toolbar-input-shortcuts/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── tool-commands.md # Tauri IPC contract changes
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (new and modified files)

```text
src-tauri/src/
  domain/
    tools/
      mod.rs               # MODIFY: expand BrushSize max (16→32), add opacity to ToolContext
      brush.rs             # MODIFY: apply opacity blending in stamp()
    layer_stack.rs         # READ ONLY: composite() already exists, used for Pipette composite
  use_cases/
    editor_service.rs      # MODIFY: add pick_color_composite() for Pipette composite mode
  commands/
    tool_commands.rs       # MODIFY: add opacity param, handle Pipette composite mode
    dto.rs                 # MODIFY: add opacity to tool invocation

src/
  components/
    shell/
      ToolsSidebar.tsx     # MODIFY: add Move/Zoom placeholders, disabled state when no texture
      ToolOptionsBar.tsx   # NEW: contextual options bar per active tool
      AppShell.tsx         # MODIFY: integrate ToolOptionsBar in layout
    canvas/
      useViewportControls.ts  # MODIFY: Shift+Click, rAF throttle, mid-stroke finalization
      useCanvasRenderer.ts    # MODIFY: Line tool live preview overlay
      math.ts                 # MODIFY: add bresenhamLine() for frontend preview
  hooks/
    useKeyboardShortcuts.ts   # MODIFY: add tool shortcuts (B/E/G/I/L/M/V/Z), [/], X swap
  store/
    toolStore.ts              # MODIFY: add secondaryColor, opacity, pipetteMode, swapColors(), ToolType expansion
```

## Complexity Tracking

No constitution violations — no entries needed.

## What Already Exists (Gap Analysis)

The following is already implemented and does NOT need rework:

| Capability | Status | Location |
|-----------|--------|----------|
| Toolbar with 6 tools (brush, eraser, fill, eyedropper, line, rectangle) | ✅ Done | `ToolsSidebar.tsx` |
| Active tool highlighting | ✅ Done | `ToolsSidebar.tsx` — accent color |
| Single active tool | ✅ Done | `toolStore.activeToolType` |
| Left-click → tool press/drag/release cycle | ✅ Done | `useViewportControls.ts` |
| Backend tool trait with Bresenham interpolation | ✅ Done | `domain/tools/` — BrushTool, EraserTool |
| Undo snapshot on stroke complete | ✅ Done | `EditorService.apply_tool_release()` |
| Canvas render loop with cursor preview | ✅ Done | `useCanvasRenderer.ts` |
| Zoom/pan keyboard shortcuts (Ctrl+0/1/+/-) | ✅ Done | `useKeyboardShortcuts.ts` |
| Space-hold pan mode | ✅ Done | `useViewportControls.ts` |

### What's Missing (Scope of This Plan)

| Requirement | FR | Effort |
|------------|-----|--------|
| Add Move and Zoom tool placeholders in toolbar | FR-001 | S |
| Rename "rectangle" → "selection" in frontend | FR-001 | S |
| Tool options bar (brush size, opacity, pipette mode) | FR-004, FR-005 | M |
| Disabled tools when no texture | FR-014 | S |
| Keyboard shortcuts for tool selection (B/E/G/I/L/M/V/Z) | FR-010 | S |
| `[`/`]` for brush size adjustment | FR-011 | S |
| `X` for primary/secondary color swap | FR-012 | S |
| Shortcut suppression in text inputs | FR-013 | S |
| Shift+Click straight line drawing | FR-009 | M |
| Input throttling at ~16ms (rAF gating) | FR-007 | S |
| Mid-stroke tool switch finalization | FR-016 | S |
| Line tool live preview on drag | FR-017 | M |
| Pipette composite vs active layer sampling | FR-018 | M |
| Brush opacity support | FR-004 | M |
| Expand BrushSize max from 16 to 32 | — | S |
| Secondary color in toolStore | FR-012 | S |
