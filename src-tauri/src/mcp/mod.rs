//! Embedded MCP server layer.
//!
//! Exposes application functionality to AI agents via Streamable HTTP (rmcp).
//! Shares `Mutex<AppState>` with Tauri commands for unified state access.
