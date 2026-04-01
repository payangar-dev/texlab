# Feature Specification: Color Panel (HSV Picker + Hex Input)

**Feature Branch**: `009-color-panel`
**Created**: 2026-03-31
**Status**: Draft
**Input**: GitHub Issue #9 — Color panel (HSV picker + hex input)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pick a Color via HSV Gradient (Priority: P1)

A texture artist opens the Color panel and visually selects a color by clicking and dragging on a 2D color gradient area. The gradient displays the full hue spectrum combined with brightness and saturation variation (no separate hue control), allowing direct visual selection of any color from the visible range. A small circular cursor follows the pointer to indicate the selected position. The selected color immediately becomes the active drawing color for the currently active color slot and is reflected in the hex input and preview swatch.

**Why this priority**: Color selection via the gradient is the core interaction of this panel. Without it, the panel has no purpose. This is the minimum viable feature that delivers value.

**Independent Test**: Can be fully tested by opening the panel, clicking on the gradient area, and verifying that the cursor moves and the active color updates accordingly.

**Acceptance Scenarios**:

1. **Given** the Color panel is visible, **When** the user clicks on a position in the HSV gradient area, **Then** the cursor moves to that position and the active color updates to match the HSV value at that position.
2. **Given** the user is clicking on the gradient area, **When** the user drags the pointer, **Then** the cursor follows the pointer in real-time and the active color updates continuously.
3. **Given** a color is selected via the gradient, **When** the user looks at the hex input field and the active color indicator, **Then** both reflect the currently selected color.

---

### User Story 2 - Enter a Color via Hex Input (Priority: P2)

A texture artist types a hexadecimal color code directly into the hex input field (e.g., `#4A9FD8`) to set a precise color. The active color indicator updates live as they type valid values. Once a valid hex code is entered, it becomes the active drawing color and the HSV gradient cursor repositions to match.

**Why this priority**: Hex input is essential for precision work — artists often need exact color codes from references, palettes, or other tools. It complements the gradient picker for a complete color selection workflow.

**Independent Test**: Can be tested by typing a valid hex code in the input field and verifying the preview swatch, active color, and gradient cursor all update.

**Acceptance Scenarios**:

1. **Given** the Color panel is visible, **When** the user types a valid 6-digit hex color code in the hex input field, **Then** the active color indicator updates to show that color and the active drawing color changes.
2. **Given** a valid hex color is entered, **When** the user looks at the HSV gradient, **Then** the cursor has moved to the corresponding position.
3. **Given** the user is typing in the hex field, **When** the input contains an incomplete or invalid hex value, **Then** the active color indicator and active color remain unchanged (last valid value persists).

---

### User Story 3 - Swap Primary and Secondary Colors (Priority: P3)

A texture artist has a primary (foreground) and a secondary (background) color. They can click on either color indicator to make it the active editing target — gradient and hex changes then apply to that slot. They can also swap the two colors instantly using a dedicated swap control or the X keyboard shortcut. The primary color is the one used when drawing; the secondary color serves as an alternate that can be swapped in quickly. This mirrors the workflow in tools like Photoshop and Aseprite.

**Why this priority**: Primary/secondary swapping is a quality-of-life feature that accelerates workflow but is not required for basic color selection. The panel is fully usable without it.

**Independent Test**: Can be tested by setting two different colors as primary and secondary, clicking the swap control, and verifying the colors have exchanged positions.

**Acceptance Scenarios**:

1. **Given** the primary color is red and the secondary color is blue, **When** the user clicks the swap control or presses X, **Then** the primary color becomes blue and the secondary becomes red.
2. **Given** the colors have been swapped, **When** the user looks at the HSV gradient and hex input, **Then** they reflect the new active color.
3. **Given** the panel is visible, **When** the user observes the primary and secondary color indicators, **Then** both colors are clearly visible and the currently active slot is visually distinguished.
4. **Given** the secondary color indicator is not active, **When** the user clicks the secondary color indicator, **Then** the secondary slot becomes the active editing target and the gradient/hex reflect the secondary color.

---

### Edge Cases

