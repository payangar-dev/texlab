# Feature Specification: Canvas Viewport

**Feature Branch**: `006-canvas-viewport`
**Created**: 2026-03-29
**Status**: Draft
**GitHub Issue**: #6
**Input**: Canvas viewport: zoom, pan, pixel grid, composite rendering

## Clarifications

### Session 2026-03-29

- Q: Quelle plage de zoom min/max ? → A: 25% - 12800% (ajustable apres tests utilisateur)
- Q: Zoom continu ou par paliers ? → A: Paliers entiers uniquement (1x, 2x, 3x, 4x, 6x, 8x, etc.) pour garantir une grille de pixels uniforme
- Q: Comportement de space+drag pendant un trait d'outil actif ? → A: Space ignore pendant un trait actif, pan disponible seulement au prochain clic

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View a texture on the canvas (Priority: P1)

A resource pack creator opens a texture (e.g. `stone.png`, 16x16) and sees it rendered on the main editing surface, pixel-perfect with no blurring or interpolation. Each pixel of the texture is displayed as a sharp, discrete square. The canvas fills the available viewport space and the texture is centered within it.

**Why this priority**: Without rendering the composite image to screen, no other editing interaction is possible. This is the foundation for all visual work.

**Independent Test**: Open any texture file and confirm the rendered image matches the original pixel data exactly, with no anti-aliasing artifacts.

**Acceptance Scenarios**:

1. **Given** a texture is loaded in the editor, **When** the canvas viewport is displayed, **Then** the composite RGBA data from the backend is rendered pixel-perfectly (nearest-neighbor scaling, no blurring).
2. **Given** a texture is loaded, **When** a tool modifies pixels, **Then** the canvas updates immediately to reflect the new composite data.
3. **Given** no texture is loaded, **When** the canvas viewport is displayed, **Then** a meaningful empty state is shown (no broken/blank canvas).

---

### User Story 2 - Zoom in and out of the texture (Priority: P1)

The creator zooms into the texture to work at individual pixel level, or zooms out to see the full texture. Zoom is centered on the cursor position (for scroll wheel) or on the viewport center (for keyboard shortcuts). The current zoom level is visible in the status bar.

**Why this priority**: Minecraft textures are very small (typically 16x16 or 32x32). Zooming is essential to see and edit individual pixels. Without zoom, the texture is too tiny to work with.

**Independent Test**: Open a 16x16 texture, zoom in with the scroll wheel, confirm pixels grow larger and zoom level updates in the status bar. Use keyboard shortcuts to fit-to-viewport and confirm the texture fills the available space.

**Acceptance Scenarios**:

1. **Given** a texture is displayed, **When** the user scrolls the mouse wheel up, **Then** the viewport zooms in, centering on the cursor position.
2. **Given** a texture is displayed, **When** the user scrolls the mouse wheel down, **Then** the viewport zooms out, centering on the cursor position.
3. **Given** a texture is displayed, **When** the user presses the "zoom to fit" shortcut, **Then** the texture is scaled to fit entirely within the viewport with some padding.
4. **Given** a texture is displayed, **When** the user presses the "zoom to 100%" shortcut, **Then** each texture pixel maps to exactly one screen pixel (1:1).
5. **Given** the user zooms in or out, **When** the zoom level changes, **Then** the status bar displays the current zoom percentage.
6. **Given** the viewport is at minimum zoom, **When** the user tries to zoom out further, **Then** the zoom level does not go below the minimum.
7. **Given** the viewport is at maximum zoom, **When** the user tries to zoom in further, **Then** the zoom level does not go above the maximum.

---

### User Story 3 - Pan across the texture (Priority: P1)

When zoomed in, the creator can pan the viewport to navigate to different parts of the texture. Panning is smooth and responsive, and available via middle-click drag or by holding a modifier key while dragging.

**Why this priority**: Panning is the natural complement to zooming. Once zoomed in, the user must be able to navigate to the area they want to edit.

**Independent Test**: Zoom in on a texture, then middle-click drag to move the viewport. Confirm the texture moves smoothly and continuously with the cursor.

**Acceptance Scenarios**:

1. **Given** the texture is zoomed in beyond the viewport bounds, **When** the user middle-click drags, **Then** the viewport pans in the direction of the drag.
2. **Given** the texture is zoomed in, **When** the user holds the space key and left-click drags, **Then** the viewport pans (space+drag alternative).
3. **Given** the user is panning, **When** they release the mouse button, **Then** the viewport stays at the new position.
4. **Given** the texture fits entirely within the viewport, **When** the user attempts to pan, **Then** the texture remains centered (no panning needed).

