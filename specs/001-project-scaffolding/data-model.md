# Data Model: Project Scaffolding

**Feature**: 001-project-scaffolding | **Date**: 2026-03-28

## Overview

This feature introduces only scaffolding — no functional domain entities. The data model defines the minimal state structure needed for the Tauri app to start and the placeholder types that will be expanded by subsequent features.

## Entities

### AppState

The single source of truth for the application, wrapped in `Mutex<AppState>` and shared between Tauri commands (frontend IPC) and the future MCP server (direct Rust calls).

| Field | Type | Description |
|-------|------|-------------|
| — | — | Empty struct for scaffolding. Fields added by future features (e.g., `editor: Option<EditorState>`, `project: Option<Project>`). |

**Lifecycle**: Created once at app startup in `lib.rs` via `tauri::Builder::default().manage(Mutex::new(AppState {}))`. Lives for the entire application lifetime.

**Location**: `src-tauri/src/state.rs`

### AppError

Unified error type for all Tauri commands. Implements `Serialize` for IPC transport.

| Variant | Description |
|---------|-------------|
| — | No variants for scaffolding. Future features add domain-specific variants (e.g., `IoError`, `ProjectNotFound`). |

**Location**: `src-tauri/src/error.rs`

## Relationships

```
AppState (1) ──manages── (0..*) [future domain entities]
     │
     ├── accessed by ── Tauri commands (via Mutex lock)
     └── accessed by ── MCP server handlers (via Mutex lock, future)
```

## State Transitions

No state transitions in scaffolding. The AppState is created empty and remains unchanged.

## Validation Rules

- AppState MUST be wrapped in `std::sync::Mutex` (not `tokio::Mutex`) for Tauri state management compatibility.
- AppError MUST implement `serde::Serialize` for Tauri IPC error transport.
- Domain types (future) MUST NOT have `Serialize`/`Deserialize` derives — separate DTOs in `commands/` handle serialization.
