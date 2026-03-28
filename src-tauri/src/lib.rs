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
        .manage(Mutex::new(AppState {}))
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
