# Contract: Tauri IPC (Canvas Viewport)

**Feature**: 006-canvas-viewport
**Date**: 2026-03-29

This feature does NOT add new Tauri commands. It consumes existing commands from the frontend.

## Existing Commands Used

### `get_composite` → `CompositeDto`

**Purpose**: Fetch the flattened RGBA pixel data for rendering on the canvas.

```typescript
// Already defined in src/api/commands.ts
interface CompositeDto {
  width: number;
  height: number;
  data: number[];  // Flat RGBA, row-major, length = width * height * 4
}

async function getComposite(): Promise<CompositeDto>;
```

**When called**: On initial texture load, after `state-changed` events from backend.

### `tool_press` / `tool_drag` / `tool_release` → `ToolResultDto`

**Purpose**: Apply tool operations. The canvas converts screen coordinates to texture pixel coordinates before calling these.

```typescript
interface ToolResultDto {
  type: "none" | "pixels_modified" | "color_picked" | "selection_changed";
  composite?: CompositeDto;  // Present when type === "pixels_modified"
  color?: ColorDto;          // Present when type === "color_picked"
  selection?: SelectionDto;  // Present when type === "selection_changed"
}
```

**Coordinate conversion responsibility**: The canvas component converts `event.offsetX/Y` → texture pixel coordinates using `Math.floor((screenPos - pan) / zoom)`, then passes integer `x`, `y` to these commands.

### `get_editor_state` → `EditorStateDto`

**Purpose**: Get texture metadata (dimensions, layers, undo/redo state).

```typescript
interface EditorStateDto {
  texture: TextureMetadataDto | null;
  layers: LayerInfoDto[];
  activeLayerId: string | null;
  canUndo: boolean;
  canRedo: boolean;
}

interface TextureMetadataDto {
  namespace: string;
  path: string;
  width: number;
  height: number;
  layerCount: number;
}
```

**When called**: Via the existing `editorStore` listener on `state-changed` events.

## Tauri Events Consumed

### `state-changed` (existing)

Emitted by Rust backend whenever state is mutated (tool operations, undo/redo, layer changes, MCP modifications). The canvas component listens for this event to refresh composite data and redraw.

## No New Backend Changes Required

All canvas viewport functionality is purely frontend:
- Zoom/pan state management
- Canvas rendering pipeline
- Pixel grid overlay
- Cursor preview overlay
- Status bar coordinate display
- Keyboard shortcut handling

The existing `getComposite()` and tool commands provide all necessary backend integration.
