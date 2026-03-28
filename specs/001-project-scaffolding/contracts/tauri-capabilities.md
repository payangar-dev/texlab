# Contract: Tauri Capabilities

**Feature**: 001-project-scaffolding | **Date**: 2026-03-28

## Overview

Tauri v2 uses a capability-based permission system. Each window declares which APIs it can access. For scaffolding, only the default core permissions are needed.

## Default Capability (`src-tauri/capabilities/default.json`)

```json
{
  "identifier": "default",
  "description": "Default capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default"
  ]
}
```

### Permission Breakdown

| Permission | Scope | Purpose |
|------------|-------|---------|
| `core:default` | Main window | Basic Tauri core functionality (window management, app lifecycle). Includes safe defaults for event listening. |

### Future Permissions (not included in scaffolding)

| Permission | When Needed |
|------------|-------------|
| `core:event:default` | When frontend needs custom event subscriptions |
| `dialog:default` | When file open/save dialogs are implemented |
| `fs:default` | When filesystem access is needed for project/source management |
| `shell:default` | If external process launching is needed |

## Security Notes

- Capabilities follow the principle of least privilege. Only `core:default` is granted initially.
- Each new feature that requires additional APIs MUST explicitly add the corresponding permission.
- The `windows` array restricts permissions to named windows — no global grants.