---

### User Story 4 - See the pixel grid at high zoom (Priority: P2)

When zoomed in enough that individual pixels are large on screen, a subtle grid appears between pixels, helping the creator distinguish pixel boundaries. The grid is purely visual and does not interfere with editing.

**Why this priority**: The pixel grid is a key usability aid for pixel art editing. It prevents accidental misclicks on adjacent pixels and makes the texture structure explicit. However, the editor is usable without it.

**Independent Test**: Zoom in on a texture until each pixel occupies a large area on screen. Confirm subtle grid lines appear between pixels. Zoom out and confirm the grid disappears at lower zoom levels.

**Acceptance Scenarios**:

1. **Given** the viewport is zoomed in above a visibility threshold, **When** the canvas renders, **Then** subtle grid lines are drawn between each pixel.
2. **Given** the viewport is at low zoom, **When** the canvas renders, **Then** no pixel grid is visible (it would be too dense to be useful).
3. **Given** the pixel grid is visible, **When** the user draws on the canvas, **Then** the grid does not interfere with tool operations or obscure the pixel colors.

---

### User Story 5 - See a cursor preview for the active tool (Priority: P2)

The cursor changes depending on the active tool to give visual feedback. For brush-like tools, the cursor indicates the affected area (e.g. brush size). For the color picker, a distinct cursor is shown. The cursor updates in real-time as the user moves the mouse over the canvas.

**Why this priority**: Cursor previews improve precision and usability but the editor is functional without them. Users can still draw and edit pixels with a default cursor.

**Independent Test**: Select the brush tool with a size of 3, move the cursor over the canvas, and confirm a preview overlay shows which pixels would be affected.

**Acceptance Scenarios**:

1. **Given** a brush-type tool is selected, **When** the user hovers over the canvas, **Then** a cursor overlay shows the pixels that would be affected (matching brush size).
2. **Given** the color picker tool is selected, **When** the user hovers over the canvas, **Then** the cursor changes to indicate picking mode.
3. **Given** the user moves the cursor across pixels, **When** the cursor crosses a pixel boundary, **Then** the cursor preview snaps to the new pixel position.
4. **Given** the cursor is outside the texture bounds (but inside the viewport), **When** hovering, **Then** no cursor preview is shown on the texture.

---

### User Story 6 - Coordinate and zoom feedback in the status bar (Priority: P3)

The status bar displays the current cursor position in texture coordinates (pixel X, Y), the texture dimensions, and the zoom level. This information updates in real-time as the user moves the cursor and zooms.

**Why this priority**: Status bar feedback is a convenience feature. Creators can work without it, but knowing exact coordinates helps with precision work and communicating edits.

**Independent Test**: Move the cursor over the canvas and confirm the status bar shows the correct pixel coordinate. Zoom in and out and confirm the zoom percentage updates.

**Acceptance Scenarios**:

1. **Given** the cursor is over the canvas, **When** the user moves the cursor, **Then** the status bar shows the texture-space pixel coordinates (e.g. "X: 7 Y: 3").
2. **Given** the cursor leaves the canvas area, **When** the cursor is outside the texture, **Then** the coordinate display clears or shows a placeholder.
3. **Given** the zoom level changes, **When** the viewport updates, **Then** the status bar displays the new zoom percentage (e.g. "3200%").
4. **Given** a texture is open, **When** the canvas viewport is displayed, **Then** the status bar shows the texture dimensions (e.g. "16 x 16").

---

### Edge Cases

