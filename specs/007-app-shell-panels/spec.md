# Feature Specification: App Shell with Dockable Panel System

**Feature Branch**: `007-app-shell-panels`
**Created**: 2026-03-30
**Status**: Draft
**Issue**: #7
**Input**: GitHub Issue — "App shell with dockable panel system (rc-dock)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Default Editor Layout (Priority: P1)

A resource pack creator opens TexLab and sees the full editor workspace: a title bar at the top, a vertical tool sidebar on the far left, a Sources panel on the left side, the canvas viewport in the center, and a right dock area stacking Layers, Color, Palette, and Model Preview panels. A status bar sits at the bottom. This default layout gives the user immediate access to all essential editing areas without any configuration.

**Why this priority**: Without the shell layout, no other feature can be used in context. This is the foundation for the entire editing experience.

**Independent Test**: Can be verified by launching the application and confirming all panels are visible in their expected positions with correct proportions.

**Acceptance Scenarios**:

1. **Given** the application is launched, **When** the main window renders, **Then** the user sees a title bar, a tools sidebar (far left), a Sources panel (left), a canvas viewport (center), a right dock area with Layers/Color/Palette/Model Preview panels stacked vertically, and a status bar (bottom).
2. **Given** the default layout is displayed, **When** the user inspects each panel, **Then** every panel has a header with a grip icon and a title label, and a body content area below.
3. **Given** the default layout is displayed, **When** the window is at its default size (1440×900), **Then** the Sources panel is approximately 240px wide, the right dock area is approximately 280px wide, the tools sidebar is approximately 48px wide, and the canvas fills the remaining space.

---

### User Story 2 - Rearrange Panels by Drag and Drop (Priority: P2)

A user wants to customize their workspace to better suit their workflow. They grab a panel by its header grip icon and drag it to a new position — for example, moving the Layers panel from the right dock to a tab alongside the Sources panel on the left. The panel detaches from its current position and docks into the new target area. The layout updates fluidly.

**Why this priority**: Workspace customization is the core value proposition of a dockable panel system. Users have different workflows and need to organize panels to match their habits.

**Independent Test**: Can be tested by dragging any panel header and dropping it in a different dock zone, verifying it docks correctly.

**Acceptance Scenarios**:

1. **Given** the default layout is displayed, **When** the user drags a panel by its grip icon, **Then** a visual indicator shows the panel is being moved and potential drop targets are highlighted.
2. **Given** a panel is being dragged, **When** the user drops it onto a valid dock zone (left, right, top, bottom, or as a tab alongside another panel), **Then** the panel docks in the new position and the surrounding layout adjusts to accommodate it.
3. **Given** a panel has been moved to a new position, **When** the user inspects the layout, **Then** the canvas viewport still occupies the central area and is never hidden behind other panels.

---

### User Story 3 - Persist and Restore Workspace Layout (Priority: P3)

A user has spent time arranging panels to match their preferred workflow. They close the application and reopen it later. The workspace restores exactly as they left it — same panel positions, same sizes, same tab groupings. The user does not need to reconfigure their layout every session.

**Why this priority**: Without persistence, the drag-and-drop customization from P2 loses most of its value. Users expect their workspace to be remembered.

**Independent Test**: Can be tested by rearranging panels, closing the application, reopening it, and verifying the layout matches the arrangement from before closing.

**Acceptance Scenarios**:

1. **Given** the user has customized their panel layout, **When** they close and reopen the application, **Then** the workspace layout is restored to the exact arrangement from the previous session.
2. **Given** no saved layout exists (first launch or reset), **When** the application opens, **Then** the default layout is applied.
3. **Given** a saved layout references a panel that is no longer available (e.g., after an update), **When** the application opens, **Then** the system gracefully falls back to the default layout without errors.

---

### User Story 4 - Dark Theme Consistency (Priority: P2)

The entire application shell — title bar, tools sidebar, panels, dock areas, status bar — uses a consistent dark theme. Panel headers have a slightly lighter background than panel bodies. The tools sidebar uses a distinct dark shade. The overall look matches the project's design files, providing a professional and cohesive editing environment.

**Why this priority**: Visual consistency is essential for a professional desktop application. An inconsistent theme would undermine user trust and comfort during extended editing sessions.

**Independent Test**: Can be tested by visually comparing the rendered application against the UI design reference for color consistency across all shell areas.

**Acceptance Scenarios**:

