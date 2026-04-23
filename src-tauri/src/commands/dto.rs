use crate::domain::{
    BlendMode, Color, Layer, LayerId, Palette, PaletteScope, PixelBuffer, Selection, Texture,
    ToolResult,
};
use crate::use_cases::editor_service::EditorService;

/// Full editor state snapshot returned after mutations and by `get_editor_state`.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorStateDto {
    pub texture: Option<TextureMetadataDto>,
    pub layers: Vec<LayerInfoDto>,
    pub active_layer_id: Option<String>,
    pub can_undo: bool,
    pub can_redo: bool,
}

/// Texture metadata without pixel data.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextureMetadataDto {
    pub namespace: String,
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub dirty: bool,
}

/// Layer metadata with thumbnail pixel data.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerInfoDto {
    pub id: String,
    pub name: String,
    pub opacity: f32,
    pub blend_mode: String,
    pub visible: bool,
    pub locked: bool,
    pub thumbnail: Vec<u8>,
}

/// Composited pixel data for canvas rendering.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompositeDto {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

/// Result of a tool operation.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolResultDto {
    pub result_type: String,
    pub picked_color: Option<ColorDto>,
    pub selection: Option<SelectionDto>,
    pub composite: Option<CompositeDto>,
}

/// RGBA color value.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorDto {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

/// Rectangular selection bounds.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionDto {
    pub left: u32,
    pub top: u32,
    pub right: u32,
    pub bottom: u32,
}

// --- Conversion impls ---

impl From<&Texture> for TextureMetadataDto {
    fn from(t: &Texture) -> Self {
        Self {
            namespace: t.namespace().to_owned(),
            path: t.path().to_owned(),
            width: t.width(),
            height: t.height(),
            dirty: t.is_dirty(),
        }
    }
}

impl From<&Layer> for LayerInfoDto {
    fn from(layer: &Layer) -> Self {
        Self {
            id: format!("{:032x}", layer.id().value()),
            name: layer.name().to_owned(),
            opacity: layer.opacity(),
            blend_mode: blend_mode_to_str(layer.blend_mode()),
            visible: layer.is_visible(),
            locked: layer.is_locked(),
            thumbnail: layer.buffer().clone_data(),
        }
    }
}

impl From<PixelBuffer> for CompositeDto {
    fn from(buf: PixelBuffer) -> Self {
        Self {
            width: buf.width(),
            height: buf.height(),
            data: buf.clone_data(),
        }
    }
}

impl From<Color> for ColorDto {
    fn from(c: Color) -> Self {
        Self {
            r: c.r(),
            g: c.g(),
            b: c.b(),
            a: c.a(),
        }
    }
}

impl From<&ColorDto> for Color {
    fn from(dto: &ColorDto) -> Self {
        Color::new(dto.r, dto.g, dto.b, dto.a)
    }
}

impl From<&Selection> for SelectionDto {
    fn from(s: &Selection) -> Self {
        Self {
            left: s.left(),
            top: s.top(),
            right: s.right(),
            bottom: s.bottom(),
        }
    }
}

/// Builds an `EditorStateDto` from the given editor and active layer ID.
/// Returns an empty state DTO when `editor` is `None`.
pub fn build_editor_state_dto(
    editor: Option<&EditorService>,
    active_layer_id: Option<LayerId>,
) -> EditorStateDto {
    match editor {
        Some(editor) => {
            let texture = editor.texture();
            EditorStateDto {
                texture: Some(TextureMetadataDto::from(texture)),
                layers: texture
                    .layer_stack()
                    .layers()
                    .iter()
                    .map(LayerInfoDto::from)
                    .collect(),
                active_layer_id: active_layer_id.map(|id| format!("{:032x}", id.value())),
                can_undo: editor.can_undo(),
                can_redo: editor.can_redo(),
            }
        }
        None => EditorStateDto {
            texture: None,
            layers: Vec::new(),
            active_layer_id: None,
            can_undo: false,
            can_redo: false,
        },
    }
}

