# Quickstart: App Shell with Dockable Panel System

**Feature**: 007-app-shell-panels | **Date**: 2026-03-30

## Prerequisites

- Node.js >= 20 LTS
- Rust >= 1.77
- Existing TexLab dev environment (`npm install` + `cargo build` passing)

## New Dependencies

### Frontend

```bash
npm install dockview@^5.2 lucide-react
```

- **dockview**: Zero-dependency dockable panel layout manager with React support
- **lucide-react**: Icon library (matches the UI design's lucide icon set)

### Backend

No new Rust crates needed. Layout commands use only `std::fs`, `std::path`, `tauri::AppHandle`, and existing `AppError`.

## Development Workflow

### 1. Run the dev server

```bash
npm run tauri dev
```

### 2. Key files to edit

| Task | File(s) |
|------|---------|
| Shell layout | `src/components/shell/AppShell.tsx` |
| Title bar | `src/components/shell/TitleBar.tsx` |
| Tools sidebar | `src/components/shell/ToolsSidebar.tsx` |
| Dockview setup | `src/components/shell/DockLayout.tsx` |
| Panel header | `src/components/panels/PanelHeader.tsx` |
| Panel placeholders | `src/components/panels/*.tsx` |
| Layout persistence (frontend) | `src/store/layoutStore.ts` |
| Layout persistence (backend) | `src-tauri/src/commands/layout_commands.rs` |
| File I/O | `src-tauri/src/infrastructure/workspace_io.rs` |
| Dockview theme | `src/styles/dockview-theme.css` |

### 3. Tauri configuration changes

**`src-tauri/tauri.conf.json`** — disable native decorations for custom title bar:
```json
{
  "app": {
    "windows": [{
      "decorations": false
    }]
  }
}
```

**`src-tauri/capabilities/default.json`** — add permissions for app data directory and window control:
```json
{
  "permissions": [
    "core:default",
    "core:window:allow-close",
    "core:window:allow-set-title",
    "core:window:allow-minimize",
    "core:window:allow-maximize",
    "core:window:allow-unmaximize",
    "core:window:allow-toggle-maximize",
    "dialog:default",
    "core:path:default"
  ]
}
```

## Design Token Reference

Apply these colors in `src/styles/dockview-theme.css` to override dockview's defaults:

| Element | Color |
|---------|-------|
| Shell background | `#1E1E1E` |
| Panel body | `#252525` |
| Panel header / tab bar | `#2A2A2A` |
| Canvas background | `#2D2D2D` |
| Title bar | `#161616` |
| Status bar | `#161616` |
| Tool sidebar | `#252525` |
| Separator / sash | `#3A3A3A` |
| Active accent | `#4A9FD8` |
| Text primary | `#E0E0E0` |
| Text title (panels) | `#CCCCCC` |
| Text secondary | `#888888` |
| Icon default | `#555555` |

### Typography

- UI font: `Inter, system-ui, -apple-system, sans-serif`
- Mono font: `"Geist Mono", monospace`
- Panel title: Inter 10px, weight 600
- Status bar: Geist Mono 10px
- Menu items: Inter 12px
- App name: Inter 13px, weight 600

## Testing

### Frontend tests

```bash
npm run test
```

Key test scenarios:
- Default layout renders all 6 panels in correct positions
- Panel header displays grip icon + title, no close button
- Layout save is triggered on `onDidLayoutChange`
- Layout restore on app launch (mock `invoke`)
- Fallback to default when saved layout is invalid
- Reset layout restores default and clears saved data
- Tools sidebar displays all tool icons with correct active state

### Backend tests

```bash
cd src-tauri && cargo test
```

Key test scenarios:
- `write_workspace` creates file and parent directories
- `read_workspace` returns `None` when file doesn't exist
- `read_workspace` returns content when file exists
- `delete_workspace` removes file without error if missing

## Dockview API Quick Reference

```typescript
// Import
import { DockviewReact, DockviewReadyEvent, DockviewApi, SerializedDockview } from "dockview";
import "dockview/dist/styles/dockview.css";

// Component
<DockviewReact
  className="dockview-theme-dark"
  components={panelComponents}       // { sources: SourcesPanel, canvas: CanvasViewport, ... }
  tabComponents={tabComponents}      // { panelTab: PanelHeader }
  defaultTabComponent={PanelHeader}
  onReady={handleReady}
  disableFloating={true}
/>

// Default layout (in onReady callback)
api.addPanel({ id: "sources", component: "sources", title: "Sources",
  position: { direction: "left" }, initialWidth: 240 });
api.addPanel({ id: "canvas", component: "canvas",
  title: "" }); // center, fills remaining
api.addPanel({ id: "layers", component: "layers", title: "Layers",
  position: { direction: "right" }, initialWidth: 280 });
// ... color, palette, model-preview positioned below each other

// Serialization
const layout: SerializedDockview = api.toJSON();
api.fromJSON(savedLayout);

// Auto-save on change
api.onDidLayoutChange(() => { saveWorkspaceLayout(JSON.stringify(api.toJSON())); });
```