1. **Given** the application is launched, **When** the user inspects the shell, **Then** all areas use the dark color scheme: main background is dark (#1E1E1E family), panel backgrounds are slightly lighter (#252525), panel headers are distinguishable (#2A2A2A), and the tools sidebar has its own shade (#252525).
2. **Given** the user is viewing the editor, **When** they look at text elements, **Then** titles are light (#CCCCCC), secondary text is muted (#888888), and icons follow the same color hierarchy.

---

### Edge Cases

- What happens when the user drags all panels out of a dock area? The dock area collapses and the canvas expands to fill the freed space.
- What happens when the window is resized to a very small size? Panels maintain minimum viable dimensions and do not overlap or break layout. Scrollbars or collapsing may occur.
- What happens when the user drags a panel onto the canvas area? The canvas should remain as the central content area; panels cannot replace it.
- What happens if the persisted layout data is corrupted or invalid? The application falls back to the default layout without crashing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Application MUST display a main shell composed of: title bar, tools sidebar, dock area, and status bar.
- **FR-002**: The tools sidebar MUST be a fixed vertical strip on the far left, displaying tool icons. It is NOT part of the dockable panel system.
- **FR-003**: The dock area MUST support the following panels: Sources, Layers, Color, Palette, and Model Preview.
- **FR-004**: Each panel MUST have a header containing a drag grip icon and the panel title. Panels MUST NOT have a close/hide button; all panels are always visible.
- **FR-005**: Users MUST be able to drag panels by their header to rearrange them within the dock area. Panels dock only — floating/detached windows are out of scope.
- **FR-006**: The dock area MUST support multiple zones: left side dock, right side dock, and tabbed groupings within a zone.
- **FR-014**: Users MUST be able to resize dock zones by dragging the separators between them. Resized dimensions MUST be included in the persisted layout.
- **FR-007**: The canvas viewport MUST always occupy the central area and cannot be removed, closed, or docked elsewhere.
- **FR-008**: The default layout MUST position Sources on the left, Canvas in the center, and Layers + Color + Palette + Model Preview stacked vertically on the right.
- **FR-009**: The system MUST persist the user's panel layout across application restarts.
- **FR-010**: The system MUST restore the persisted layout on application start, or fall back to the default layout if no valid saved layout exists.
- **FR-015**: The application MUST provide a "Reset layout" action (accessible from a menu) that restores the default panel arrangement.
- **FR-011**: The status bar MUST remain fixed at the bottom of the window, outside the dock area.
- **FR-012**: All shell components MUST use the dark theme defined in the design files.
- **FR-013**: Panel bodies MUST serve as containers for future feature-specific content (e.g., layer list, color picker). For this feature, panels display their title as placeholder content if no real content exists yet.

### Key Entities

- **Panel**: A dockable UI region with a header (grip icon + title) and a body (content area). Panels can be moved between dock zones. Each panel has a unique identity (e.g., "Sources", "Layers").
- **Dock Zone**: A region of the layout that can host one or more panels. Zones can be arranged as side-by-side splits or tabbed groups.
- **Workspace Layout**: The complete arrangement of all panels and dock zones. Represents the user's customized workspace state.
- **Default Layout**: The predefined panel arrangement used on first launch or when no valid saved layout exists.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On first launch, the complete editor shell (title bar, tools sidebar, 5 panels, canvas, status bar) renders within 2 seconds.
- **SC-002**: Users can drag and dock a panel to a new position in under 3 seconds with clear visual feedback throughout.
- **SC-003**: After rearranging panels and restarting the application, the layout is restored identically 100% of the time.
- **SC-004**: The default layout matches the UI design reference: Sources left, Canvas center, Layers/Color/Palette/Model Preview stacked right.
- **SC-005**: All shell areas pass a visual consistency check against the dark theme defined in the design files.

## Clarifications

### Session 2026-03-30

- Q: Les utilisateurs peuvent-ils fermer/masquer des panneaux individuels ? → A: Non, les panneaux sont toujours visibles. La fermeture/masquage sera une feature separee.
- Q: Les utilisateurs peuvent-ils redimensionner les panneaux via les separateurs ? → A: Oui, separateurs redimensionnables par glisser entre les zones.
- Q: Les panneaux peuvent-ils etre detaches en fenetres flottantes ? → A: Non, dock uniquement. Le detachement sera envisage plus tard.
- Q: L'utilisateur peut-il revenir manuellement au layout par defaut ? → A: Oui, via une option "Reset layout" dans un menu.

## Assumptions

- Dependency #1 (project scaffolding) is completed and the application framework is in place.
- The canvas viewport component already exists and will be integrated into the shell layout as-is.
- The status bar component already exists and will be placed at the bottom of the shell.
- Panel content (layer list, color picker, etc.) will be implemented in separate features. This feature provides the panel containers and the docking infrastructure.
- The tools sidebar is a static component for this feature. Tool interaction logic is handled by separate features.
- The title bar displays the application name and menu items but menu functionality is out of scope for this feature.
- Layout persistence uses local storage on the user's machine (no remote sync).
- The application targets desktop only (cross-platform via the existing framework). No mobile or responsive layout is required.