/// Converts a `ToolResult` into a `ToolResultDto`, wrapping the optional composite if provided.
pub fn tool_result_to_dto(result: ToolResult, composite: Option<PixelBuffer>) -> ToolResultDto {
    match result {
        ToolResult::PixelsModified => ToolResultDto {
            result_type: "pixels_modified".to_owned(),
            picked_color: None,
            selection: None,
            composite: composite.map(CompositeDto::from),
        },
        ToolResult::ColorPicked(color) => ToolResultDto {
            result_type: "color_picked".to_owned(),
            picked_color: Some(ColorDto::from(color)),
            selection: None,
            composite: None,
        },
        ToolResult::SelectionChanged(sel) => ToolResultDto {
            result_type: "selection_changed".to_owned(),
            picked_color: None,
            selection: sel.as_ref().map(SelectionDto::from),
            composite: None,
        },
        ToolResult::NoOp => ToolResultDto {
            result_type: "no_op".to_owned(),
            picked_color: None,
            selection: None,
            composite: None,
        },
    }
}

fn blend_mode_to_str(mode: BlendMode) -> String {
    match mode {
        BlendMode::Normal => "normal",
        BlendMode::Multiply => "multiply",
        BlendMode::Screen => "screen",
        BlendMode::Overlay => "overlay",
    }
    .to_owned()
}

pub fn str_to_blend_mode(s: &str) -> Result<BlendMode, crate::error::AppError> {
    match s {
        "normal" => Ok(BlendMode::Normal),
        "multiply" => Ok(BlendMode::Multiply),
        "screen" => Ok(BlendMode::Screen),
        "overlay" => Ok(BlendMode::Overlay),
        _ => Err(crate::error::AppError::Internal(format!(
            "unknown blend mode: {s}"
        ))),
    }
}

/// Parses a zero-padded 32-char hex string into a `LayerId`.
pub fn parse_layer_id(hex: &str) -> Result<LayerId, crate::error::AppError> {
    u128::from_str_radix(hex, 16)
        .map(LayerId::new)
        .map_err(|_| crate::error::AppError::Internal(format!("invalid layer id: {hex}")))
}

// --- Palette DTOs ---

/// Wire enum for a palette scope. Serialized as `"global"` / `"project"`.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PaletteScopeDto {
    Global,
    Project,
}

impl From<PaletteScope> for PaletteScopeDto {
    fn from(s: PaletteScope) -> Self {
        match s {
            PaletteScope::Global => PaletteScopeDto::Global,
            PaletteScope::Project => PaletteScopeDto::Project,
        }
    }
}

impl From<PaletteScopeDto> for PaletteScope {
    fn from(s: PaletteScopeDto) -> Self {
        match s {
            PaletteScopeDto::Global => PaletteScope::Global,
            PaletteScopeDto::Project => PaletteScope::Project,
        }
    }
}

/// Wire type for a palette. Colors are `#RRGGBB` hex strings.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaletteDto {
    pub id: String,
    pub name: String,
    pub scope: PaletteScopeDto,
    pub colors: Vec<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaletteListDto {
    pub palettes: Vec<PaletteDto>,
    pub active_palette_id: Option<String>,
    pub can_create_project_palette: bool,
}

/// Tagged mirror of [`crate::domain::AddColorOutcome`]. Serializes as
/// `{ "kind": "added" | "alreadyPresent", "index": n }`.
#[derive(serde::Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AddColorOutcomeDto {
    Added { index: usize },
    AlreadyPresent { index: usize },
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddColorResultDto {
    pub outcome: AddColorOutcomeDto,
    pub palette: PaletteDto,
}

/// Wire type for the import strategy tagged union. Matches the TypeScript
/// shape `{ action: "cancel" } | { action: "rename", newName: string } |
/// { action: "overwrite" }`.
#[derive(serde::Deserialize)]
#[serde(tag = "action", rename_all = "camelCase")]
pub enum ImportStrategyDto {
    Cancel,
    #[serde(rename_all = "camelCase")]
    Rename {
        new_name: String,
    },
    Overwrite,
}

