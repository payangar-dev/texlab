/// Single source of truth for application state.
/// Shared between Tauri commands and MCP server via `Mutex`.
#[derive(Debug, Default)]
pub struct AppState {}
