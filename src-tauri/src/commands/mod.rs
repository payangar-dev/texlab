//! Tauri command wrappers layer.
//!
//! Thin `#[tauri::command]` functions that delegate to use cases.
//! Handles IPC serialization (DTOs) and returns `Result<T, AppError>`.
