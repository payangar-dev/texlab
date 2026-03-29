# Feature Specification: PNG I/O + AppState + Tauri Commands

**Feature Branch**: `005-png-state-commands`
**Created**: 2026-03-29
**Status**: Draft
**Input**: GitHub Issue #5 — "PNG I/O + AppState + Tauri commands (open, save, draw, layers, undo)"

## Clarifications

### Session 2026-03-29

- Q: What happens when the user opens a new texture while one is already open (especially with unsaved changes)? → A: Replace with guard — if the current texture has unsaved changes, refuse and return an "unsaved changes" error; otherwise, replace silently.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open and View a Texture (Priority: P1)

A resource pack creator opens an existing PNG texture file from their project. The application reads the file and displays it on the canvas, ready for editing. The user sees the texture's pixel data rendered correctly.

**Why this priority**: Without being able to open a texture, no other editing feature has value. This is the foundational entry point for all workflows.

**Independent Test**: Can be fully tested by opening a PNG file and verifying the pixel data is displayed correctly on the canvas. Delivers the ability to view any Minecraft texture.

**Acceptance Scenarios**:

1. **Given** a valid PNG file (e.g., 16x16 Minecraft texture), **When** the user opens it, **Then** the texture is loaded and its pixel data is available for display on the canvas.
2. **Given** a PNG file with transparency (alpha channel), **When** the user opens it, **Then** all RGBA channels are preserved accurately.
3. **Given** a non-existent or corrupted file path, **When** the user attempts to open it, **Then** a clear error message is shown and the application remains stable.
4. **Given** a PNG file with non-standard dimensions (e.g., 128x128, non-square), **When** the user opens it, **Then** the texture is loaded correctly regardless of dimensions.
5. **Given** a texture with unsaved changes already open, **When** the user attempts to open another texture, **Then** the operation is refused with an "unsaved changes" error and the current texture remains intact.
6. **Given** a texture with no unsaved changes already open, **When** the user opens another texture, **Then** the current texture is replaced by the new one.

---

### User Story 2 - Draw on a Texture (Priority: P1)

A user selects a drawing tool (brush, eraser, fill, line, color picker) and draws on the active texture layer. Pixel modifications are applied in real time as the user interacts with the canvas (press, drag, release).

**Why this priority**: Drawing is the core value proposition of a texture editor. Without it, the application is just a viewer.

**Independent Test**: Can be tested by opening a texture, selecting a tool and color, and drawing on the canvas. Verifying pixels are modified delivers the core editing capability.

**Acceptance Scenarios**:

1. **Given** an open texture with an active layer, **When** the user draws with the brush tool, **Then** pixels are painted with the selected color at the cursor position.
2. **Given** an open texture, **When** the user drags the brush across the canvas, **Then** a continuous stroke is rendered between the press and current positions (no gaps).
3. **Given** an open texture, **When** the user uses the fill tool on a region, **Then** all connected pixels of the same color are replaced with the selected color.
4. **Given** an open texture, **When** the user uses the color picker on a pixel, **Then** the color of that pixel becomes the active color.
5. **Given** an open texture, **When** the user uses the eraser, **Then** affected pixels are set to fully transparent.
6. **Given** a locked layer, **When** the user attempts to draw on it, **Then** the operation is refused with a clear feedback message.
7. **Given** an open texture, **When** a drawing operation completes, **Then** the composited image (all visible layers blended) is returned for display.

---

### User Story 3 - Save a Texture (Priority: P1)

After editing, the user saves the texture as a PNG file. The user can save to the original file or choose a new location ("Save As"). All layer data is composited into the final output.

**Why this priority**: Saving completes the basic open-edit-save workflow. Without persistence, all edits are lost.

**Independent Test**: Can be tested by opening a texture, making an edit, saving, then reopening the file to verify the changes persisted.

**Acceptance Scenarios**:

