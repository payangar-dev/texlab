# Implementation Plan: Canvas Viewport

**Branch**: `006-canvas-viewport` | **Date**: 2026-03-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-canvas-viewport/spec.md`

## Summary

Implement the main editing surface for TexLab: an HTML5 Canvas 2D viewport that renders composite RGBA pixel data from the Rust backend with nearest-neighbor scaling, supports integer-step zoom (25%-12800%) centered on cursor, pan via middle-click or space+drag, a pixel grid overlay at high zoom, tool cursor preview, checkerboard transparency indication, and real-time status bar feedback. This is a purely frontend feature -- no new Rust backend code is needed.

## Technical Context

**Language/Version**: TypeScript ^5.7 (frontend), React ^19.2
**Primary Dependencies**: React 19, Zustand 5, @tauri-apps/api ^2.10 (existing -- no new packages)
**Storage**: N/A (viewport state is ephemeral, frontend-only)
**Testing**: vitest ^4.1 + jsdom ^29 (already in devDependencies)
**Target Platform**: Desktop (Windows/macOS/Linux via Tauri v2 WebView)
**Project Type**: Desktop app (Tauri v2)
**Performance Goals**: 60fps for zoom/pan/draw interactions; each zoom step renders in <16ms
**Constraints**: Integer zoom levels only; textures 16x16 to 1024x1024; no WebGL (Canvas 2D per constitution)
**Scale/Scope**: ~10 new files, ~1200-1500 lines of TypeScript

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Clean Architecture | PASS | Purely frontend feature. No domain/use_cases changes. Consumes existing Tauri commands via typed `api/commands.ts` wrappers. |
| II. Domain Purity | PASS | No domain type modifications. No serde derives added. |
| III. Dual-Access State | PASS | Viewport state is frontend-only (zoom/pan). Backend state access via existing `getComposite()` and `getEditorState()`. MCP mutations trigger `state-changed` event which the canvas listens to. |
| IV. Test-First for Domain | PASS | No domain changes. Frontend tests: viewportStore unit tests + coordinate math unit tests via vitest. |
| V. Progressive Processing | N/A | No texture conversion involved. |
| VI. Simplicity | PASS | Canvas 2D (not WebGL). Full-frame redraw (not dirty-rect). Snapshot zoom levels (not continuous). No external canvas libraries. |
| VII. Component-Based UI | PASS | CanvasViewport and StatusBar are self-contained components. Viewport state in dedicated Zustand store. |

### Post-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Clean Architecture | PASS | New files: `src/store/viewportStore.ts`, `src/components/canvas/*`, `src/components/status-bar/*`, `src/hooks/*`. All frontend layer. No backend changes. |
| II. Domain Purity | PASS | No changes to `src-tauri/src/domain/`. |
| III. Dual-Access State | PASS | Canvas listens to `state-changed` events from Rust (covers both frontend tool operations and MCP server mutations). `viewportStore` is frontend-only, no dual-access needed. |
| IV. Test-First for Domain | PASS | `viewportStore` actions covered by unit tests. Coordinate math functions covered by unit tests. Canvas rendering verified manually. |
| V. Progressive Processing | N/A | |
| VI. Simplicity | PASS | Offscreen canvas + drawImage pipeline (simplest correct approach for pixel data). No over-engineering: no WebGL, no canvas library, no web worker, no partial update tracking. |
| VII. Component-Based UI | PASS | `CanvasViewport` is a self-contained panel component. `StatusBar` is independent. Each subscribes to relevant stores. |

**All gates PASS. No violations.**

## Project Structure

### Documentation (this feature)

```text
specs/006-canvas-viewport/
├── plan.md              # This file
├── research.md          # Phase 0 output -- rendering pipeline, zoom algorithms, patterns
├── data-model.md        # Phase 1 output -- ViewportState, CursorState, ZoomLevels, InteractionMode
├── quickstart.md        # Phase 1 output -- setup, key files, testing strategy
├── contracts/
│   ├── tauri-ipc.md     # Existing Tauri commands consumed (no new ones)
│   └── component-api.md # React component interfaces, store API, hooks, event flow
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── App.tsx                          # MODIFY: add CanvasViewport + StatusBar layout
├── store/
│   ├── editorStore.ts               # EXISTING (no changes)
│   └── viewportStore.ts             # NEW: zoom, pan, container size
├── components/
│   └── canvas/
│       ├── CanvasViewport.tsx        # NEW: main canvas component
│       ├── useCanvasRenderer.ts      # NEW: offscreen canvas + drawImage + overlays
│       ├── useViewportControls.ts    # NEW: pointer/wheel/pan handlers
│       ├── constants.ts              # NEW: ZOOM_LEVELS, GRID_THRESHOLD, colors
│       └── math.ts                   # NEW: coordinate conversions, zoom-to-cursor
│   └── status-bar/
│       └── StatusBar.tsx             # NEW: coordinates, dimensions, zoom display
├── hooks/
│   ├── useKeyboardShortcuts.ts      # NEW: Ctrl+=/-/0/1, space key tracking
│   └── useResizeObserver.ts         # NEW: ResizeObserver on container div

src-tauri/
  (no changes)
```

**Structure Decision**: Follows existing repo layout. Canvas components grouped under `components/canvas/`. Status bar under `components/status-bar/`. Shared hooks under `hooks/`. Viewport store alongside existing editor store.

## Key Design Decisions

### Rendering Pipeline (R-001, R-002, R-003)

Two-stage pipeline:
1. **Offscreen canvas** (texture-sized): `putImageData()` to write raw RGBA from `CompositeDto`
2. **Display canvas** (container-sized): `drawImage(offscreen)` with `ctx.setTransform(zoom, 0, 0, zoom, panX, panY)` and `imageSmoothingEnabled = false`

This gives GPU-accelerated nearest-neighbor scaling. The offscreen canvas only updates when composite data changes; the display canvas redraws on every zoom/pan change.

### Zoom Levels (R-013)

20 discrete integer-multiple levels:
```
25%, 33%, 50%, 100%, 200%, 300%, 400%, 500%, 600%, 800%,
1000%, 1200%, 1600%, 2000%, 2400%, 3200%, 4800%, 6400%, 9600%, 12800%
```

Scroll wheel steps through adjacent entries. Keyboard shortcuts step ±1 entry.

### Zoom-to-Cursor (R-014)

Standard offset correction: `newPan = cursorScreen - (cursorScreen - oldPan) * (newZoom / oldZoom)`

### Viewport State (R-010)

Dedicated `viewportStore` (Zustand), separate from `editorStore`. Canvas subscribes via transient pattern (`store.subscribe()`) to avoid React re-renders during pan/zoom. Status bar uses normal selector hook.

### Pixel Grid (R-016)

Visible at >= 4x zoom. Progressive opacity: 0.2 at 4x, increasing to ~0.5 at 16x+. Color: `rgba(128, 128, 128, alpha)`.

### Pan Constraints (R-017)

Unconstrained when zoomed in past viewport. Locked/centered when texture fits entirely within viewport (per spec Story 3, Scenario 4).

### Checkerboard (R-006)

2x2 offscreen canvas → `createPattern('repeat')`. Dark theme colors: `#333333` / `#444444`. Drawn in texture space (scales with zoom).

### HiDPI (R-005)

Canvas backing store scaled by `devicePixelRatio`. Transform includes DPR factor. `image-rendering: pixelated` CSS reinforcement.

## Complexity Tracking

No constitution violations. No complexity justifications needed.

## UI Design Reference

The UI design (Pencil `.pen` file at `ui-design`) shows:

- **Canvas Viewport** (node `B4e3j`): Dark background `#2D2D2D`, contains tab bar, options bar, and pixel grid area
- **Pixel Grid** (node `EBCKB`): 380x380 at offset (200, 88), background `#8B8B8B`, grid lines `#55555544`, border `#555555`
- **Tab bar**: Texture icon + name + dirty indicator + close button
- **Options bar**: Active tool name + brush size selector
- **Namespace label**: Texture path in mono font (`Geist Mono`, 9px, `#666666`)
- **Status Bar** (node `Yh4j0`): Height 28px, background `#161616`, padding 0/12
  - Position: `X: 7  Y: 3` (`Geist Mono`, 10px, `#888888`)
  - Dimensions: `16 × 16` (same font/color)
  - Zoom: `3200%` (same font/color)
  - Spacer (fill)
  - MCP status: green dot + `MCP :3847`

**Note**: Tab bar, options bar, and namespace label are UI elements visible in the design but may be implemented in a later feature (tab management, options bar). This feature focuses on the canvas rendering surface, zoom/pan, grid, cursor preview, and status bar.
