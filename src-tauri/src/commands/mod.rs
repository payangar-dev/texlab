//! Tauri command wrappers layer.
//!
//! Thin `#[tauri::command]` functions that delegate to use cases.
//! Handles IPC serialization (DTOs) and returns `Result<T, AppError>`.

pub mod dto;
pub mod history_commands;
pub mod layer_commands;
pub mod layout_commands;
pub mod state_commands;
pub mod texture_commands;
pub mod tool_commands;

pub use history_commands::*;
pub use layer_commands::*;
pub use layout_commands::*;
pub use state_commands::*;
pub use texture_commands::*;
pub use tool_commands::*;

use tauri::{AppHandle, Emitter};

/// Emits the `state-changed` event to notify the frontend of state mutations.
/// Logs failures instead of silently discarding them.
pub(crate) fn emit_state_changed(app: &AppHandle) {
    if let Err(e) = app.emit("state-changed", ()) {
        eprintln!("[texlab] failed to emit state-changed: {e}");
    }
}
