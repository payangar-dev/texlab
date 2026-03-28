# Feature Specification: Tool System — Brush, Eraser, Fill, ColorPicker, Line

**Feature Branch**: `003-tool-system`
**Created**: 2026-03-28
**Status**: Draft
**Input**: GitHub Issue #3 — Tool system: Brush, Eraser, Fill, ColorPicker, Line

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Paint pixels with a brush (Priority: P1)

A resource pack creator opens a texture and selects the brush tool. They choose a color from the palette and click or drag on the canvas to paint pixels onto the active layer. The brush size can be adjusted from 1 to 16 pixels, allowing both fine single-pixel work and broader strokes.

**Why this priority**: Painting pixels is the most fundamental editing action. Without it, no texture creation or modification is possible.

**Independent Test**: Can be fully tested by selecting a brush, choosing a color, and painting on a layer — the painted pixels appear at the correct coordinates with the correct color.

**Acceptance Scenarios**:

1. **Given** an open texture with an unlocked active layer, **When** the user presses on the canvas at coordinates (x, y) with a 1px brush and a chosen color, **Then** the pixel at (x, y) is set to that color on the active layer.
2. **Given** an open texture with an unlocked active layer, **When** the user drags across the canvas with a 1px brush, **Then** all pixels along the drag path are painted continuously without gaps.
3. **Given** a brush size set to N (where 1 < N ≤ 16), **When** the user presses on the canvas at (x, y), **Then** a square area of N×N pixels from (x, y) to (x+N-1, y+N-1) is filled with the chosen color (top-left anchoring).
4. **Given** an open texture with a locked active layer, **When** the user attempts to paint, **Then** the operation is rejected and no pixels are modified.
5. **Given** a brush stroke that extends beyond the canvas boundaries, **When** the user paints, **Then** only the pixels within the canvas bounds are affected; out-of-bounds portions are silently clipped.

---

### User Story 2 — Erase pixels (Priority: P1)

A resource pack creator selects the eraser tool to remove pixels from the active layer, making them fully transparent. The eraser behaves like the brush in terms of size and input handling, but sets pixels to fully transparent instead of a color.

**Why this priority**: Erasing is an essential counterpart to painting — users need to correct mistakes and create transparency in textures (e.g., for items, entities, particles).

**Independent Test**: Can be fully tested by painting some pixels, switching to eraser, and erasing them — erased pixels become fully transparent.

**Acceptance Scenarios**:

1. **Given** an active layer with painted pixels, **When** the user presses with the eraser at (x, y), **Then** the pixel at (x, y) is set to fully transparent (alpha = 0).
2. **Given** an eraser size set to N, **When** the user presses at (x, y), **Then** a square area of N×N pixels from (x, y) to (x+N-1, y+N-1) is made fully transparent (top-left anchoring).
3. **Given** a drag gesture with the eraser, **When** the user drags across the canvas, **Then** all pixels along the path are erased continuously without gaps.

---

### User Story 3 — Fill a contiguous area with color (Priority: P2)

A resource pack creator selects the fill (bucket) tool and clicks on a pixel. All contiguous pixels of the same color are replaced with the currently selected color. This is useful for quickly coloring large uniform areas of a texture.

**Why this priority**: Fill is a major productivity tool for pixel art, especially when coloring large areas or replacing one color with another across a connected region.

**Independent Test**: Can be fully tested by creating a solid-colored rectangle, then filling it with a new color — the entire rectangle changes color.

**Acceptance Scenarios**:

1. **Given** an active layer with a contiguous region of color A, **When** the user clicks on a pixel in that region with the fill tool and color B selected, **Then** all connected pixels of color A are replaced with color B.
2. **Given** a pixel surrounded by different-colored neighbors, **When** the user fills that pixel, **Then** only that single pixel changes color.
3. **Given** the user clicks on a pixel that already has the selected color, **When** the fill is applied, **Then** no changes occur (no-op).
4. **Given** a large contiguous area covering the entire canvas, **When** the user fills it, **Then** the operation completes without freezing or crashing.
5. **Given** a contiguous region that reaches the edge of the canvas, **When** the fill is applied, **Then** the fill stops at the canvas boundaries and does not wrap around or overflow.

