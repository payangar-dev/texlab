use std::sync::Mutex;

use tauri::{AppHandle, State};

use crate::commands::dto::{build_editor_state_dto, EditorStateDto};
use crate::commands::emit_state_changed;
use crate::domain::ports::ImageReader;
use crate::domain::LayerId;
use crate::error::AppError;
use crate::infrastructure::png_reader::PngReader;
use crate::infrastructure::png_writer::PngWriter;
use crate::state::AppState;
use crate::use_cases::editor_service::EditorService;

#[tauri::command]
pub fn open_texture(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    file_path: String,
    namespace: String,
    texture_path: String,
) -> Result<EditorStateDto, AppError> {
    // Read PNG outside the lock to avoid blocking other commands during I/O.
    // The dirty guard below re-checks state atomically under the lock.
    let buffer = PngReader.read(&file_path)?;
    let layer_id = LayerId::new(uuid::Uuid::new_v4().as_u128());

    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    if let Some(ref editor) = state.editor {
        if editor.texture().is_dirty() {
            return Err(AppError::Internal("unsaved changes".to_owned()));
        }
    }

    let editor = EditorService::from_pixel_buffer(&buffer, namespace, texture_path, layer_id)?;
    state.active_layer_id = Some(layer_id);
    state.active_tool = None;
    let dto = build_editor_state_dto(Some(&editor), state.active_layer_id);
    state.editor = Some(editor);

    emit_state_changed(&app);
    Ok(dto)
}

#[tauri::command]
pub fn save_texture(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    file_path: String,
) -> Result<(), AppError> {
    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    state.editor_mut()?.save_composite(&PngWriter, &file_path)?;

    emit_state_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn create_texture(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    namespace: String,
    path: String,
    width: u32,
    height: u32,
) -> Result<EditorStateDto, AppError> {
    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    if let Some(ref editor) = state.editor {
        if editor.texture().is_dirty() {
            return Err(AppError::Internal("unsaved changes".to_owned()));
        }
    }

    let layer_id = LayerId::new(uuid::Uuid::new_v4().as_u128());
    let editor = EditorService::new_blank(namespace, path, width, height, layer_id)?;
    state.active_layer_id = Some(layer_id);
    state.active_tool = None;
    let dto = build_editor_state_dto(Some(&editor), state.active_layer_id);
    state.editor = Some(editor);

    emit_state_changed(&app);
    Ok(dto)
}