impl From<&Palette> for PaletteDto {
    fn from(p: &Palette) -> Self {
        Self {
            id: p.id().to_hex_string(),
            name: p.name().as_str().to_owned(),
            scope: p.scope().into(),
            colors: p.colors().iter().map(Color::to_hex_rgb).collect(),
        }
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn str_to_blend_mode_valid_values() {
        assert_eq!(str_to_blend_mode("normal").unwrap(), BlendMode::Normal);
        assert_eq!(str_to_blend_mode("multiply").unwrap(), BlendMode::Multiply);
        assert_eq!(str_to_blend_mode("screen").unwrap(), BlendMode::Screen);
        assert_eq!(str_to_blend_mode("overlay").unwrap(), BlendMode::Overlay);
    }

    #[test]
    fn str_to_blend_mode_invalid_returns_error() {
        let err = str_to_blend_mode("invalid").unwrap_err();
        assert!(err.to_string().contains("unknown blend mode: invalid"));
    }

    #[test]
    fn parse_layer_id_valid_hex() {
        let id = parse_layer_id("0000000000000000000000000000002a").unwrap();
        assert_eq!(id.value(), 42);
    }

    #[test]
    fn parse_layer_id_unpadded_hex() {
        let id = parse_layer_id("ff").unwrap();
        assert_eq!(id.value(), 255);
    }

    #[test]
    fn parse_layer_id_invalid_returns_error() {
        let err = parse_layer_id("not-hex").unwrap_err();
        assert!(err.to_string().contains("invalid layer id: not-hex"));
    }

    // --- Palette DTO tests ---

    #[test]
    fn palette_scope_dto_roundtrips_through_domain() {
        assert_eq!(
            PaletteScope::from(PaletteScopeDto::Global),
            PaletteScope::Global
        );
        assert_eq!(
            PaletteScope::from(PaletteScopeDto::Project),
            PaletteScope::Project
        );
        assert_eq!(
            PaletteScopeDto::from(PaletteScope::Global),
            PaletteScopeDto::Global
        );
        assert_eq!(
            PaletteScopeDto::from(PaletteScope::Project),
            PaletteScopeDto::Project
        );
    }

    #[test]
    fn palette_scope_dto_serializes_as_lowercase() {
        let s = serde_json::to_string(&PaletteScopeDto::Global).unwrap();
        assert_eq!(s, "\"global\"");
        let s = serde_json::to_string(&PaletteScopeDto::Project).unwrap();
        assert_eq!(s, "\"project\"");
    }

    #[test]
    fn palette_scope_dto_deserializes_rejects_unknown() {
        let err = serde_json::from_str::<PaletteScopeDto>("\"banana\"").unwrap_err();
        assert!(err.to_string().contains("banana") || err.to_string().contains("variant"));
    }

    #[test]
    fn palette_dto_from_palette_encodes_scope_and_colors() {
        use crate::domain::{PaletteId, PaletteName};
        let mut p = crate::domain::Palette::new(
            PaletteId::from_value(42),
            PaletteName::new("Blues").unwrap(),
            PaletteScope::Global,
        );
        p.add_color(Color::new(0x10, 0x20, 0x30, 255));
        let dto = PaletteDto::from(&p);
        assert_eq!(dto.id, "0000000000000000000000000000002a");
        assert_eq!(dto.name, "Blues");
        assert_eq!(dto.scope, PaletteScopeDto::Global);
        assert_eq!(dto.colors, vec!["#102030".to_owned()]);
    }

    #[test]
    fn add_color_outcome_dto_serializes_tagged() {
        let dto = AddColorOutcomeDto::Added { index: 3 };
        let s = serde_json::to_string(&dto).unwrap();
        assert!(s.contains("\"kind\":\"added\""), "got {s}");
        assert!(s.contains("\"index\":3"), "got {s}");

        let dto = AddColorOutcomeDto::AlreadyPresent { index: 7 };
        let s = serde_json::to_string(&dto).unwrap();
        assert!(s.contains("\"kind\":\"alreadyPresent\""), "got {s}");
    }
}
