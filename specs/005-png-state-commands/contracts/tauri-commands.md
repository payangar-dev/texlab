# Tauri Command Contracts: PNG I/O + AppState + Tauri Commands

**Feature Branch**: `005-png-state-commands`
**Date**: 2026-03-29

All commands are invoked via `@tauri-apps/api/core`'s `invoke()`. Parameters are passed as a single object. Return values are JSON-serialized DTOs. Errors are plain strings.

---

## Texture Commands (`commands/texture_commands.rs`)

### `open_texture`

Opens a PNG file and creates an EditorService with a single layer containing the image data.

```typescript
invoke('open_texture', {
  filePath: string,       // absolute OS path to the PNG file
  namespace: string,      // Minecraft namespace (e.g., "minecraft", "custom")
  texturePath: string     // resource path (e.g., "block/stone")
}): Promise<EditorStateDto>
```

**Behavior:**
- If no texture is open: reads PNG from `filePath`, creates texture with namespace/texturePath and one layer ("Background"), returns editor state
- If current texture is clean: replaces it with the new one
- If current texture is dirty: returns error `"unsaved changes"`
- The layer gets the full pixel data from the PNG
- `active_layer_id` is set to the Background layer's ID

**Errors:** File not found, invalid PNG, unsaved changes, empty namespace/path

---

### `save_texture`

Saves the composited texture as a PNG file to the specified path.

```typescript
invoke('save_texture', { path: string }): Promise<void>
```

**Behavior:**
- Composites all visible layers
- Writes the result as a PNG file to `path`
- Marks the texture as clean (dirty = false)

**Errors:** No texture open, I/O error (permissions, disk full)

---

### `create_texture`

Creates a new blank texture with one transparent layer.

```typescript
invoke('create_texture', {
  namespace: string,
  path: string,
  width: number,
  height: number
}): Promise<EditorStateDto>
```

**Behavior:**
- If current texture is dirty: returns error `"unsaved changes"`
- If current texture is clean (or none): creates new texture, replaces editor
- Initial layer named "Layer 1", fully transparent

**Errors:** Invalid dimensions (0 or negative), empty namespace/path, unsaved changes

---

## Tool Commands (`commands/tool_commands.rs`)

### Tool Lifecycle

Tools are **stateful** across a press→drag→release stroke cycle. `BrushTool` tracks `last_pos` for interpolation, `LineTool` and `SelectionTool` track `start_pos`. The backend stores the active tool instance in `AppState.active_tool` for the duration of a stroke:

1. `tool_press` → creates tool instance, stores in `AppState.active_tool`, calls `apply_tool_press()`
2. `tool_drag` → reuses stored tool, calls `apply_tool_drag()`
3. `tool_release` → reuses stored tool, calls `apply_tool_release()`, then clears `AppState.active_tool`

### `tool_press`

Begins a tool interaction at the given coordinates.

```typescript
invoke('tool_press', {
  tool: string,       // "brush" | "eraser" | "fill" | "color_picker" | "line" | "selection"
  layerId: string,    // hex LayerId
  x: number,
  y: number,
  color: ColorDto,    // { r, g, b, a }
  brushSize: number   // 1-16
}): Promise<ToolResultDto>
```

**Behavior:**
- Creates the appropriate tool instance from `tool` string and stores it in `AppState.active_tool`
- Updates `AppState.active_layer_id` to `layerId`
- Calls `editor.apply_tool_press()` on the specified layer
- Returns the tool result (with composite if pixels were modified)

**Errors:** No texture open, layer not found, layer locked, invalid brush size

---

### `tool_drag`

Continues a tool interaction (mouse drag).

```typescript
invoke('tool_drag', {
  layerId: string,
  x: number,
  y: number,
  color: ColorDto,
  brushSize: number
}): Promise<ToolResultDto>
```

**Behavior:**
- Reuses the tool instance stored in `AppState.active_tool`
- Calls `editor.apply_tool_drag()` on the specified layer
- Returns the tool result (with composite if pixels were modified)

**Errors:** No texture open, no active tool (press not called), layer not found

---

### `tool_release`

Ends a tool interaction (mouse up).

```typescript
invoke('tool_release', {
  layerId: string,
  x: number,
  y: number,
  color: ColorDto,
  brushSize: number
}): Promise<ToolResultDto>
```

