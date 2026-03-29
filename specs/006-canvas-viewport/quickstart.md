# Quickstart: Canvas Viewport

**Feature**: 006-canvas-viewport
**Date**: 2026-03-29

## Prerequisites

- Node.js >= 20 LTS, Rust >= 1.77, Tauri CLI >= 2.10
- All previous features merged (especially #5 PNG I/O and Tauri commands)

## Development Setup

```bash
# Install frontend dependencies (no new packages needed for this feature)
npm install

# Run in development mode
npm run tauri dev
```

## Key Files to Create

### Frontend (src/)

```
src/
├── store/
│   └── viewportStore.ts          # NEW: Viewport zoom/pan state
├── components/
│   └── canvas/
│       ├── CanvasViewport.tsx     # NEW: Main canvas component
│       ├── useCanvasRenderer.ts   # NEW: Imperative rendering hook
│       ├── useViewportControls.ts # NEW: Zoom/pan/pointer handlers
│       ├── constants.ts           # NEW: ZOOM_LEVELS table, thresholds
│       └── math.ts               # NEW: Coordinate conversion utilities
│   └── status-bar/
│       └── StatusBar.tsx          # NEW: Status bar component
├── hooks/
│   ├── useKeyboardShortcuts.ts   # NEW: Global keyboard shortcut handler
│   └── useResizeObserver.ts      # NEW: Container resize observer
└── App.tsx                        # MODIFY: Add CanvasViewport + StatusBar layout
```

### Backend (src-tauri/)

No backend changes required. All existing commands (`get_composite`, tool commands, `get_editor_state`) are sufficient.

## Architecture Notes

- **No new npm packages** -- this feature uses only HTML5 Canvas 2D API + existing React/Zustand stack.
- **No new Rust code** -- purely frontend feature consuming existing Tauri commands.
- **Viewport state** lives in a separate Zustand store (`viewportStore`), NOT in the existing `editorStore`. The editor store mirrors Rust state; viewport is frontend-only.
- **Canvas rendering** is fully imperative (via refs), not declarative React. The component mounts the `<canvas>` element once and never re-renders for drawing updates.

## Testing Strategy

- **viewportStore**: Unit tests with vitest -- test zoom in/out stepping, fit-to-viewport calculation, pan clamping logic.
- **Coordinate math**: Unit tests for screen-to-texture and texture-to-screen conversion functions.
- **Canvas rendering**: Manual testing -- verify pixel-perfect rendering, grid visibility, cursor preview, checkerboard pattern.
- **Integration**: Open a texture via `openTexture()`, verify canvas displays it, zoom/pan, draw with tools, verify canvas updates.

## Verification Checklist

- [ ] Texture renders pixel-perfect (no blurring) on canvas
- [ ] Zoom in/out with scroll wheel, centered on cursor
- [ ] Zoom keyboard shortcuts (Ctrl+=, Ctrl+-, Ctrl+0, Ctrl+1)
- [ ] Pan with middle-click drag
- [ ] Pan with space+left-click drag
- [ ] Pixel grid appears at >= 400% zoom
- [ ] Checkerboard pattern behind transparent pixels
- [ ] Status bar shows coordinates, dimensions, zoom %
- [ ] Cursor preview shows tool area of effect
- [ ] Canvas adapts to container resize
- [ ] Canvas updates on tool draw / undo / redo
- [ ] Empty state when no texture loaded
