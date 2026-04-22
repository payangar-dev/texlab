#![warn(clippy::unwrap_used)]

mod commands;
mod domain;
mod error;
mod infrastructure;
mod mcp;
mod state;
mod use_cases;

use std::sync::Mutex;

use tauri::Manager;

use domain::PaletteScope;
use infrastructure::palette_file::TexpalCodec;
use infrastructure::palette_state_io::FsActiveMemoryStore;
use infrastructure::palette_store_fs::FilesystemPaletteStore;
use state::AppState;
use use_cases::palette_service::PaletteService;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(AppState::default()))
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("app_data_dir resolution failed: {e}"))?;
            let palettes_root = app_data_dir.join("palettes");
            std::fs::create_dir_all(&app_data_dir).ok();
            let global_store = Box::new(FilesystemPaletteStore::new(
                palettes_root,
                PaletteScope::Global,
            ));
            let memory_store = Box::new(FsActiveMemoryStore::new(app_data_dir.clone()));
            let codec = Box::new(TexpalCodec);
            let service = PaletteService::new(global_store, memory_store, codec)
                .map_err(|e| format!("palette service init failed: {e}"))?;
            let state = app.state::<Mutex<AppState>>();
            let mut guard = state.lock().expect("state lock");
            guard.palette_service = Some(service);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_texture,
            commands::save_texture,
            commands::create_texture,
            commands::tool_press,
            commands::tool_drag,
            commands::tool_release,
            commands::add_layer,
            commands::remove_layer,
            commands::move_layer,
            commands::set_layer_opacity,
            commands::set_layer_visibility,
            commands::set_layer_blend_mode,
            commands::set_layer_name,
            commands::set_layer_locked,
            commands::duplicate_layer,
            commands::undo,
            commands::redo,
            commands::get_editor_state,
            commands::get_composite,
            commands::save_workspace_layout,
            commands::load_workspace_layout,
            commands::get_palettes,
            commands::set_active_palette,
            commands::create_palette,
            commands::rename_palette,
            commands::delete_palette,
            commands::add_color_to_active_palette,
            commands::remove_color_from_active_palette_at,
            commands::export_palette,
            commands::import_palette,
            commands::set_current_project_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