**Behavior:**
- Reuses the tool instance stored in `AppState.active_tool`
- Calls `editor.apply_tool_release()` — undo snapshots are committed if pixels were modified during the cycle
- Clears `AppState.active_tool` (stroke complete)

**Errors:** No texture open, no active tool (press not called), layer not found

---

## Layer Commands (`commands/layer_commands.rs`)

### `add_layer`

```typescript
invoke('add_layer', { name: string }): Promise<EditorStateDto>
```

Adds a new transparent layer to the top of the stack. Returns updated state.

### `remove_layer`

```typescript
invoke('remove_layer', { layerId: string }): Promise<EditorStateDto>
```

Removes the specified layer. Fails if it's the last layer.

### `move_layer`

```typescript
invoke('move_layer', { fromIndex: number, toIndex: number }): Promise<EditorStateDto>
```

Reorders a layer within the stack.

### `set_layer_opacity`

```typescript
invoke('set_layer_opacity', { layerId: string, opacity: number }): Promise<EditorStateDto>
```

Sets layer opacity (0.0 to 1.0, clamped).

### `set_layer_visibility`

```typescript
invoke('set_layer_visibility', { layerId: string, visible: boolean }): Promise<EditorStateDto>
```

### `set_layer_blend_mode`

```typescript
invoke('set_layer_blend_mode', { layerId: string, blendMode: string }): Promise<EditorStateDto>
```

`blendMode`: `"normal"` | `"multiply"` | `"screen"` | `"overlay"`

### `set_layer_name`

```typescript
invoke('set_layer_name', { layerId: string, name: string }): Promise<EditorStateDto>
```

### `set_layer_locked`

```typescript
invoke('set_layer_locked', { layerId: string, locked: boolean }): Promise<EditorStateDto>
```

---

## History Commands (`commands/history_commands.rs`)

### `undo`

```typescript
invoke('undo'): Promise<EditorStateDto>
```

Reverts the most recent operation. Returns updated state with composite.

**Errors:** No texture open, empty undo history

### `redo`

```typescript
invoke('redo'): Promise<EditorStateDto>
```

Re-applies the most recently undone operation.

**Errors:** No texture open, empty redo history

---

## State Query Commands (`commands/state_commands.rs`)

### `get_editor_state`

```typescript
invoke('get_editor_state'): Promise<EditorStateDto>
```

Returns the current editor state. If no texture is open, returns `{ texture: null, layers: [], ... }`.

### `get_composite`

```typescript
invoke('get_composite'): Promise<CompositeDto>
```

Returns the composited RGBA pixel data of all visible layers.

**Errors:** No texture open

---

## DTOs (TypeScript types)

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
  dirty: boolean;
}

interface LayerInfoDto {
  id: string;
  name: string;
  opacity: number;
  blendMode: string;
  visible: boolean;
  locked: boolean;
}

interface CompositeDto {
  width: number;
  height: number;
  data: number[];  // RGBA bytes
}

interface ToolResultDto {
  resultType: string;
  pickedColor: ColorDto | null;
  selection: SelectionDto | null;
  composite: CompositeDto | null;
}

interface ColorDto {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface SelectionDto {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
```

---

## Events

### `state-changed`

Emitted by the backend after any mutation. No payload.

```typescript
import { listen } from '@tauri-apps/api/event';

await listen('state-changed', () => {
  // Re-fetch state via get_editor_state
});
```

**When emitted:** After every successful mutation command (tool ops, layer ops, undo/redo, open, save, create). Not emitted by read-only queries.

**Purpose:** Enables MCP server mutations to trigger frontend refresh (Constitution principle III).

---

## Command Registration

All commands registered in `lib.rs` via `generate_handler![]`:

```rust
tauri::generate_handler![
    commands::open_texture,
    commands::save_texture,
    commands::create_texture,
    commands::tool_press,
    commands::tool_drag,
    commands::tool_release,
    commands::add_layer,
    commands::remove_layer,
    commands::move_layer,
    commands::set_layer_opacity,
    commands::set_layer_visibility,
    commands::set_layer_blend_mode,
    commands::set_layer_name,
    commands::set_layer_locked,
    commands::undo,
    commands::redo,
    commands::get_editor_state,
    commands::get_composite,
]
```
