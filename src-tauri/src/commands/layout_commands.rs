//! Tauri commands for workspace layout persistence.

use tauri::Manager;

use crate::error::AppError;
use crate::infrastructure::workspace_io;

#[tauri::command]
pub fn save_workspace_layout(app: tauri::AppHandle, layout_json: String) -> Result<(), AppError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to resolve app data dir: {e}")))?;
    workspace_io::write_workspace(&app_data_dir, &layout_json)?;
    Ok(())
}

#[tauri::command]
pub fn load_workspace_layout(app: tauri::AppHandle) -> Result<Option<String>, AppError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to resolve app data dir: {e}")))?;
    let content = workspace_io::read_workspace(&app_data_dir)?;
    Ok(content)
}
