# Research: App Shell with Dockable Panel System

**Feature**: 007-app-shell-panels | **Date**: 2026-03-30

## Decision 1: Dockview (not rc-dock)

**Decision**: Use `dockview ^5.2` as the dockable panel library.

**Rationale**: The constitution's Technology Stack explicitly lists dockview ^5.2. It is a zero-dependency layout manager with native React support, built-in serialization (`toJSON`/`fromJSON`), theming, and drag-and-drop. The GitHub issue originally mentioned rc-dock, but the constitution supersedes.

**Alternatives considered**:
- **rc-dock**: Mentioned in the GitHub issue. Less well-maintained, heavier dependency tree, less flexible serialization API.
- **Custom implementation**: Unjustified complexity per Simplicity principle.

## Decision 2: Canvas inside dockview (locked group)

**Decision**: The canvas viewport is a dockview panel inside its own group with a hidden header.

**Rationale**: Placing the canvas inside dockview means the library naturally manages resize between the canvas and side dock zones via splitters. A hidden header means there is no drag handle, so the user cannot accidentally move or close the canvas. This satisfies FR-007 (canvas always occupies center, cannot be removed or docked elsewhere).

**Alternatives considered**:
- **Canvas outside dockview (flex sibling)**: Would require custom resize logic between the canvas and dockview areas. More code, fragile, and duplicates what dockview already does.
- **Canvas as dockview watermark**: Watermark is for empty states, not permanent content. Wrong semantic.

## Decision 3: Layout persistence via Tauri commands

**Decision**: Persist the dockview serialized layout as a `workspace.json` file in the Tauri app data directory, using two Tauri commands (`save_workspace_layout`, `load_workspace_layout`).

**Rationale**: Constitution principle VII specifies file-based persistence for workspace layout. Using Tauri commands follows the Clean Architecture pattern (commands -> infrastructure) and keeps persistence consistent with future project file operations.

**Path mapping**: Tauri's `app_data_dir()` resolves to platform-correct locations:
- Windows: `%APPDATA%/com.texlab.app/`
- macOS: `~/Library/Application Support/com.texlab.app/`
- Linux: `~/.local/share/com.texlab.app/`

The constitution mentions `~/.texlab/workspace.json` — this was simplified notation. Platform-standard paths via Tauri are correct for cross-platform distribution.

**Alternatives considered**:
- **localStorage (WebView)**: Simpler, but constitution specifies file-based. Also not accessible from MCP or CLI tools.
- **Tauri plugin-store**: Adds a plugin dependency for a simple key-value operation. Two plain commands are simpler.

## Decision 4: Custom title bar

**Decision**: Implement a custom title bar by setting `decorations: false` in tauri.conf.json and rendering a React component with `data-tauri-drag-region`.

**Rationale**: The UI design shows a custom title bar containing the "TexLab" label, menu item labels (File, Edit, View, Tools, Help), and window controls. This cannot be achieved with the native OS title bar. The spec assumption states "The title bar displays the application name and menu items but menu functionality is out of scope."

**Implementation details**:
- `data-tauri-drag-region` attribute enables window dragging on the title bar area
- Window control buttons (minimize, maximize/restore, close) call Tauri window API (`getCurrentWindow().minimize()`, etc.)
- Menu items are non-functional labels for this feature (visual only)
- Height: 36px per design

**Alternatives considered**:
- **Native title bar + separate menu bar**: Two bars instead of one. Wastes vertical space and doesn't match the design.
- **macOS titleBarStyle "overlay"**: Only works on macOS. Cross-platform inconsistency.

## Decision 5: Custom panel header (dockview tabComponent)

**Decision**: Create a custom dockview `tabComponent` that renders a grip icon and panel title, with no close button.

**Rationale**: FR-004 requires each panel to have a header with a drag grip icon and title label. Panels MUST NOT have a close/hide button. Dockview's default tab includes a close button and lacks a grip icon. A custom `tabComponent` replaces this with the exact design specification.

**Implementation**: Use `IDockviewPanelHeaderProps` to create a React component. Register it via the `tabComponents` prop on `DockviewReact` and set it as `defaultTabComponent`.

## Decision 6: Lucide icons (lucide-react)

**Decision**: Use `lucide-react` for all icons (tool sidebar, panel grip, status bar).

**Rationale**: The UI design files use the Lucide icon font family throughout (grip-horizontal, eye, plus, trash-2, search, chevron-down, folder, package, etc.). Using `lucide-react` ensures pixel-perfect match with the design and provides tree-shakeable React components.

**Alternatives considered**:
- **Inline SVGs**: More control but harder to maintain, no icon search.
- **Other icon libraries** (Material, Feather): Design uses Lucide specifically.

## Decision 7: Disable floating panels

**Decision**: Set `disableFloating={true}` on `DockviewReact`.

**Rationale**: FR-005 states "Panels dock only — floating/detached windows are out of scope." Dockview supports floating panels by default; we explicitly disable this.

## Decision 8: Vertical stacking for right dock

**Decision**: Each right-side panel (Layers, Color, Palette, Model Preview) is added as a separate dockview panel positioned `below` the previous one, creating a vertical split chain.

**Rationale**: The design shows four panels stacked vertically in the right dock area, not as tabs. Dockview's `addPanel` with `position: { referencePanel: prev, direction: 'below' }` creates exactly this layout.

**Default heights** (from design, 900px total minus title 36px minus status 28px = 836px content):
- Layers: ~180px
- Color: ~180px
- Palette: ~130px
- Model Preview: fills remaining space

## Decision 9: Reset layout action placement

**Decision**: The "Reset layout" action (FR-015) will be available from the View menu label in the title bar. Since menu functionality is out of scope, the reset will also be accessible via a keyboard shortcut or a temporary placeholder mechanism until menus are implemented.

**Rationale**: FR-015 requires a reset action "accessible from a menu." Since menus are non-functional in this feature, we provide a keyboard shortcut (e.g., Ctrl+Shift+R) as an interim trigger.

## Decision 10: Fallback on invalid layout

**Decision**: Wrap `api.fromJSON()` in a try-catch. On failure (corrupted data, missing panels, schema mismatch), delete the saved layout file and apply the default layout.

**Rationale**: FR-010 and the edge case spec both require graceful fallback to the default layout when saved data is invalid. Since dockview throws on malformed input, a try-catch with fallback is sufficient.

## Design Token Reference (from UI design files)

| Token | Value | Usage |
|-------|-------|-------|
| Shell background | `#1E1E1E` | Main app background, right dock area |
| Panel body | `#252525` | Panel content area, tool sidebar |
| Panel header | `#2A2A2A` | Panel tab/header bar |
| Canvas area | `#2D2D2D` | Canvas viewport background |
| Title bar | `#161616` | Title bar background |
| Status bar | `#161616` | Status bar background |
| Separator | `#3A3A3A` | Borders, dividers between zones |
| Input field | `#333333` | Text inputs, action buttons |
| Selected item | `#3A3A3A` | Active/selected list items |
| Accent blue | `#4A9FD8` | Active tool, links, indicators |
| Text primary | `#E0E0E0` | Main text, app name |
| Text title | `#CCCCCC` | Panel titles, labels |
| Text secondary | `#888888` | Status bar text, secondary labels |
| Text muted | `#666666` | Disabled text, namespace labels |
| Text dim | `#555555` | Legend text, hint text |
| Icon default | `#555555` | Grip icons, inactive tool icons |
| Font UI | Inter | All UI text |
| Font mono | Geist Mono | Code/status values |
