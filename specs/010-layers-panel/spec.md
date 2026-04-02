# Feature Specification: Layers Panel

**Feature Branch**: `010-layers-panel`  
**Created**: 2026-04-01  
**Status**: Draft  
**Input**: GitHub Issue #10 — Layers panel (UI, drag reorder, visibility, opacity, blend mode)

## Clarifications

### Session 2026-04-01

- Q: Blend mode dropdown placement — per-layer row or panel-level? → A: Panel-level, un seul dropdown appliqué au calque actif (standard Photoshop/Krita). Le design UI est mis à jour en conséquence.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View and Select Layers (Priority: P1)

A texture creator opens a texture for editing and sees a dockable "Layers" panel listing all layers of the current texture. Each layer row shows a visibility icon, a thumbnail preview, the layer name, and its opacity value. The currently active layer is visually highlighted. The user clicks on a different layer row to make it the active layer.

**Why this priority**: Layer visibility and selection is the foundational interaction — every other layer operation depends on the user being able to see and select layers.

**Independent Test**: Can be fully tested by opening a multi-layer texture and verifying that all layers appear with correct metadata, and that clicking a layer changes the active selection.

**Acceptance Scenarios**:

1. **Given** a texture with 3 layers is open, **When** the user views the Layers panel, **Then** all 3 layers are listed in stack order (topmost layer first) with their name, thumbnail, visibility icon, and opacity value.
2. **Given** the Layers panel is visible, **When** the user clicks on a non-active layer row, **Then** that layer becomes the active layer and its row is visually highlighted.
3. **Given** a texture is open, **When** the Layers panel first appears, **Then** the previously active layer (or topmost layer if none) is highlighted.

---

### User Story 2 - Add, Delete, and Duplicate Layers (Priority: P1)

A texture creator uses the action buttons at the bottom of the Layers panel to manage layers. They can add a new empty layer, delete the currently selected layer, or duplicate the selected layer. After each action, the layer list updates immediately.

**Why this priority**: Creating and removing layers is essential for any multi-layer editing workflow — without this, the panel is read-only and offers no editing value.

**Independent Test**: Can be fully tested by using each action button and verifying the layer list reflects the change, with the new or duplicated layer becoming active.

**Acceptance Scenarios**:

1. **Given** a texture is open, **When** the user clicks the "Add" button, **Then** a new empty layer is inserted above the active layer and becomes the new active layer.
2. **Given** a texture with multiple layers is open and a layer is selected, **When** the user clicks the "Delete" button, **Then** the selected layer is removed and the nearest remaining layer becomes active.
3. **Given** a texture with at least one layer, **When** the user clicks the "Duplicate" button, **Then** a copy of the active layer is inserted directly above it, with the name suffixed (e.g., "Base (copy)"), and becomes the new active layer.
4. **Given** a texture with only one layer, **When** the user clicks the "Delete" button, **Then** the deletion is prevented and the user is informed that at least one layer must exist.

---

### User Story 3 - Toggle Layer Visibility (Priority: P2)

A texture creator clicks the eye icon on a layer row to hide or show that layer on the canvas. Hidden layers remain in the list but are visually dimmed, and their content is not rendered on the canvas.

**Why this priority**: Visibility toggling is a core compositing workflow — artists need to isolate layers for inspection and comparison.

**Independent Test**: Can be fully tested by toggling a layer's visibility and verifying the canvas updates to show/hide that layer's content, and the eye icon reflects the current state.

**Acceptance Scenarios**:

1. **Given** a visible layer, **When** the user clicks its eye icon, **Then** the layer becomes hidden, its row is visually dimmed, and its content disappears from the canvas.
2. **Given** a hidden layer, **When** the user clicks its eye icon, **Then** the layer becomes visible again, its row returns to normal appearance, and its content reappears on the canvas.
3. **Given** a hidden layer, **When** the user selects it and draws, **Then** drawing operations still apply to the hidden layer (visibility does not affect editability).

---

### User Story 4 - Reorder Layers by Drag and Drop (Priority: P2)

A texture creator drags a layer row to a different position in the list to change the layer stacking order. The canvas updates in real time to reflect the new order.

**Why this priority**: Layer ordering directly affects the visual result of compositing — artists frequently rearrange layers during the creative process.

**Independent Test**: Can be fully tested by dragging a layer from one position to another and verifying the list order and canvas rendering both update accordingly.

**Acceptance Scenarios**:

1. **Given** a texture with 3+ layers, **When** the user drags a layer row to a new position, **Then** the layer list reorders to reflect the new position and the canvas re-renders with the updated stacking order.
2. **Given** a drag operation is in progress, **When** the user moves the layer over other rows, **Then** a visual indicator shows where the layer will be inserted.
3. **Given** a drag operation is in progress, **When** the user releases outside the valid drop area, **Then** the operation is cancelled and the original order is preserved.

---

### User Story 5 - Rename a Layer (Priority: P2)

A texture creator renames a layer by double-clicking its name or pressing F2 while a layer is selected. An inline text field appears, and the new name is saved when the user presses Enter or clicks away.

**Why this priority**: Meaningful layer names improve workflow organization, especially for textures with many layers.

