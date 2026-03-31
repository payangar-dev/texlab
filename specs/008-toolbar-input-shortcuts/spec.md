# Feature Specification: Tool Bar + Tool Input Handling + Keyboard Shortcuts

**Feature Branch**: `008-toolbar-input-shortcuts`
**Created**: 2026-03-30
**Status**: Draft
**Input**: GitHub Issue #8 — Tool selection sidebar and input handling. Mouse events on canvas invoke drawing commands. Keyboard shortcuts for tool switching and actions.

## Clarifications

### Session 2026-03-30

- Q: Le clic droit sur le canvas devrait-il dessiner avec la couleur secondaire (convention pixel art) ? → A: Non, le clic droit n'a aucune action pour l'instant. Le menu contextuel est prévu comme feature future.
- Q: La Pipette doit-elle échantillonner depuis la couche active ou le composite ? → A: Les deux, avec un toggle dans les options de la Pipette (composite par défaut).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select and Use Drawing Tools (Priority: P1)

A texture artist opens a texture in the editor and wants to draw on it. They see a vertical toolbar on the left side of the canvas with recognizable tool icons. They click on the Brush tool, then click and drag on the canvas to paint pixels. They switch to the Eraser to remove mistakes, then use Fill to color a region. Each tool applies its effect immediately on the canvas, and the active tool is clearly highlighted in the toolbar.

**Why this priority**: Without the ability to select and use tools via the toolbar, the editor has no interactivity. This is the foundational interaction that makes the application usable as a texture editor.

**Independent Test**: Can be fully tested by opening a texture, clicking a tool in the toolbar, and drawing on the canvas. Delivers the core editing capability.

**Acceptance Scenarios**:

1. **Given** a texture is open in the editor, **When** the user clicks the Brush tool in the toolbar, **Then** the Brush tool becomes visually highlighted as active and the cursor changes to reflect the selected tool.
2. **Given** the Brush tool is active, **When** the user clicks and drags on the canvas, **Then** pixels are painted along the stroke path in the current primary color on the active layer.
3. **Given** the Eraser tool is active, **When** the user clicks and drags on the canvas, **Then** pixels under the stroke are set to transparent on the active layer.
4. **Given** the Fill tool is active, **When** the user clicks on a pixel in the canvas, **Then** the contiguous region of same-colored pixels is filled with the current primary color.
5. **Given** the Pipette (color picker) tool is active with "composite" sampling mode, **When** the user clicks on a pixel, **Then** the color visible on screen (composite of all visible layers) becomes the current primary color.
6. **Given** the Pipette tool is active with "active layer" sampling mode, **When** the user clicks on a pixel, **Then** the color from the active layer at that position becomes the current primary color (may be transparent if the layer has no content there).
7. **Given** any drawing tool is active, **When** the user completes a stroke or action, **Then** the canvas re-renders immediately to show the result.

---

### User Story 2 - Keyboard Shortcuts for Fast Tool Switching (Priority: P2)

An experienced user wants to work quickly without moving the mouse to the toolbar every time they need a different tool. They press single-key shortcuts (B for Brush, E for Eraser, G for Fill, I for Pipette, L for Line, M for Selection, V for Move, Z for Zoom) to instantly switch tools. They also use `[` and `]` to adjust brush size and `X` to swap primary/secondary colors, all without interrupting their workflow.

**Why this priority**: Keyboard shortcuts are essential for productive pixel art workflows. Professional users expect single-key tool switching — it dramatically reduces editing time and matches conventions from established editors (Photoshop, Aseprite, GIMP).

**Independent Test**: Can be tested by pressing each shortcut key and verifying the active tool changes in the toolbar and the cursor updates accordingly.

**Acceptance Scenarios**:

1. **Given** a texture is open, **When** the user presses `B`, **Then** the Brush tool becomes active and the toolbar reflects the change.
2. **Given** a texture is open, **When** the user presses `E`, **Then** the Eraser tool becomes active.
3. **Given** a texture is open, **When** the user presses `G`, **Then** the Fill tool becomes active.
4. **Given** a texture is open, **When** the user presses `I`, **Then** the Pipette tool becomes active.
5. **Given** a texture is open, **When** the user presses `L`, **Then** the Line tool becomes active.
6. **Given** a texture is open, **When** the user presses `M`, **Then** the Selection tool becomes active.
7. **Given** a texture is open, **When** the user presses `V`, **Then** the Move tool becomes active.
8. **Given** a texture is open, **When** the user presses `Z`, **Then** the Zoom tool becomes active.
9. **Given** the Brush tool is active with size 3, **When** the user presses `]`, **Then** the brush size increases by 1.
10. **Given** the Brush tool is active with size 3, **When** the user presses `[`, **Then** the brush size decreases by 1 (minimum 1).
11. **Given** the primary color is red and the secondary color is blue, **When** the user presses `X`, **Then** the primary and secondary colors are swapped.
12. **Given** a text input field is focused, **When** the user presses a tool shortcut key, **Then** the shortcut is NOT triggered (the key types into the field instead).

