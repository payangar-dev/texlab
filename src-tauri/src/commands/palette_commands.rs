//! Tauri command wrappers for the Palette feature.
//!
//! All mutating commands emit `state-changed` so the frontend `paletteStore`
//! refetches. The service exposes `Result<_, DomainError>`; this layer
//! translates into the `AppError` codes documented in
//! `specs/011-palette-panel/contracts/commands.md`.

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{AppHandle, State};

use crate::commands::dto::{
    str_to_scope, AddColorResultDto, ImportStrategyDto, PaletteDto, PaletteListDto,
};
use crate::commands::emit_state_changed;
use crate::domain::{AddColorOutcome, Color, DomainError, PaletteId, PaletteScope};
use crate::error::AppError;
use crate::state::AppState;
use crate::use_cases::palette_service::{ImportStrategy, PaletteService};

/// Translates a [`DomainError`] returned by `PaletteService` into an
/// [`AppError`] whose serialized string matches the error catalogue in
/// `contracts/commands.md`.
fn translate(err: DomainError) -> AppError {
    match err {
        DomainError::RuleViolation(code) => AppError::Validation(code),
        DomainError::IoError { reason } => AppError::Internal(format!("io-error:{reason}")),
        DomainError::InvalidIndex { .. } => {
            AppError::Validation("palette-index-out-of-range".to_owned())
        }
        DomainError::InvalidInput { reason } => {
            AppError::Validation(format!("invalid-input:{reason}"))
        }
        other => AppError::Internal(other.to_string()),
    }
}

fn parse_id(hex: &str) -> Result<PaletteId, AppError> {
    PaletteId::from_hex(hex).map_err(|_| AppError::Validation(format!("invalid-palette-id:{hex}")))
}

fn parse_color(hex: &str) -> Result<Color, AppError> {
    Color::from_hex_rgb(hex).map_err(|_| AppError::Validation("invalid-color-hex".to_owned()))
}

/// Builds the DTO returned by every command that mutates palette state.
pub fn build_palette_list_dto(service: &PaletteService) -> Result<PaletteListDto, AppError> {
    let palettes: Vec<PaletteDto> = service
        .list_all()
        .map_err(translate)?
        .iter()
        .map(PaletteDto::from)
        .collect();
    let active = service
        .active_palette_id()
        .map_err(translate)?
        .map(|id| id.to_hex_string());
    Ok(PaletteListDto {
        palettes,
        active_palette_id: active,
        can_create_project_palette: service.can_create_project_palette(),
    })
}

#[tauri::command]
pub fn get_palettes(state: State<'_, Mutex<AppState>>) -> Result<PaletteListDto, AppError> {
    let state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;
    build_palette_list_dto(state.palette_service_ref()?)
}

#[tauri::command]
pub fn set_active_palette(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    palette_id: Option<String>,
) -> Result<PaletteListDto, AppError> {
    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;
    let id = match palette_id {
        Some(s) => Some(parse_id(&s)?),
        None => None,
    };
    state
        .palette_service_mut()?
        .set_active_palette(id)
        .map_err(translate)?;
    let dto = build_palette_list_dto(state.palette_service_ref()?)?;
    emit_state_changed(&app);
    Ok(dto)
}

#[tauri::command]
pub fn create_palette(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    name: String,
    scope: String,
) -> Result<PaletteListDto, AppError> {
    let scope = str_to_scope(&scope)?;
    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;
    state
        .palette_service_mut()?
        .create_palette(&name, scope)
        .map_err(translate)?;
    let dto = build_palette_list_dto(state.palette_service_ref()?)?;
    emit_state_changed(&app);
    Ok(dto)
}

#[tauri::command]
pub fn rename_palette(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    palette_id: String,
    new_name: String,
) -> Result<PaletteListDto, AppError> {
    let id = parse_id(&palette_id)?;
    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;
    state
        .palette_service_mut()?
        .rename_palette(id, &new_name)
        .map_err(translate)?;
    let dto = build_palette_list_dto(state.palette_service_ref()?)?;
    emit_state_changed(&app);
    Ok(dto)
}

