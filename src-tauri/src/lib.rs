mod commands;
mod domain;
mod error;
mod infrastructure;
mod mcp;
mod state;
mod use_cases;

use std::sync::Mutex;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(AppState::default()))
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
            commands::undo,
            commands::redo,
            commands::get_editor_state,
            commands::get_composite,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
