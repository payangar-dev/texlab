# Implementation Plan: Color Panel (HSV Picker + Hex Input)

**Branch**: `009-color-panel` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-color-panel/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Implement a dockable Color panel providing a 2D HSV gradient picker, a hex input field with live preview, and primary/secondary color slots with swap functionality. This is a **frontend-only feature** — the color state already exists in the Zustand `toolStore` (`activeColor`, `secondaryColor`, `swapColors`). No new Rust backend commands are required. The panel replaces the existing `ColorPanel` placeholder component.

## Technical Context

**Language/Version**: TypeScript ^5.7 (frontend only — no Rust changes)
**Primary Dependencies**: React ^19.2, Zustand ^5.0, dockview ^5.2
**Storage**: N/A (in-memory Zustand store — color state is not persisted to disk)
**Testing**: vitest (frontend unit tests for color conversion utils and store logic)
**Target Platform**: Desktop (Windows, macOS, Linux via Tauri v2)
**Project Type**: Desktop app (Tauri)
**Performance Goals**: Real-time color updates during gradient drag (60 fps pointer tracking)
**Constraints**: Color updates must be reflected across the entire panel within the same interaction frame (SC-004)
**Scale/Scope**: Single-user pixel art editor, single Color panel instance

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Clean Architecture | ✅ PASS | Frontend-only feature. No domain/use_cases changes. No layer boundary crossings. |
| II. Domain Purity | ✅ PASS | No domain type changes. Color conversion utilities are frontend helpers, not domain types. |
| III. Dual-Access State | ⚠️ JUSTIFIED | Color state lives in Zustand only, not Rust `AppState`. This is the existing pattern — tools receive color as a command parameter. MCP access to active color can be added later if needed. See [research.md](./research.md) Decision 1. |
| IV. Test-First for Domain | ✅ PASS | No domain changes. Frontend color utils will have unit tests. |
| V. Progressive Processing | ✅ N/A | No file I/O involved. |
| VI. Simplicity | ✅ PASS | Canvas 2D rendering (no WebGL). Direct pixel sampling (no complex math for picking). Simple HSV↔RGB conversion functions. |
| VII. Component-Based UI | ✅ PASS | Color panel is a self-contained dockable panel with its own state subscription. Follows existing panel pattern. |

## Project Structure

### Documentation (this feature)

```text
specs/009-color-panel/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── panels/
│   │   └── ColorPanel.tsx          # Panel wrapper (existing placeholder → real impl)
│   └── color/                      # NEW — Color panel internals
│       ├── HsvGradient.tsx         # 2D gradient canvas with pointer interaction
│       ├── HexInput.tsx            # HEX label + hex code input with validation
│       └── ColorSlots.tsx          # Primary/secondary color squares + swap icon (inline in input row)
├── store/
│   └── toolStore.ts                # MODIFIED — add activeSlot state
├── hooks/
│   └── useKeyboardShortcuts.ts     # EXISTING — X shortcut already implemented
└── utils/                          # NEW directory
    └── color.ts                    # HSV↔RGB↔Hex conversion utilities
```

**Structure Decision**: All color panel UI lives under `src/components/color/` as sub-components, composed by the existing `ColorPanel.tsx` panel wrapper. Color conversion utilities go in `src/utils/color.ts` for reuse by future features (e.g., Palette panel). The `toolStore` gains an `activeSlot` field to track which color slot is being edited.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| III. Dual-Access — color in Zustand only | Color is UI-level state; tools receive it as a parameter. Adding Rust commands would be over-engineering (Principle VI). | Rust `AppState` color storage adds unnecessary IPC roundtrips for every gradient drag. MCP access is not in scope for this feature. |