1. **Given** a modified texture, **When** the user saves it, **Then** the composited image is written as a valid PNG file to the specified path.
2. **Given** a modified texture, **When** the user uses "Save As" with a new file path, **Then** the file is written to the new location.
3. **Given** a texture with multiple layers, **When** the user saves, **Then** the output is a single flattened PNG with all visible layers composited.
4. **Given** a texture that has been saved, **When** the save completes, **Then** the texture is marked as not modified (clean state).
5. **Given** an invalid save path (e.g., read-only directory), **When** the user attempts to save, **Then** a clear error message is displayed and no data is lost.

---

### User Story 4 - Create a New Texture (Priority: P2)

A user creates a new blank texture by specifying a namespace, path, and dimensions. The new texture starts with a single transparent layer, ready for editing.

**Why this priority**: Enables creating textures from scratch, complementing the open-edit-save flow. Slightly lower priority because most workflows start from existing textures.

**Independent Test**: Can be tested by creating a new texture with specific dimensions and verifying a blank canvas is presented with one transparent layer.

**Acceptance Scenarios**:

1. **Given** valid parameters (namespace, path, width, height), **When** the user creates a new texture, **Then** a blank texture is initialized with one transparent layer.
2. **Given** invalid dimensions (zero or negative), **When** the user attempts to create a texture, **Then** a clear error is returned.
3. **Given** an empty namespace or path, **When** the user attempts to create a texture, **Then** a validation error is returned.

---

### User Story 5 - Manage Layers (Priority: P2)

A user manages the layer stack of their texture: creating new layers, deleting layers, reordering them, and adjusting layer properties (opacity, visibility, blend mode).

**Why this priority**: Layers are essential for non-destructive editing, but the basic single-layer workflow (P1 stories) already delivers value.

**Independent Test**: Can be tested by opening a texture, creating/deleting/reordering layers, and verifying the composited output reflects the changes.

**Acceptance Scenarios**:

1. **Given** an open texture, **When** the user creates a new layer, **Then** a new transparent layer is added to the top of the stack.
2. **Given** a texture with multiple layers, **When** the user deletes a layer, **Then** the layer is removed and the composite updates.
3. **Given** a texture with multiple layers, **When** the user reorders a layer, **Then** the visual stacking order changes accordingly.
4. **Given** a layer, **When** the user changes its opacity, **Then** the composited output reflects the new opacity.
5. **Given** a layer, **When** the user toggles its visibility off, **Then** the layer is excluded from the composite.
6. **Given** a layer, **When** the user changes its blend mode, **Then** the composited output uses the new blending formula.

---

### User Story 6 - Undo and Redo Actions (Priority: P2)

A user undoes a recent action (drawing, layer change) to revert to the previous state, or redoes a previously undone action. This provides a safety net for all editing operations.

**Why this priority**: Critical for usability and confidence in editing, but requires the editing operations (P1) to exist first.

**Independent Test**: Can be tested by performing an edit, undoing it, verifying the state reverts, then redoing it and verifying the state is restored.

**Acceptance Scenarios**:

1. **Given** a texture with editing history, **When** the user triggers undo, **Then** the most recent operation is reverted and the canvas reflects the previous state.
2. **Given** a texture with undone operations, **When** the user triggers redo, **Then** the most recently undone operation is reapplied.
3. **Given** a texture with no history, **When** the user triggers undo, **Then** the operation fails gracefully with a clear message.
4. **Given** a texture after undo, **When** the user performs a new edit, **Then** the redo history is cleared (new edits branch from the current state).

---

### User Story 7 - Query Editor State (Priority: P3)

The application exposes the current editor state (texture metadata, layer information, undo/redo availability, composited pixel data). This enables the frontend to display accurate UI and allows AI agents (via MCP) to inspect the editor.

**Why this priority**: Enables the UI and MCP integration to reflect the true state, but the editing operations themselves are the primary deliverables.

**Independent Test**: Can be tested by performing operations and querying state, verifying the returned data matches expectations.

**Acceptance Scenarios**:

1. **Given** an open texture, **When** the editor state is queried, **Then** the response includes texture metadata (namespace, path, dimensions, dirty flag) and layer information (names, order, properties).
2. **Given** an open texture, **When** the composite data is requested, **Then** the full RGBA pixel buffer of all visible layers blended together is returned.
3. **Given** no open texture, **When** the editor state is queried, **Then** a meaningful empty/null state is returned.

