# Quickstart: Tool Bar + Tool Input Handling + Keyboard Shortcuts

**Feature Branch**: `008-toolbar-input-shortcuts`
**Date**: 2026-03-30

## Prerequisites

- Rust ≥ 1.77, Node.js ≥ 20 LTS
- Tauri v2 CLI: `cargo install tauri-cli --version ^2`
- All dependencies from previous features installed

## Development Setup

```bash
git checkout 008-toolbar-input-shortcuts
cd apps/texture-lab
npm install
cargo tauri dev
```

## Implementation Order

The recommended implementation sequence follows dependency order:

### Phase 1: Backend Changes (Rust)

1. **Expand BrushSize** — `domain/tools/mod.rs`: change range from `1..=16` to `1..=32`, update tests
2. **Add opacity to ToolContext** — `domain/tools/mod.rs`: add `opacity: f32` field
3. **Opacity blending in BrushTool** — `domain/tools/brush.rs`: blend with existing pixel when opacity < 1.0
4. **Composite color pick** — `use_cases/editor_service.rs`: add `pick_color_composite(x, y)` method
5. **Update commands** — `commands/tool_commands.rs`: add opacity and pipette_mode parameters
6. **Update DTOs** — `commands/dto.rs`: reflect new params

### Phase 2: Frontend Store & API

7. **Expand ToolType** — `store/toolStore.ts`: rename rectangle→selection, add move/zoom, add secondaryColor, opacity, pipetteMode
8. **Update invoke wrappers** — `api/commands.ts`: add opacity and pipetteMode params

### Phase 3: Keyboard Shortcuts

9. **Tool shortcuts** — `hooks/useKeyboardShortcuts.ts`: add B/E/G/I/L/M/V/Z, [/], X, with suppression guard

### Phase 4: Toolbar & Options Bar UI

10. **Update ToolsSidebar** — add Move/Zoom icons, disabled state when no texture
11. **Create ToolOptionsBar** — new component with per-tool controls
12. **Integrate in AppShell** — add ToolOptionsBar between TitleBar and main area

### Phase 5: Canvas Input Enhancements

13. **rAF throttle** — `useViewportControls.ts`: gate tool_drag calls on requestAnimationFrame
14. **Shift+Click** — `useViewportControls.ts`: track lastStrokeEndPoint, handle shift+pointerdown
15. **Mid-stroke finalization** — wire interactionModeRef to tool switch handlers
16. **Line tool preview** — `useCanvasRenderer.ts`: draw Bresenham preview overlay

## Testing

### Backend (cargo test)

```bash
cd src-tauri
cargo test
```

Key test cases to add:
- `BrushSize::new(32)` succeeds (expanded max)
- `BrushTool` with opacity 0.5 blends correctly
- `EditorService::pick_color_composite()` returns composited color

### Frontend (manual testing)

Until vitest is configured:
1. Open any PNG texture
2. Verify all 8 tools appear in toolbar with correct icons
3. Press each shortcut key (B, E, G, I, L, M, V, Z) — toolbar should update
4. Draw with Brush at opacity 50% — pixels should be semi-transparent
5. Use Pipette in composite mode on multi-layer texture
6. Draw, then Shift+Click — straight line from last point
7. Select Line tool, click and drag — preview line should appear
8. Press [ and ] — brush size changes in options bar
9. Press X — primary/secondary colors swap
10. Click in a text input and press B — shortcut should NOT trigger

## Key Files

| File | Changes |
|------|---------|
| `src-tauri/src/domain/tools/mod.rs` | BrushSize max, opacity in ToolContext |
| `src-tauri/src/domain/tools/brush.rs` | Opacity blending |
| `src-tauri/src/use_cases/editor_service.rs` | pick_color_composite() |
| `src-tauri/src/commands/tool_commands.rs` | New params: opacity, pipette_mode |
| `src/store/toolStore.ts` | ToolType expansion, new state |
| `src/api/commands.ts` | Updated invoke wrappers |
| `src/hooks/useKeyboardShortcuts.ts` | Tool shortcuts, [/], X |
| `src/components/shell/ToolsSidebar.tsx` | Move/Zoom, disabled state |
| `src/components/shell/ToolOptionsBar.tsx` | NEW: options bar |
| `src/components/shell/AppShell.tsx` | Integrate options bar |
| `src/components/canvas/useViewportControls.ts` | Throttle, Shift+Click, mid-stroke |
| `src/components/canvas/useCanvasRenderer.ts` | Line preview |
| `src/components/canvas/math.ts` | bresenhamLine() TS port |
