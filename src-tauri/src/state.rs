use std::path::PathBuf;

use crate::domain::tools::Tool;
use crate::domain::LayerId;
use crate::error::AppError;
use crate::use_cases::editor_service::EditorService;
use crate::use_cases::palette_service::PaletteService;

/// Single source of truth for application state.
/// Shared between Tauri commands and MCP server via `Mutex`.
///
/// SAFETY: Only accessed through `Mutex<AppState>` (registered via `tauri::Builder::manage`),
/// never shared directly across threads.
#[derive(Default)]
pub struct AppState {
    pub editor: Option<EditorService>,
    pub active_tool: Option<Box<dyn Tool + Send>>,
    pub active_layer_id: Option<LayerId>,
    pub palette_service: Option<PaletteService>,
    pub current_project_path: Option<PathBuf>,
}

impl AppState {
    pub fn editor_mut(&mut self) -> Result<&mut EditorService, AppError> {
        self.editor
            .as_mut()
            .ok_or_else(|| AppError::Internal("no texture open".to_owned()))
    }

    pub fn editor_ref(&self) -> Result<&EditorService, AppError> {
        self.editor
            .as_ref()
            .ok_or_else(|| AppError::Internal("no texture open".to_owned()))
    }

    pub fn palette_service_mut(&mut self) -> Result<&mut PaletteService, AppError> {
        self.palette_service
            .as_mut()
            .ok_or_else(|| AppError::Internal("palette service not initialized".to_owned()))
    }

    pub fn palette_service_ref(&self) -> Result<&PaletteService, AppError> {
        self.palette_service
            .as_ref()
            .ok_or_else(|| AppError::Internal("palette service not initialized".to_owned()))
    }
}