**Independent Test**: Can be fully tested by triggering rename mode, typing a new name, confirming, and verifying the name persists.

**Acceptance Scenarios**:

1. **Given** a layer is selected, **When** the user double-clicks its name, **Then** an inline text input appears pre-filled with the current name.
2. **Given** a layer is selected, **When** the user presses F2, **Then** an inline text input appears pre-filled with the current name.
3. **Given** the rename input is active, **When** the user presses Enter, **Then** the new name is saved and the input closes.
4. **Given** the rename input is active, **When** the user presses Escape, **Then** the rename is cancelled and the original name is restored.
5. **Given** the rename input is active, **When** the user clicks outside the input, **Then** the new name is saved and the input closes.

---

### User Story 6 - Change Layer Blend Mode (Priority: P3)

A texture creator selects a blend mode from a panel-level dropdown (above or below the layer list) to change how the active layer composites with layers below it. Available modes include Normal, Multiply, Screen, and Overlay. The canvas updates immediately.

**Why this priority**: Blend modes are important for advanced compositing but not required for basic layer editing workflows.

**Independent Test**: Can be fully tested by changing a layer's blend mode and verifying the canvas renders the layer with the selected blending algorithm.

**Acceptance Scenarios**:

1. **Given** a layer is active, **When** the user opens the panel-level blend mode dropdown, **Then** the available options are: Normal, Multiply, Screen, Overlay, and the active layer's current mode is shown as selected.
2. **Given** a layer with "Normal" blend mode is active, **When** the user selects "Multiply" from the dropdown, **Then** the blend mode changes and the canvas re-renders with Multiply compositing.
3. **Given** a different layer is selected, **When** the user views the blend mode dropdown, **Then** it reflects the newly selected layer's blend mode.

---

### Edge Cases

- What happens when the texture has no layers (empty state)? The panel shows an empty state message prompting the user to add a layer.
- What happens when the user tries to rename a layer with an empty name? The rename is rejected and the previous name is kept.
- What happens when many layers exist (e.g., 20+)? The layer list scrolls vertically; the header and action bar remain fixed.
- What happens when the user selects a layer and then switches to a different texture? The panel updates to show the new texture's layers with its own active layer.
- What happens when a layer is modified from outside the panel (e.g., via MCP)? The panel receives an event and updates to reflect the current state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a dockable "Layers" panel that can be positioned within the panel layout system.
- **FR-002**: System MUST list all layers of the currently active texture in stacking order (topmost first).
- **FR-003**: Each layer row MUST display: a visibility toggle icon, a thumbnail preview, the layer name, and the opacity value.
- **FR-004**: System MUST visually highlight the currently active layer.
- **FR-005**: Users MUST be able to select a layer by clicking its row.
- **FR-006**: Users MUST be able to add a new empty layer via an "Add" action button.
- **FR-007**: Users MUST be able to delete the selected layer via a "Delete" action button, with a minimum of one layer enforced.
- **FR-008**: Users MUST be able to duplicate the selected layer via a "Duplicate" action button.
- **FR-009**: Users MUST be able to toggle layer visibility by clicking the eye icon.
- **FR-010**: Users MUST be able to reorder layers via drag and drop within the list.
- **FR-011**: Users MUST be able to rename a layer by double-clicking its name or pressing F2.
- **FR-012**: System MUST provide a panel-level blend mode dropdown (applying to the active layer) with at least: Normal, Multiply, Screen, Overlay.
- **FR-013**: All layer changes MUST synchronize with the backend state and update the canvas in real time.
- **FR-014**: The layer list MUST scroll when the number of layers exceeds the panel height, while the header and action bar remain fixed.

### Key Entities

- **Layer**: A single compositing layer within a texture. Key attributes: name, visibility, opacity, blend mode, stacking position, pixel data (thumbnail derived from this).
- **Layer List**: Ordered collection of layers belonging to the active texture, rendered in stacking order.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view all layers of a texture and identify the active layer within 1 second of opening the panel.
- **SC-002**: Users can add, delete, or duplicate a layer with a single click, and the panel and canvas update within 500ms.
- **SC-003**: Users can reorder layers via drag and drop, with the canvas reflecting the new order immediately upon drop.
- **SC-004**: Users can toggle layer visibility with a single click, with the canvas updating instantly.
- **SC-005**: Users can rename a layer in place in under 3 seconds (trigger + type + confirm).
- **SC-006**: Users can change a layer's blend mode from a dropdown, with the canvas reflecting the change immediately.
- **SC-007**: The panel remains responsive and scrollable with up to 50 layers.

## Assumptions

- The dockable panel system is already implemented (dependency: #7, completed).
- Backend layer Tauri commands exist or will be available (dependency: #5) — this feature depends on those commands for state synchronization.
- Layer thumbnail generation is handled by the backend; the frontend receives an image representation to display.
- The panel follows the existing dark theme and design tokens established in the UI design (`ui-design` — component/Panel-Layers).
- Blend modes beyond Normal, Multiply, Screen, and Overlay may be added in future iterations but are out of scope for this feature.
- Opacity editing (changing the value, not just displaying it) is out of scope — this panel displays the current opacity value but does not provide a slider or input to change it.
- Layer effects, masks, and grouping are out of scope for this feature.
