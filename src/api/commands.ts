import { invoke } from "@tauri-apps/api/core";

// --- DTO interfaces ---

export interface EditorStateDto {
  texture: TextureMetadataDto | null;
  layers: LayerInfoDto[];
  activeLayerId: string | null;
  canUndo: boolean;
  canRedo: boolean;
}

export interface TextureMetadataDto {
  namespace: string;
  path: string;
  width: number;
  height: number;
  dirty: boolean;
}

export type BlendMode = "normal" | "multiply" | "screen" | "overlay";

export interface LayerInfoDto {
  id: string;
  name: string;
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
  locked: boolean;
}

export interface CompositeDto {
  width: number;
  height: number;
  /** RGBA bytes (u8 0–255), row-major. Convert to Uint8ClampedArray for ImageData. */
  data: number[];
}

export type ToolResultType =
  | "pixels_modified"
  | "color_picked"
  | "selection_changed"
  | "no_op";

export type ToolResultDto =
  | {
      resultType: "pixels_modified";
      pickedColor: null;
      selection: null;
      composite: CompositeDto | null;
    }
  | {
      resultType: "color_picked";
      pickedColor: ColorDto;
      selection: null;
      composite: null;
    }
  | {
      resultType: "selection_changed";
      pickedColor: null;
      selection: SelectionDto | null;
      composite: null;
    }
  | {
      resultType: "no_op";
      pickedColor: null;
      selection: null;
      composite: null;
    };

export interface ColorDto {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface SelectionDto {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// --- Texture commands ---

export function openTexture(
  filePath: string,
  namespace: string,
  texturePath: string,
): Promise<EditorStateDto> {
  return invoke("open_texture", { filePath, namespace, texturePath });
}

export function saveTexture(filePath: string): Promise<void> {
  return invoke("save_texture", { filePath });
}

export function createTexture(
  namespace: string,
  path: string,
  width: number,
  height: number,
): Promise<EditorStateDto> {
  return invoke("create_texture", { namespace, path, width, height });
}

// --- Tool commands ---

export function toolPress(
  tool: string,
  layerId: string,
  x: number,
  y: number,
  color: ColorDto,
  brushSize: number,
): Promise<ToolResultDto> {
  return invoke("tool_press", { tool, layerId, x, y, color, brushSize });
}

export function toolDrag(
  layerId: string,
  x: number,
  y: number,
  color: ColorDto,
  brushSize: number,
): Promise<ToolResultDto> {
  return invoke("tool_drag", { layerId, x, y, color, brushSize });
}

export function toolRelease(
  layerId: string,
  x: number,
  y: number,
  color: ColorDto,
  brushSize: number,
): Promise<ToolResultDto> {
  return invoke("tool_release", { layerId, x, y, color, brushSize });
}

// --- Layer commands ---

export function addLayer(name: string): Promise<EditorStateDto> {
  return invoke("add_layer", { name });
}

export function removeLayer(layerId: string): Promise<EditorStateDto> {
  return invoke("remove_layer", { layerId });
}

export function moveLayer(fromIndex: number, toIndex: number): Promise<EditorStateDto> {
  return invoke("move_layer", { fromIndex, toIndex });
}

export function setLayerOpacity(
  layerId: string,
  opacity: number,
): Promise<EditorStateDto> {
  return invoke("set_layer_opacity", { layerId, opacity });
}

export function setLayerVisibility(
  layerId: string,
  visible: boolean,
): Promise<EditorStateDto> {
  return invoke("set_layer_visibility", { layerId, visible });
}

export function setLayerBlendMode(
  layerId: string,
  blendMode: BlendMode,
): Promise<EditorStateDto> {
  return invoke("set_layer_blend_mode", { layerId, blendMode });
}

export function setLayerName(layerId: string, name: string): Promise<EditorStateDto> {
  return invoke("set_layer_name", { layerId, name });
}

export function setLayerLocked(
  layerId: string,
  locked: boolean,
): Promise<EditorStateDto> {
  return invoke("set_layer_locked", { layerId, locked });
}

// --- History commands ---

export function undo(): Promise<EditorStateDto> {
  return invoke("undo");
}

export function redo(): Promise<EditorStateDto> {
  return invoke("redo");
}

// --- Layout persistence commands ---

export function saveWorkspaceLayout(layoutJson: string): Promise<void> {
  return invoke("save_workspace_layout", { layoutJson });
}

export function loadWorkspaceLayout(): Promise<string | null> {
  return invoke("load_workspace_layout");
}

// --- State query commands ---

export function getEditorState(): Promise<EditorStateDto> {
  return invoke("get_editor_state");
}

export function getComposite(): Promise<CompositeDto> {
  return invoke("get_composite");
}