- What happens when the texture is very large (e.g. 512x512 or 1024x1024)? The viewport should handle large textures without noticeable lag during pan/zoom.
- What happens when the viewport container is resized (e.g. user resizes the window or rearranges dock panels)? The canvas should adapt, re-centering or adjusting the view.
- What happens when the composite data updates rapidly (e.g. continuous brush stroke)? The canvas should render intermediate states without dropping frames or accumulating latency.
- What happens when zoom reaches extreme levels (e.g. 12800% on a 16x16 texture)? The pixel grid and rendering should remain correct and stable.
- What happens if the texture has transparent pixels? They should be visually distinguishable (e.g. checkerboard pattern behind transparent areas).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST render the composite RGBA pixel data from the backend onto the editing surface with nearest-neighbor interpolation (no blurring, no anti-aliasing).
- **FR-002**: The system MUST support zoom via mouse wheel (centered on cursor position), with a zoom range of 25% to 12800% (values adjustable after user testing). Zoom levels above 100% MUST be integer multiples (1x, 2x, 3x, 4x, 5x, 6x, 8x, etc.) to ensure each texture pixel occupies exactly NxN screen pixels. Sub-100% levels (25%, 33%, 50%) use nearest-neighbor downsampling, which may cause pixel dropout — acceptable for overview purposes on small textures.
- **FR-003**: The system MUST support zoom via keyboard shortcuts: zoom in, zoom out, fit-to-viewport, and 1:1 (100%) zoom.
- **FR-004**: The system MUST support panning via middle-click drag.
- **FR-005**: The system MUST support panning via space key + left-click drag as an alternative to middle-click. Space+drag MUST NOT interrupt an active tool operation (e.g. brush stroke in progress); pan mode activates only on the next mouse press after space is held.
- **FR-006**: The system MUST display a pixel grid overlay when the zoom level exceeds a visibility threshold, with subtle lines between individual pixels.
- **FR-007**: The system MUST hide the pixel grid at lower zoom levels where it would be too dense.
- **FR-008**: The system MUST display a tool-dependent cursor preview when hovering over the canvas, showing the area that would be affected by the active tool.
- **FR-009**: The system MUST update the canvas rendering when the composite data changes (after drawing, undo/redo, layer changes, etc.).
- **FR-010**: The system MUST display the cursor's texture-space coordinates in the status bar in real-time.
- **FR-011**: The system MUST display the current zoom percentage in the status bar.
- **FR-012**: The system MUST display the texture dimensions in the status bar.
- **FR-013**: The system MUST center the texture in the viewport when first opened or when using fit-to-viewport zoom.
- **FR-014**: The system MUST visually indicate transparent areas of the texture (e.g. a checkerboard pattern).
- **FR-015**: The system MUST correctly convert mouse screen coordinates to texture pixel coordinates, accounting for zoom and pan offset.
- **FR-016**: The system MUST re-adapt the canvas layout when the viewport container is resized (window resize, dock panel rearrangement).

### Key Entities

- **Viewport State**: The current zoom level, pan offset (x, y), and viewport dimensions. Determines how texture pixels map to screen pixels.
- **Composite Image**: The flattened RGBA pixel data produced by blending all visible layers. This is the data rendered on the canvas.
- **Cursor Position**: The user's mouse position in both screen space and texture space (pixel coordinates). Updated in real-time.
- **Pixel Grid**: A visual overlay that appears at high zoom, drawing lines between texture pixels to help with precision editing.
- **Cursor Preview**: A visual overlay showing the tool's area of effect at the current cursor position, dependent on the active tool type and brush size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can see a pixel-perfect rendering of any texture immediately after opening it, with each texture pixel displayed as a crisp square with no blurring.
- **SC-002**: Users can zoom from fit-to-viewport to maximum zoom in under 1 second of total interaction time, with each zoom step rendering in under 16ms (60fps).
- **SC-003**: Users can pan smoothly across a zoomed-in texture at 60fps with no visible lag or jitter.
- **SC-004**: Users can identify individual pixel boundaries at high zoom thanks to the pixel grid overlay.
- **SC-005**: Users can determine the exact pixel they are hovering over via the status bar coordinate display, with updates matching cursor movement in real-time.
- **SC-006**: The canvas responds to composite data changes (from drawing or undo/redo) within one animation frame, giving the user a seamless editing experience.
- **SC-007**: The cursor preview accurately reflects the tool's area of effect, allowing users to predict which pixels will be modified before clicking.

## Assumptions

- Dependency #5 (Tauri commands for composite data) is completed and available. The backend provides a command returning flat RGBA pixel data with width and height.
- Tool operations return updated composite data, so the canvas can update incrementally after each stroke event.
- Textures in this application are relatively small (typically 16x16 to 64x64, occasionally up to 512x512 or 1024x1024). The rendering strategy is optimized for this size range.
- The status bar is a shared UI element at the bottom of the window. This feature populates it with canvas-related information; other features may add their own status bar items.
- Keyboard shortcuts for zoom follow common conventions (Ctrl+= / Ctrl+- / Ctrl+0 / Ctrl+1 on Windows/Linux) but the exact keybindings may be confirmed during implementation.
- The viewport container is part of a dockable panel system. The canvas must respond to container resize events from this system.
- A checkerboard pattern for transparency is standard across pixel art editors and does not require user configuration.