---

### User Story 4 — Pick a color from the canvas (Priority: P2)

A resource pack creator selects the color picker (eyedropper) tool and clicks on a pixel in the canvas. The color of that pixel becomes the currently active color, ready for use with the brush or other painting tools.

**Why this priority**: Color picking from the canvas is essential for matching and reusing existing colors in the texture — a common workflow in pixel art.

**Independent Test**: Can be fully tested by painting a pixel of a known color, then using the color picker on it — the active color updates to match the sampled pixel.

**Acceptance Scenarios**:

1. **Given** a pixel at (x, y) with color C on the active layer, **When** the user clicks with the color picker at (x, y), **Then** the active color is set to C.
2. **Given** a fully transparent pixel at (x, y), **When** the user picks that pixel, **Then** the active color is set to fully transparent (r=0, g=0, b=0, a=0).

---

### User Story 5 — Draw straight lines (Priority: P2)

A resource pack creator selects the line tool to draw a straight line between two points on the canvas. The user clicks to set the start point and releases at the end point. A pixel-perfect line of 1 pixel width connects the two points, using the active color.

**Why this priority**: Straight lines are a frequently used primitive in pixel art for edges, borders, and geometric shapes.

**Independent Test**: Can be fully tested by clicking at point A and releasing at point B — a straight line of the selected color connects the two points.

**Acceptance Scenarios**:

1. **Given** the line tool is active with color C, **When** the user presses at (x1, y1) and releases at (x2, y2), **Then** a pixel-perfect straight line is drawn from (x1, y1) to (x2, y2) using color C.
2. **Given** a horizontal line from (0, 5) to (10, 5), **When** drawn, **Then** exactly 11 pixels are filled in a straight horizontal row.
3. **Given** a diagonal line, **When** drawn, **Then** the line has no gaps — every pixel along the path is filled.
4. **Given** start and end points are the same (x, y), **When** the user clicks and releases at the same position, **Then** a single pixel is painted at (x, y).
5. **Given** a line that extends partially outside the canvas, **When** drawn, **Then** only the pixels within the canvas bounds are affected.

---

### User Story 6 — Select a rectangular region (Priority: P3)

A resource pack creator selects the rectangular selection tool and drags on the canvas to define a region of interest. The selection is a rectangular area that can later be used by other operations (copy, move, delete, etc.). Selecting a new rectangle replaces the previous selection.

**Why this priority**: Rectangular selection is the foundation for region-based operations (copy, paste, move, delete). It enables a set of workflows, but the operations that consume the selection are implemented in later features.

**Independent Test**: Can be fully tested by dragging a rectangle — the selection region is defined and can be queried for its bounds and which pixels are included.

**Acceptance Scenarios**:

1. **Given** no active selection, **When** the user presses at (x1, y1) and drags to (x2, y2), **Then** a rectangular selection is created covering the area from (min(x1,x2), min(y1,y2)) to (max(x1,x2), max(y1,y2)).
2. **Given** an active selection exists, **When** the user creates a new selection, **Then** the previous selection is replaced.
3. **Given** the user clicks and releases at the same point (no drag), **When** the interaction ends, **Then** any existing selection is cleared (deselected).
4. **Given** a selection that extends beyond the canvas boundaries, **When** created, **Then** the selection is clipped to the canvas dimensions.

---

### Edge Cases