#[tauri::command]
pub fn delete_palette(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    palette_id: String,
) -> Result<PaletteListDto, AppError> {
    let id = parse_id(&palette_id)?;
    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;
    state
        .palette_service_mut()?
        .delete_palette(id)
        .map_err(translate)?;
    let dto = build_palette_list_dto(state.palette_service_ref()?)?;
    emit_state_changed(&app);
    Ok(dto)
}

#[tauri::command]
pub fn add_color_to_active_palette(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    color_hex: String,
) -> Result<AddColorResultDto, AppError> {
    let color = parse_color(&color_hex)?;
    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;
    let (outcome, palette) = state
        .palette_service_mut()?
        .add_color_to_active(color)
        .map_err(translate)?;
    let (added, index) = match outcome {
        AddColorOutcome::Added { index } => (true, index),
        AddColorOutcome::AlreadyPresent { index } => (false, index),
    };
    let dto = AddColorResultDto {
        added,
        index,
        palette: PaletteDto::from(&palette),
    };
    emit_state_changed(&app);
    Ok(dto)
}

#[tauri::command]
pub fn remove_color_from_active_palette_at(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    index: usize,
) -> Result<PaletteListDto, AppError> {
    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;
    state
        .palette_service_mut()?
        .remove_color_from_active_at(index)
        .map_err(translate)?;
    let dto = build_palette_list_dto(state.palette_service_ref()?)?;
    emit_state_changed(&app);
    Ok(dto)
}

#[tauri::command]
pub fn export_palette(
    state: State<'_, Mutex<AppState>>,
    palette_id: String,
    destination_path: String,
) -> Result<(), AppError> {
    let id = parse_id(&palette_id)?;
    let state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;
    state
        .palette_service_ref()?
        .export_palette(id, std::path::Path::new(&destination_path))
        .map_err(translate)?;
    Ok(())
}

#[tauri::command]
pub fn import_palette(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    source_path: String,
    scope: String,
    strategy: Option<ImportStrategyDto>,
) -> Result<PaletteListDto, AppError> {
    let scope = str_to_scope(&scope)?;
    let strategy = strategy.map(|s| match s {
        ImportStrategyDto::Cancel => ImportStrategy::Cancel,
        ImportStrategyDto::Rename { new_name } => ImportStrategy::Rename { new_name },
        ImportStrategyDto::Overwrite => ImportStrategy::Overwrite,
    });

    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;
    let cancelled = matches!(strategy, Some(ImportStrategy::Cancel));
    let outcome = state
        .palette_service_mut()?
        .import_palette(std::path::Path::new(&source_path), scope, strategy)
        .map_err(translate)?;
    let dto = build_palette_list_dto(state.palette_service_ref()?)?;
    if outcome.is_some() && !cancelled {
        emit_state_changed(&app);
    }
    Ok(dto)
}

/// Dev stub until the project subsystem lands (research.md §10). Updates
/// `AppState.current_project_path` and swaps in/out the project store so the
/// rest of the palette commands exercise US3 manually.
#[tauri::command]
pub fn set_current_project_path(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    path: Option<String>,
) -> Result<PaletteListDto, AppError> {
    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;
    match path {
        Some(path_str) => {
            let project_path = PathBuf::from(&path_str);
            let palettes_dir = project_path.join("palettes");
            let store = Box::new(
                crate::infrastructure::palette_store_fs::FilesystemPaletteStore::new(
                    palettes_dir,
                    PaletteScope::Project,
                ),
            );
            state.current_project_path = Some(project_path.clone());
            state
                .palette_service_mut()?
                .set_project_store(store, project_path);
        }
        None => {
            state.current_project_path = None;
            state.palette_service_mut()?.clear_project_store();
        }
    }
    let dto = build_palette_list_dto(state.palette_service_ref()?)?;
    emit_state_changed(&app);
    Ok(dto)
}
