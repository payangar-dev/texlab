//! Tauri command wrappers for the Palette feature.
//!
//! All mutating commands emit `state-changed` so the frontend `paletteStore`
//! refetches. The service exposes `Result<_, DomainError>`; this layer
//! translates into the stable `AppError` codes consumed by the frontend
//! error classifier.

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::commands::dto::{
    AddColorOutcomeDto, AddColorResultDto, ImportStrategyDto, PaletteDto, PaletteListDto,
    PaletteScopeDto,
};
use crate::commands::emit_state_changed;
use crate::domain::{AddColorOutcome, Color, DomainError, PaletteId, PaletteScope};
use crate::error::AppError;
use crate::state::AppState;
use crate::use_cases::palette_service::{ImportStrategy, PaletteService};

fn new_palette_id() -> PaletteId {
    PaletteId::from_value(Uuid::new_v4().as_u128())
}

/// Translates a [`DomainError`] returned by `PaletteService` into an
/// [`AppError`] whose serialized string matches the stable error catalogue
/// consumed by the frontend classifier.
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
    scope: PaletteScopeDto,
) -> Result<PaletteListDto, AppError> {
    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;
    let id = new_palette_id();
    state
        .palette_service_mut()?
        .create_palette(id, &name, scope.into())
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
    let outcome = match outcome {
        AddColorOutcome::Added { index } => AddColorOutcomeDto::Added { index },
        AddColorOutcome::AlreadyPresent { index } => AddColorOutcomeDto::AlreadyPresent { index },
    };
    let dto = AddColorResultDto {
        outcome,
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
    scope: PaletteScopeDto,
    strategy: Option<ImportStrategyDto>,
) -> Result<PaletteListDto, AppError> {
    let strategy = strategy.map(|s| match s {
        ImportStrategyDto::Cancel => ImportStrategy::Cancel,
        ImportStrategyDto::Rename { new_name } => ImportStrategy::Rename {
            new_name,
            fresh_id: new_palette_id(),
        },
        ImportStrategyDto::Overwrite => ImportStrategy::Overwrite,
    });

    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;
    let outcome = state
        .palette_service_mut()?
        .import_palette(std::path::Path::new(&source_path), scope.into(), strategy)
        .map_err(translate)?;
    let dto = build_palette_list_dto(state.palette_service_ref()?)?;
    if outcome.is_some() {
        emit_state_changed(&app);
    }
    Ok(dto)
}

/// Dev stub: updates `AppState.current_project_path` and swaps the
/// project palette store in/out. Replaced once the project subsystem lands.
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

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    // The stable error-code prefixes below are a contract with the frontend
    // classifier (`src/api/paletteErrors.ts`). Do not change them without
    // updating both sides.

    #[test]
    fn translate_rule_violation_preserves_code() {
        let e = translate(DomainError::RuleViolation("duplicate-palette-name".into()));
        assert_eq!(e.to_string(), "duplicate-palette-name");
    }

    #[test]
    fn translate_io_error_prefixes_with_io_error() {
        let e = translate(DomainError::IoError {
            reason: "disk full".into(),
        });
        assert!(e.to_string().starts_with("io-error:"), "got {e}");
        assert!(e.to_string().contains("disk full"));
    }

    #[test]
    fn translate_invalid_index_yields_palette_index_out_of_range() {
        let e = translate(DomainError::InvalidIndex { index: 5, len: 2 });
        assert_eq!(e.to_string(), "palette-index-out-of-range");
    }

    #[test]
    fn translate_invalid_input_prefixes_with_invalid_input() {
        let e = translate(DomainError::InvalidInput {
            reason: "bad".into(),
        });
        assert!(e.to_string().starts_with("invalid-input:"), "got {e}");
    }

    #[test]
    fn new_palette_id_is_random() {
        let a = new_palette_id();
        let b = new_palette_id();
        assert_ne!(a, b);
    }
}