---

### User Story 3 - Tool Options Bar (Priority: P3)

The user selects the Brush tool and wants to adjust its size and opacity before drawing. A contextual options bar appears (typically above or below the toolbar area) showing the relevant options for the currently active tool. The user adjusts brush size via a control in the options bar, and the change is reflected immediately in the cursor preview and stroke behavior.

**Why this priority**: Tool options add precision and control to the editing workflow. While basic drawing works with default settings, real texture work requires fine-tuning brush size and opacity for detailed pixel art.

**Independent Test**: Can be tested by selecting the Brush tool, changing size/opacity via the options bar, and verifying the stroke reflects the new settings.

**Acceptance Scenarios**:

1. **Given** the Brush tool is active, **When** the user looks at the options bar, **Then** they see controls for brush size and opacity.
2. **Given** the Eraser tool is active, **When** the user looks at the options bar, **Then** they see controls relevant to the eraser (size).
3. **Given** the Brush tool is active with size 1, **When** the user increases the brush size to 3 via the options bar, **Then** the canvas cursor preview reflects the new size and subsequent strokes paint with a 3-pixel brush.
4. **Given** the Pipette tool is active, **When** the user looks at the options bar, **Then** they see a toggle to switch sampling mode between "composite" (default) and "active layer".
5. **Given** any tool without configurable options is active (e.g., Fill), **When** the user looks at the options bar, **Then** the bar is either empty or shows minimal relevant information (e.g., tolerance for Fill).

---

### User Story 4 - Mouse Input and Continuous Drawing (Priority: P1)

The user draws on the canvas with a tool and expects smooth, responsive strokes. When they press the mouse button and drag, pixels are collected continuously along the cursor path and sent to the backend for processing. The result is a smooth, unbroken line of pixels — not scattered dots from missed positions between mouse events.

**Why this priority**: Smooth mouse input is as fundamental as tool selection itself. Poor input handling (missed pixels, laggy strokes, scattered dots) makes the editor unusable for any real work.

**Independent Test**: Can be tested by drawing a fast diagonal stroke and verifying no pixels are skipped between the start and end points.

**Acceptance Scenarios**:

1. **Given** the Brush tool is active, **When** the user clicks and drags quickly across the canvas, **Then** a continuous line of pixels is drawn with no gaps between points.
2. **Given** the Brush tool is active, **When** the user draws a stroke, **Then** the input points are throttled (approximately 60fps / 16ms) to balance responsiveness and performance.
3. **Given** any drawing tool is active, **When** the user holds Shift and clicks on a point, **Then** a straight line is drawn from the last drawn point to the clicked point.
4. **Given** the user is drawing, **When** they release the mouse button, **Then** the stroke is finalized and an undo snapshot is created.
5. **Given** the user draws outside the texture boundaries, **When** the cursor leaves the canvas area, **Then** the stroke is gracefully terminated at the boundary without errors.

---

### User Story 5 - Line Tool for Straight Lines (Priority: P2)

The user needs to draw precise straight lines for texture edges, borders, or geometric patterns. They select the Line tool, click a start point, and click an end point (or drag) to draw a perfectly straight line between the two points.

**Why this priority**: Straight lines are a common need in pixel art for Minecraft textures (block edges, grid patterns, geometric shapes). This is a distinct tool from Shift+Click (which draws from the last stroke point).

**Independent Test**: Can be tested by selecting the Line tool, clicking two points, and verifying a straight line appears between them.

**Acceptance Scenarios**:

1. **Given** the Line tool is active, **When** the user clicks a start point and then clicks an end point, **Then** a straight line is drawn between the two points in the current primary color.
2. **Given** the Line tool is active, **When** the user clicks and drags, **Then** a live preview of the line is shown from the start point to the current cursor position before the mouse is released.
3. **Given** the Line tool is active, **When** the user draws a line, **Then** the line uses the current brush size for thickness.

---

### Edge Cases

