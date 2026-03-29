use std::sync::Mutex;

use tauri::{AppHandle, State};

use crate::commands::dto::{build_editor_state_dto, EditorStateDto};
use crate::commands::emit_state_changed;
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub fn undo(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
) -> Result<EditorStateDto, AppError> {
    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    state.editor_mut()?.undo()?;
    let dto = build_editor_state_dto(state.editor.as_ref(), state.active_layer_id);

    emit_state_changed(&app);
    Ok(dto)
}

#[tauri::command]
pub fn redo(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
) -> Result<EditorStateDto, AppError> {
    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    state.editor_mut()?.redo()?;
    let dto = build_editor_state_dto(state.editor.as_ref(), state.active_layer_id);

    emit_state_changed(&app);
    Ok(dto)
}
