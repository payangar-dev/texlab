# Data Model: App Shell with Dockable Panel System

**Feature**: 007-app-shell-panels | **Date**: 2026-03-30

## Entities

### Panel Identity

Each dockable panel has a fixed identity used as its dockview panel ID and component key.

| Panel ID | Display Title | Default Position | Default Size |
|----------|--------------|-----------------|--------------|
| `sources` | Sources | Left dock | 240px wide |
| `canvas` | (hidden header) | Center | Fills remaining space |
| `layers` | Layers | Right dock, top | ~180px tall |
| `color` | Color | Right dock, 2nd | ~180px tall |
| `palette` | Palette | Right dock, 3rd | ~130px tall |
| `model-preview` | Model Preview | Right dock, bottom | Fills remaining |

Panel IDs are string constants (TypeScript `as const` object). They are used in:
- `api.addPanel({ id })` for dockview registration
- `components` map passed to `DockviewReact`
- Layout serialization/deserialization (saved in workspace.json)

### Workspace Layout (serialized)

```typescript
// Dockview provides this type — we wrap it for persistence
type SerializedLayout = SerializedDockview; // from 'dockview'

// Stored in workspace.json
interface WorkspaceFile {
  version: 1;
  dockview: SerializedLayout;
}
```

The `version` field enables future migrations if the layout schema changes.

### Default Layout

The default layout is a function, not stored data. It programmatically adds panels via the dockview API:

```
1. addPanel("sources")          → position: { direction: "left" }, initialWidth: 240
2. addPanel("canvas")           → fills center (no position = remaining space)
3. addPanel("layers")           → position: { direction: "right" }, initialWidth: 280
4. addPanel("color")            → position: { referencePanel: "layers", direction: "below" }
5. addPanel("palette")          → position: { referencePanel: "color", direction: "below" }
6. addPanel("model-preview")    → position: { referencePanel: "palette", direction: "below" }
```

After building, the canvas group header is hidden. FR-008 is satisfied.

### Tool Sidebar Items

The tools sidebar is a static list (not dockable). Tool definitions already exist in `toolStore.ts`.

| Icon | Tool Type | Lucide Icon Name |
|------|-----------|-----------------|
| Brush | `brush` | `paintbrush` |
| Eraser | `eraser` | `eraser` |
| Fill | `fill` | `paint-bucket` |
| Eyedropper | `eyedropper` | `pipette` |
| Line | `line` | `minus` |
| Selection | `rectangle` | `square-dashed` |
| (divider) | — | — |
| Undo | action | `undo-2` |
| Redo | action | `redo-2` |

The active tool is highlighted with `#4A9FD8` background, matching the existing `toolStore.activeToolType`.

### Title Bar Menu Items

Static labels, non-functional for this feature. Array of strings:

```typescript
const MENU_ITEMS = ["File", "Edit", "View", "Tools", "Help"] as const;
```

## Relationships

```
AppShell
  TitleBar          — static, always at top (h36)
  Content area      — horizontal flex
    ToolsSidebar    — static, always at far left (w48)
    DockLayout      — DockviewReact fills remaining space
      Sources       — dockable panel (left)
      Canvas        — locked panel (center, hidden header)
      Layers        — dockable panel (right)
      Color         — dockable panel (right, below layers)
      Palette       — dockable panel (right, below color)
      ModelPreview  — dockable panel (right, bottom)
  StatusBar         — static, always at bottom (h28)
```

## Validation Rules

- **Panel IDs are unique and fixed**: The set of 6 panel IDs is hardcoded. Users cannot create or delete panels.
- **Canvas is always present**: If a restored layout is missing the canvas panel, fallback to default.
- **All panels must be present**: If any panel is missing from a restored layout, fallback to default.
- **Layout version check**: If `workspace.json` has a different `version` than expected, fallback to default.

## State Transitions

### Layout Lifecycle

```
App Launch
  load_workspace_layout() → JSON string | null
    JSON present → parse → validate → fromJSON()
      Success → restored layout
      Failure → apply default layout + delete invalid file
    null → apply default layout (first launch)

User rearranges panels
  onDidLayoutChange → toJSON() → save_workspace_layout(JSON)

User triggers "Reset layout"
  delete saved file → apply default layout → save
```

## Types (TypeScript)

```typescript
// Panel identity constants
const PANEL_IDS = {
  SOURCES: "sources",
  CANVAS: "canvas",
  LAYERS: "layers",
  COLOR: "color",
  PALETTE: "palette",
  MODEL_PREVIEW: "model-preview",
} as const;

type PanelId = (typeof PANEL_IDS)[keyof typeof PANEL_IDS];

// Workspace persistence
interface WorkspaceFile {
  version: number;
  dockview: SerializedDockview;
}
```

## Types (Rust)

No new domain types. The layout commands pass raw JSON strings:

```rust
// commands/layout_commands.rs
#[tauri::command]
fn save_workspace_layout(app: tauri::AppHandle, layout_json: String) -> Result<(), AppError>

#[tauri::command]
fn load_workspace_layout(app: tauri::AppHandle) -> Result<Option<String>, AppError>
```

The infrastructure layer handles file I/O:

```rust
// infrastructure/workspace_io.rs
pub fn write_workspace(app_data_dir: &Path, json: &str) -> Result<(), std::io::Error>
pub fn read_workspace(app_data_dir: &Path) -> Result<Option<String>, std::io::Error>
pub fn delete_workspace(app_data_dir: &Path) -> Result<(), std::io::Error>
```
