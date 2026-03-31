# Contract: Tool Commands (Tauri IPC)

**Feature Branch**: `008-toolbar-input-shortcuts`
**Date**: 2026-03-30

## Overview

Documents the Tauri IPC command interface changes for tool interaction. These commands are the boundary between the React frontend and the Rust backend.

## Modified Commands

### `tool_press`

Initiates a tool stroke. Creates the tool instance, captures an undo snapshot, and executes the press phase.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tool` | `string` | yes | Tool identifier: `"brush"`, `"eraser"`, `"fill"`, `"color_picker"`, `"line"`, `"selection"` |
| `layer_id` | `string` | yes | 32-char hex string of the layer's u128 ID |
| `x` | `u32` | yes | Pixel X coordinate (texture space) |
| `y` | `u32` | yes | Pixel Y coordinate (texture space) |
| `color` | `ColorDto` | yes | RGBA color `{ r: u8, g: u8, b: u8, a: u8 }` |
| `brush_size` | `u8` | yes | Brush diameter (1–32) |
| `opacity` | `f32` | yes | **NEW** — Tool opacity (0.0–1.0). Default 1.0. Applied by BrushTool only. |
| `pipette_mode` | `string` | yes | **NEW** — `"composite"` or `"active_layer"`. Only meaningful for `tool == "color_picker"`. |

**Returns**: `ToolResultDto`

**Behavior change**: When `tool == "color_picker"` and `pipette_mode == "composite"`, the command bypasses the `ColorPickerTool::on_press()` and instead calls `EditorService::pick_color_composite(x, y)` to sample from the composited image of all visible layers.

---

### `tool_drag`

Continues a tool stroke. Reuses the active tool instance from the previous `tool_press`.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `layer_id` | `string` | yes | 32-char hex layer ID |
| `x` | `u32` | yes | Pixel X coordinate |
| `y` | `u32` | yes | Pixel Y coordinate |
| `color` | `ColorDto` | yes | RGBA color |
| `brush_size` | `u8` | yes | Brush diameter (1–32) |
| `opacity` | `f32` | yes | **NEW** — Tool opacity (0.0–1.0) |

**Returns**: `ToolResultDto`

---

### `tool_release`

Completes a tool stroke. Finalizes the tool, pushes the undo entry if pixels were modified.

**Parameters**: Same as `tool_drag`.

**Returns**: `ToolResultDto`

---

## ToolResultDto (unchanged)

```typescript
interface ToolResultDto {
  resultType: "pixels_modified" | "color_picked" | "selection_changed" | "no_op";
  pickedColor?: ColorDto;         // present when resultType == "color_picked"
  selection?: SelectionDto | null; // present when resultType == "selection_changed"
  composite?: CompositeDto;        // present when resultType == "pixels_modified"
}
```

No changes to the return type. The Pipette composite mode returns the same `color_picked` result type with a `pickedColor` field.

---

## Frontend Invoke Wrappers (api/commands.ts)

Updated signatures:

```typescript
// tool_press — add opacity and pipetteMode
export function toolPress(
  tool: string,
  layerId: string,
  x: number,
  y: number,
  color: ColorDto,
  brushSize: number,
  opacity: number,       // NEW
  pipetteMode: string,   // NEW
): Promise<ToolResultDto>

// tool_drag — add opacity
export function toolDrag(
  layerId: string,
  x: number,
  y: number,
  color: ColorDto,
  brushSize: number,
  opacity: number,       // NEW
): Promise<ToolResultDto>

// tool_release — add opacity
export function toolRelease(
  layerId: string,
  x: number,
  y: number,
  color: ColorDto,
  brushSize: number,
  opacity: number,       // NEW
): Promise<ToolResultDto>
```

---

## Tool Name Mapping (frontend → backend)

| Frontend `ToolType` | Backend `tool` string | Has backend implementation |
|---------------------|----------------------|---------------------------|
| `"brush"` | `"brush"` | ✅ BrushTool |
| `"eraser"` | `"eraser"` | ✅ EraserTool |
| `"fill"` | `"fill"` | ✅ FillTool |
| `"eyedropper"` | `"color_picker"` | ✅ ColorPickerTool |
| `"line"` | `"line"` | ✅ LineTool |
| `"selection"` | `"selection"` | ✅ SelectionTool |
| `"move"` | — | ❌ No-op (placeholder) |
| `"zoom"` | — | ❌ No-op (placeholder) |

The frontend must NOT call `tool_press` for `"move"` or `"zoom"` tools — canvas clicks with these tools are ignored.
