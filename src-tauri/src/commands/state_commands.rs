use std::sync::Mutex;

use tauri::State;

use crate::commands::dto::{build_editor_state_dto, CompositeDto, EditorStateDto};
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub fn get_editor_state(state: State<'_, Mutex<AppState>>) -> Result<EditorStateDto, AppError> {
    let state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    Ok(build_editor_state_dto(
        state.editor.as_ref(),
        state.active_layer_id,
    ))
}

#[tauri::command]
pub fn get_composite(state: State<'_, Mutex<AppState>>) -> Result<CompositeDto, AppError> {
    let state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    let composite = state.editor_ref()?.texture().composite()?;
    Ok(CompositeDto::from(composite))
}
