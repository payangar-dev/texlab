use std::sync::Mutex;

use tauri::{AppHandle, State};

use crate::commands::dto::{
    build_editor_state_dto, parse_layer_id, str_to_blend_mode, EditorStateDto,
};
use crate::commands::emit_state_changed;
use crate::domain::LayerId;
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub fn add_layer(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    name: String,
) -> Result<EditorStateDto, AppError> {
    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    let layer_id = LayerId::new(uuid::Uuid::new_v4().as_u128());
    state.editor_mut()?.add_layer(layer_id, &name)?;
    state.active_layer_id = Some(layer_id);
    let dto = build_editor_state_dto(state.editor.as_ref(), state.active_layer_id);

    emit_state_changed(&app);
    Ok(dto)
}

#[tauri::command]
pub fn remove_layer(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    layer_id: String,
) -> Result<EditorStateDto, AppError> {
    let parsed_id = parse_layer_id(&layer_id)?;

    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    state.editor_mut()?.remove_layer(parsed_id)?;

    // Clear active_layer_id if the removed layer was active
    if state.active_layer_id == Some(parsed_id) {
        state.active_layer_id = state
            .editor_ref()
            .ok()
            .and_then(|e| e.texture().layer_stack().layers().first())
            .map(|l| l.id());
    }

    let dto = build_editor_state_dto(state.editor.as_ref(), state.active_layer_id);
    emit_state_changed(&app);
    Ok(dto)
}

#[tauri::command]
pub fn move_layer(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    from_index: usize,
    to_index: usize,
) -> Result<EditorStateDto, AppError> {
    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    state.editor_mut()?.move_layer(from_index, to_index)?;
    let dto = build_editor_state_dto(state.editor.as_ref(), state.active_layer_id);

    emit_state_changed(&app);
    Ok(dto)
}

#[tauri::command]
pub fn set_layer_opacity(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    layer_id: String,
    opacity: f32,
) -> Result<EditorStateDto, AppError> {
    let parsed_id = parse_layer_id(&layer_id)?;

    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    state.editor_mut()?.set_layer_opacity(parsed_id, opacity)?;
    let dto = build_editor_state_dto(state.editor.as_ref(), state.active_layer_id);

    emit_state_changed(&app);
    Ok(dto)
}

#[tauri::command]
pub fn set_layer_visibility(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    layer_id: String,
    visible: bool,
) -> Result<EditorStateDto, AppError> {
    let parsed_id = parse_layer_id(&layer_id)?;

    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    state
        .editor_mut()?
        .set_layer_visibility(parsed_id, visible)?;
    let dto = build_editor_state_dto(state.editor.as_ref(), state.active_layer_id);

    emit_state_changed(&app);
    Ok(dto)
}

#[tauri::command]
pub fn set_layer_blend_mode(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    layer_id: String,
    blend_mode: String,
) -> Result<EditorStateDto, AppError> {
    let parsed_id = parse_layer_id(&layer_id)?;
    let mode = str_to_blend_mode(&blend_mode)?;

    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    state.editor_mut()?.set_layer_blend_mode(parsed_id, mode)?;
    let dto = build_editor_state_dto(state.editor.as_ref(), state.active_layer_id);

    emit_state_changed(&app);
    Ok(dto)
}

#[tauri::command]
pub fn set_layer_name(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    layer_id: String,
    name: String,
) -> Result<EditorStateDto, AppError> {
    let parsed_id = parse_layer_id(&layer_id)?;

    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    state.editor_mut()?.set_layer_name(parsed_id, &name)?;
    let dto = build_editor_state_dto(state.editor.as_ref(), state.active_layer_id);

    emit_state_changed(&app);
    Ok(dto)
}

#[tauri::command]
pub fn set_layer_locked(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    layer_id: String,
    locked: bool,
) -> Result<EditorStateDto, AppError> {
    let parsed_id = parse_layer_id(&layer_id)?;

    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    state.editor_mut()?.set_layer_locked(parsed_id, locked)?;
    let dto = build_editor_state_dto(state.editor.as_ref(), state.active_layer_id);

    emit_state_changed(&app);
    Ok(dto)
}