- What happens when a tool is used on a locked layer? — The operation is rejected; no pixels are modified.
- What happens when a tool targets coordinates outside the canvas? — Out-of-bounds areas are silently clipped. Only in-bounds pixels are affected.
- What happens when a brush size of 0 or negative is specified? — The size is rejected. Minimum brush size is 1.
- What happens when a brush size exceeds 16? — The size is rejected. Maximum brush size is 16.
- How does the fill tool handle very large canvases? — The fill algorithm must complete without stack overflow or excessive memory use, even on the maximum supported texture size.
- What happens if the active layer is hidden? — Tools still operate on the layer's pixel data regardless of visibility (visibility only affects compositing display).
- What happens when the user drags the brush very fast? — The system must interpolate between sampled positions to ensure no gaps in the stroke.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a unified tool interaction model with three phases: press (start), drag (continue), and release (end).
- **FR-002**: Each tool MUST have a unique, human-readable name for identification and display.
- **FR-003**: The brush tool MUST paint pixels on the active layer using the currently selected color, with a configurable square size from 1 to 16 pixels.
- **FR-004**: The eraser tool MUST set pixels on the active layer to fully transparent (alpha = 0), with a configurable square size from 1 to 16 pixels.
- **FR-005**: The fill tool MUST replace all contiguous pixels of the same color as the target pixel with the selected color, using 4-directional connectivity (up, down, left, right).
- **FR-006**: The color picker tool MUST return the color of the pixel at the clicked coordinate on the active layer.
- **FR-007**: The line tool MUST draw a pixel-perfect straight line of 1 pixel width between two points (press position and release position) with no gaps, using the active color. The line tool does not use brush size.
- **FR-008**: The selection tool MUST define a rectangular region on the canvas, represented by its bounding coordinates.
- **FR-009**: The brush and eraser tools MUST interpolate between consecutive input positions during drag to prevent gaps in strokes.
- **FR-010**: All tools MUST reject operations on locked layers and report the rejection.
- **FR-011**: All tools MUST silently clip operations to canvas boundaries — out-of-bounds portions are ignored.
- **FR-012**: The fill tool MUST NOT modify pixels when the target pixel already matches the selected color (no-op case).
- **FR-013**: Creating a new selection MUST replace any existing selection.
- **FR-014**: A zero-area selection gesture (click without drag) MUST clear the current selection.

### Key Entities

- **Tool**: An abstraction representing a drawing instrument. Each tool has a name and responds to three interaction phases (press, drag, release). Tools operate on a pixel buffer with a given color and size context.
- **ToolContext**: The set of parameters available to a tool during an interaction: active color, brush size, and reference to the target layer's pixel buffer.
- **Selection**: A rectangular region defined by its top-left and bottom-right coordinates. Represents the user's selected area of interest on the canvas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All six tools (brush, eraser, fill, color picker, line, selection) can be instantiated and used through the same interaction model.
- **SC-002**: A brush stroke drawn by dragging across the canvas produces a continuous trail of pixels with no gaps, regardless of input speed.
- **SC-003**: The fill operation on a 64×64 contiguous single-color area completes and produces the correct result.
- **SC-004**: Every tool correctly rejects operations on a locked layer.
- **SC-005**: Each tool has comprehensive automated tests covering its normal behavior, edge cases, and boundary conditions.
- **SC-006**: The line tool draws pixel-perfect lines where a horizontal line of length N produces exactly N pixels.

## Clarifications

### Session 2026-03-28

- Q: L'outil ligne doit-il supporter un trait épais (taille de brush variable) ou toujours 1px ? → A: Toujours 1px — l'outil ligne ignore la taille de brush.
- Q: Comment centrer le brush pour les tailles paires (2, 4, 6...) ? → A: Ancrage haut-gauche — le pixel cliqué (x, y) est le coin supérieur gauche du carré N×N.

## Assumptions

- Depends on issue #2 — PixelBuffer, Color, Layer, and LayerStack already exist in the domain layer.
- Tools operate on a single layer at a time (the active layer). Multi-layer tool operations are out of scope.
- The fill tool uses 4-directional connectivity (not 8-directional/diagonal). This is the standard behavior in pixel art editors.
- Selection in this feature is definition only — operations that consume the selection (copy, paste, move, delete) are out of scope for this issue.
- Brush shape is square (not circular). This is standard for pixel art editors where round brushes cause anti-aliasing artifacts.
- Tool interaction events (press, drag, release) carry a single coordinate. Multi-touch or pen pressure are out of scope.
- The tool system is pure domain logic with no dependencies on UI frameworks, serialization libraries, or I/O.