---

### Edge Cases

- What happens when the user tries to open a new texture while the current one has unsaved changes? The operation is refused with an "unsaved changes" error; the user must save or discard first.
- What happens when the user tries to edit a texture that hasn't been opened yet? The operation must be refused with a clear error.
- How does the system handle saving to a path that already exists? The existing file is overwritten (standard save behavior).
- What happens when the user tries to delete the last remaining layer? The operation should be refused to ensure at least one layer always exists.
- What happens when undo history reaches its maximum depth? The oldest entries are evicted silently (FIFO).
- How does the system handle very large textures (e.g., 512x512 or 1024x1024)? The same operations apply; no special behavior required at this stage.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST read PNG files and produce an editable texture from their pixel data.
- **FR-002**: System MUST write composited texture data as valid PNG files.
- **FR-003**: System MUST maintain a shared editor state that is the single source of truth for both the frontend UI and MCP server.
- **FR-004**: System MUST expose texture creation with a namespace, path, and dimensions, initializing a blank layer.
- **FR-005**: System MUST expose tool-based drawing operations (press, drag, release) that modify pixel data on a specific layer and return the composited result.
- **FR-006**: System MUST expose layer management operations: create, delete, reorder, and change properties (opacity, visibility, blend mode).
- **FR-007**: System MUST expose undo and redo operations that restore the texture to a previous or subsequent state.
- **FR-008**: System MUST expose a query for the current editor state (texture metadata, layer information, undo/redo availability).
- **FR-009**: System MUST expose a query for the composited pixel data (all visible layers blended).
- **FR-010**: System MUST return clear, structured error information when an operation fails (invalid path, locked layer, out-of-bounds coordinates, etc.).
- **FR-011**: All mutation operations MUST use owned data types suitable for inter-process communication (no borrowed references across the boundary).
- **FR-012**: Every mutation command MUST mark the texture as modified (dirty) until it is saved.
- **FR-013**: System MUST refuse to open a new texture if the current texture has unsaved changes, returning a clear "unsaved changes" error. If the current texture is clean (no unsaved changes), it is replaced silently by the new one.

### Key Entities

- **Texture**: The document being edited. Identified by a namespace and path (matching Minecraft resource pack conventions). Has dimensions, a layer stack, and a dirty flag.
- **Layer**: A named editing surface within a texture. Has pixel data, opacity, blend mode, visibility, and lock state. Ordered within a stack (bottom to top).
- **Editor State**: The current state of the application, including the active texture, its layers, and undo/redo availability. Shared between frontend and MCP.
- **Composite**: The final flattened image produced by blending all visible layers in order, respecting blend modes and opacities.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can open a PNG texture, make a single brush stroke, and save the result in under 5 seconds total (excluding file dialog interaction).
- **SC-002**: All six tool types (brush, eraser, fill, line, color picker, selection) produce correct visual results when used through the command interface.
- **SC-003**: Undo fully reverts any single operation, and redo restores it, with 100% fidelity (no pixel data loss or corruption).
- **SC-004**: Layer operations (create, delete, reorder, property changes) are immediately reflected in the composited output.
- **SC-005**: The editor state query returns accurate, up-to-date information after every operation, enabling the frontend and MCP to stay synchronized.
- **SC-006**: All error scenarios (invalid file, locked layer, empty history, bad dimensions) produce user-friendly messages without crashing or leaving the application in an inconsistent state.

## Assumptions

- Features #2 (core domain), #3 (use cases), and #4 (tool system) are implemented and available as dependencies.
- Only one texture is open at a time in the initial implementation. Multi-document support is a future concern.
- PNG is the only image format supported for read/write at this stage.
- The composited pixel data is returned as a raw RGBA byte array; the frontend is responsible for rendering it to the canvas.
- Layer pixel data is not sent over IPC individually unless explicitly requested; the composite is the primary output for display.
- The maximum undo history depth uses a reasonable default (e.g., 50 steps); this is not user-configurable at this stage.
- Texture files are opened from and saved to the local filesystem only.