- What happens when the user pastes a hex value with a leading `#`? The system should accept both `#AABBCC` and `AABBCC` formats.
- What happens when the user pastes a 3-digit shorthand hex (e.g., `#ABC`)? The system should expand it to `#AABBCC`.
- What happens when the user enters an invalid character in the hex field? Only characters `0-9`, `a-f`, `A-F` should be accepted; other characters are rejected.
- What happens when the user tries to drag outside the gradient area bounds? The cursor should clamp to the gradient boundaries.
- What happens when no texture is open? The Color panel should still function — the active color is a global editor state, not tied to a specific texture.
- What happens when the user edits the secondary color and then swaps? The swap exchanges both slots; the previously secondary color becomes primary and vice versa, regardless of which was being edited.
- What happens when the user presses X while typing in the hex input? The X key shortcut should not trigger while the hex input has focus — it should only type the character "x" in the field.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display a dockable Color panel that follows the existing Panel pattern (grip handle + title header).
- **FR-002**: The Color panel MUST contain a 2D color gradient area displaying the full hue spectrum combined with brightness/saturation variation, enabling direct visual color selection without a separate hue control.
- **FR-003**: The gradient area MUST display a circular cursor indicating the current color position.
- **FR-004**: Users MUST be able to select a color by clicking or click-dragging on the gradient area.
- **FR-005**: The cursor MUST clamp to the gradient boundaries when dragging outside the area.
- **FR-006**: The Color panel MUST display a hex input field showing the current color in hexadecimal format.
- **FR-007**: Users MUST be able to type a hex color code to set the active color precisely.
- **FR-008**: The hex input MUST accept 3-digit and 6-digit hex codes, with or without a leading `#`.
- **FR-009**: The primary and secondary color indicators MUST serve as live previews of their respective colors — no separate preview swatch is needed. The active slot indicator updates immediately when the color changes via gradient or hex input.
- **FR-010**: The system MUST maintain a primary (foreground) and secondary (background) color.
- **FR-011**: Users MUST be able to swap primary and secondary colors via a dedicated swap control or the X keyboard shortcut.
- **FR-012**: Changing the active color (via gradient or hex input) MUST update the currently active color slot (primary or secondary) in the shared application color state.
- **FR-015**: Users MUST be able to click on either the primary or secondary color indicator to make it the active editing target.
- **FR-016**: The X keyboard shortcut MUST be suppressed when the hex input field has focus (to allow typing the character).
- **FR-013**: The Color panel MUST synchronize bidirectionally — changes from the gradient update the hex input, and changes from the hex input update the gradient cursor position.
- **FR-014**: The Color panel MUST be registerable as a dockable panel within the existing panel system.

### Key Entities

- **ActiveColor**: The currently selected drawing color, represented as an HSV value internally and displayed as a hex code. Has a primary and secondary slot. One slot is "active" at a time (the editing target).
- **ColorSlot**: Either the primary (foreground) or secondary (background) position. The active slot receives color changes from the gradient and hex input.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can select any visible color from the HSV gradient in under 2 seconds (single click or short drag).
- **SC-002**: Users can enter a precise hex color and see it applied in under 3 seconds.
- **SC-003**: Swapping primary and secondary colors is a single-action operation (one click).
- **SC-004**: All color changes (gradient, hex input, swap) are reflected across the entire panel within the same interaction frame — no noticeable delay.
- **SC-005**: The panel integrates seamlessly into the dockable panel system — it can be docked, undocked, and rearranged like other panels.

## Assumptions

- The dockable panel system (issue #7) is already implemented and available.
- The existing Panel component pattern (grip + title header) is established and should be reused.
- The 2D gradient area follows the UI design: a combined color field displaying the full hue spectrum with brightness/saturation overlays, allowing visual selection of any color without a separate hue control. This trades independent axis precision for simplicity and visual immediacy, which suits the target audience of resource pack creators.
- Default primary color is black (`#000000`) and default secondary color is white (`#FFFFFF`), matching standard pixel art editor conventions.
- The color state is global to the editor (not per-texture), so the panel functions even with no texture open.
- Alpha channel (transparency) is out of scope for this feature. The color model is opaque RGB only. Alpha support may be added in a future iteration.
- The X keyboard shortcut for swapping colors follows the universal convention from Photoshop, Aseprite, and GIMP.