- What happens when the user switches tools mid-stroke (during an active mouse drag)? The current stroke is finalized with the original tool before switching.
- What happens when no texture is open and the user tries to use a tool? Tools in the toolbar should be visually disabled and non-interactive.
- What happens when the user presses a shortcut key while a modal dialog is open? Shortcuts should be ignored when modals or input fields have focus.
- What happens when brush size reaches its minimum (1) or maximum and the user presses `[` or `]`? The value should clamp at the boundary without error.
- What happens when the user Shift+Clicks with no previous point recorded? The click should act as a normal single-point action (no line drawn).
- What happens when the user right-clicks on the canvas? No action is performed. Right-click context menu is reserved for a future feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST display a vertical toolbar sidebar with icons for all available tools: Brush, Eraser, Fill, Pipette, Line, Selection, Move, Zoom.
- **FR-002**: The toolbar MUST visually highlight the currently active tool with a distinct background color.
- **FR-003**: Only one tool may be active at a time. Selecting a new tool deactivates the previous one.
- **FR-004**: The application MUST provide a contextual options bar that displays configurable parameters for the active tool (e.g., brush size and opacity for Brush, brush size for Eraser).
- **FR-005**: Options bar content MUST update immediately when the active tool changes.
- **FR-006**: Left-click mouse interactions on the canvas (click, drag, release) MUST invoke the appropriate drawing command for the active tool. Right-click MUST have no effect (reserved for future context menu).
- **FR-007**: During a mouse drag, input points MUST be collected continuously and throttled at approximately 16ms intervals to ensure smooth strokes without excessive backend calls.
- **FR-008**: The application MUST interpolate between collected points to guarantee continuous strokes with no gaps.
- **FR-009**: Holding Shift and clicking MUST draw a straight line from the last drawn point to the clicked point, regardless of active tool (when applicable to drawing tools).
- **FR-010**: The application MUST support the following keyboard shortcuts for tool selection: B (Brush), E (Eraser), G (Fill), I (Pipette), L (Line), M (Selection), V (Move), Z (Zoom).
- **FR-011**: The application MUST support `[` and `]` keys to decrease/increase brush size by 1, clamping at minimum 1.
- **FR-012**: The application MUST support the `X` key to swap primary and secondary colors.
- **FR-013**: Keyboard shortcuts MUST be suppressed when text input fields, modals, or other focus-capturing UI elements are active.
- **FR-014**: Drawing tools MUST be disabled (visually and functionally) when no texture is open.
- **FR-015**: Completing a drawing action (mouse release) MUST trigger an undo snapshot so the action can be reversed.
- **FR-016**: Mid-stroke tool switching MUST finalize the current stroke before activating the new tool.
- **FR-017**: The Line tool MUST show a live preview of the line while the user is dragging, before the mouse is released.
- **FR-018**: The Pipette tool MUST support two sampling modes: "composite" (default) which samples from all visible layers combined, and "active layer" which samples from the active layer only. The mode MUST be switchable via the tool options bar.

### Key Entities

- **Tool**: Represents an editing tool with a unique identifier, display name, icon, keyboard shortcut, and set of configurable options. One tool is active at any time.
- **Tool Options**: Per-tool configuration values (e.g., brush size, opacity, tolerance, Pipette sampling mode). Each tool defines its own set of supported options with default values and valid ranges.
- **Stroke**: A sequence of canvas coordinates collected during a single mouse drag operation, associated with the active tool and its current options. Finalized on mouse release.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can select any of the 8 tools via toolbar click or keyboard shortcut in under 0.5 seconds.
- **SC-002**: Drawing strokes appear on the canvas with no perceptible delay (under 50ms from input to visual feedback).
- **SC-003**: Fast diagonal strokes produce continuous lines with no visible pixel gaps.
- **SC-004**: 100% of defined keyboard shortcuts correctly activate their associated tool or action.
- **SC-005**: Keyboard shortcuts have zero false activations when typing in input fields or interacting with dialogs.
- **SC-006**: Users can adjust brush size via `[`/`]` keys and see the change reflected immediately in the cursor preview.
- **SC-007**: Shift+Click produces a visually straight line from the last point to the clicked point.
- **SC-008**: All drawing actions (strokes, fills, lines) are individually undoable.

## Assumptions

- Dependencies #5 (Tauri draw commands) and #6 (Canvas viewport) are fully implemented and available — confirmed both are closed/completed.
- The canvas viewport already supports cursor preview overlays (as specified in #6), which this feature will leverage for tool-dependent cursors.
- Brush size maximum is not specified — a reasonable default of 32 pixels will be assumed as the upper bound, suitable for Minecraft textures (typically 16x16 to 64x64).
- The Selection and Move tools are included in the toolbar for this feature, but their full functional behavior (selection manipulation, layer moving) may be scoped to a separate feature. This spec covers their presence in the toolbar and shortcut activation.
- The tool options bar shows in a fixed location within the editor layout (not floating), consistent with the UI design reference.
- Color management (primary/secondary colors, color picker) already exists or is handled by the Color panel — this feature only covers the `X` swap shortcut interaction.
