# IPC Contract: Layout Persistence Commands

**Feature**: 007-app-shell-panels | **Date**: 2026-03-30

## Commands

### `save_workspace_layout`

Saves the serialized dockview layout to `workspace.json` in the app data directory.

**Direction**: Frontend -> Backend (Tauri invoke)

**Request**:
```typescript
invoke("save_workspace_layout", { layoutJson: string })
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `layoutJson` | `string` | Yes | JSON-serialized dockview layout (`JSON.stringify(api.toJSON())`) |

**Response**:
```typescript
Result<void, AppError>
```

**Behavior**:
- Creates the app data directory if it doesn't exist
- Writes `layoutJson` to `<app_data_dir>/workspace.json`, overwriting any existing file
- Returns `Ok(())` on success
- Returns `Err(AppError)` on I/O failure

**Rust signature**:
```rust
#[tauri::command]
pub fn save_workspace_layout(app: tauri::AppHandle, layout_json: String) -> Result<(), AppError>
```

---

### `load_workspace_layout`

Loads the serialized dockview layout from `workspace.json` in the app data directory.

**Direction**: Frontend -> Backend (Tauri invoke)

**Request**:
```typescript
invoke("load_workspace_layout")
```

No parameters.

**Response**:
```typescript
Result<string | null, AppError>
```

| Field | Type | Description |
|-------|------|-------------|
| (return) | `string \| null` | JSON string of saved layout, or `null` if no file exists |

**Behavior**:
- Reads `<app_data_dir>/workspace.json`
- Returns `Ok(Some(content))` if file exists and is readable
- Returns `Ok(None)` if file does not exist
- Returns `Err(AppError)` on I/O failure (permission denied, corrupted file, etc.)

**Rust signature**:
```rust
#[tauri::command]
pub fn load_workspace_layout(app: tauri::AppHandle) -> Result<Option<String>, AppError>
```

---

## File Location

```
<app_data_dir>/workspace.json
```

Platform-specific paths (resolved by Tauri at runtime):
- **Windows**: `%APPDATA%/com.texlab.app/workspace.json`
- **macOS**: `~/Library/Application Support/com.texlab.app/workspace.json`
- **Linux**: `~/.local/share/com.texlab.app/workspace.json`

## Frontend API Wrappers

```typescript
// src/api/commands.ts

export async function saveWorkspaceLayout(layoutJson: string): Promise<void> {
  return invoke("save_workspace_layout", { layoutJson });
}

export async function loadWorkspaceLayout(): Promise<string | null> {
  return invoke("load_workspace_layout");
}
```

## Error Handling

| Scenario | Backend behavior | Frontend behavior |
|----------|-----------------|-------------------|
| File doesn't exist | Return `Ok(None)` | Apply default layout |
| File read error | Return `Err(AppError::Io(...))` | Log warning, apply default layout |
| File write error | Return `Err(AppError::Io(...))` | Log warning, continue (layout in memory) |
| Invalid JSON in file | Not validated by backend | Frontend catches in `fromJSON()`, applies default |
