# Feature Specification: Fix Undo/Redo System

**Feature Branch**: `035-fix-undo-redo`  
**Created**: 2026-04-10  
**Status**: Draft  
**Input**: GitHub Issue #35 — Fix undo/redo: stroke grouping, layer operations, and snapshot architecture

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Undo individual paint strokes (Priority: P1)

A user draws a paint stroke on the canvas (mouse down, drag, mouse up), then presses Ctrl+Z. Only the last completed stroke is removed. The canvas returns to its state before that stroke. The user can press Ctrl+Z again to undo the stroke before that, and so on.

**Why this priority**: This is the most fundamental undo behavior. Every pixel editor relies on stroke-level undo granularity. Without it, the editor is unusable for iterative work.

**Independent Test**: Draw three separate strokes with pauses between them. Press Ctrl+Z three times. Each press should remove exactly one stroke in reverse order.

**Acceptance Scenarios**:

1. **Given** a canvas with existing content, **When** the user draws one stroke (press, drag, release) and presses Ctrl+Z, **Then** only that stroke is removed and the canvas returns to its pre-stroke state.
2. **Given** a canvas where the user has drawn five strokes, **When** the user presses Ctrl+Z five times, **Then** each press removes exactly one stroke in reverse chronological order.
3. **Given** a canvas with no undo history, **When** the user presses Ctrl+Z, **Then** nothing happens and the canvas remains unchanged.

---

### User Story 2 - Undo rapid successive strokes independently (Priority: P1)

A user draws multiple short strokes in quick succession (click-release-click-release rapidly). Each stroke is recorded as a separate undo entry. Pressing Ctrl+Z undoes them one at a time, regardless of the speed at which they were created.

**Why this priority**: This is the core bug reported. Users naturally draw quickly, and merging strokes into a single undo block breaks the fundamental editing contract.

**Independent Test**: Rapidly draw 4 strokes in quick succession (< 500ms between each). Press Ctrl+Z four times. Each press should remove exactly one stroke.

**Acceptance Scenarios**:

1. **Given** a canvas, **When** the user draws three strokes rapidly (each within 500ms of the previous), **Then** three separate undo entries are created.
2. **Given** three rapidly-drawn strokes, **When** the user presses Ctrl+Z once, **Then** only the last stroke is removed, not all three.
3. **Given** three rapidly-drawn strokes, **When** the user presses Ctrl+Z three times, **Then** each stroke is removed individually in reverse order.

---

### User Story 3 - Undo during active stroke (Priority: P2)

A user is in the middle of drawing a stroke (mouse is still held down). The user presses Ctrl+Z. The system first completes/finalizes the in-progress stroke as one undo entry, then undoes the previous completed action. The canvas state remains consistent.

**Why this priority**: While less common than post-stroke undo, mid-stroke undo currently corrupts state, which is a data integrity issue.

**Independent Test**: Draw one stroke, then start a second stroke. While holding the mouse button, press Ctrl+Z. The in-progress stroke should be finalized, then the previous action should be undone.

**Acceptance Scenarios**:

1. **Given** a user is mid-stroke (mouse held down), **When** the user presses Ctrl+Z, **Then** the current stroke is finalized as a complete undo entry before any undo operation occurs.
2. **Given** a finalized mid-stroke followed by an undo, **When** the user presses Ctrl+Y (redo), **Then** the previously undone action is restored correctly.
3. **Given** a user is mid-stroke, **When** the user presses Ctrl+Z, **Then** subsequent undo/redo operations remain consistent and no state corruption occurs.

---

### User Story 4 - Undo layer operations individually (Priority: P2)

A user performs layer operations such as adding a layer, renaming it, reordering layers, toggling visibility, changing blend mode, or adjusting opacity. Each operation is recorded as a separate undo entry. Pressing Ctrl+Z undoes the last layer operation without affecting unrelated pixel data.

**Why this priority**: Layer management is a core editing workflow. Users expect layer operations to be undoable individually, just like paint strokes.

**Independent Test**: Add a layer, rename it, then change its blend mode. Press Ctrl+Z three times. Each press should reverse one operation: first the blend mode change, then the rename, then the layer addition.

**Acceptance Scenarios**:

1. **Given** a texture with one layer, **When** the user adds a new layer and presses Ctrl+Z, **Then** only the layer addition is undone and the new layer is removed.
2. **Given** a layer named "Layer 1", **When** the user renames it to "Background" and presses Ctrl+Z, **Then** the name reverts to "Layer 1".
3. **Given** two layers in order A-B, **When** the user reorders them to B-A and presses Ctrl+Z, **Then** the order reverts to A-B.
4. **Given** a visible layer, **When** the user hides it and presses Ctrl+Z, **Then** the layer becomes visible again.
5. **Given** a layer with "Normal" blend mode, **When** the user changes it to "Multiply" and presses Ctrl+Z, **Then** the blend mode reverts to "Normal".
6. **Given** a layer at 100% opacity, **When** the user sets it to 50% and presses Ctrl+Z, **Then** the opacity reverts to 100%.

---

### User Story 5 - Redo after undo (Priority: P2)

After undoing one or more actions, the user can redo them with Ctrl+Y (or Ctrl+Shift+Z). Redo restores the undone actions in order. Performing a new action after undo clears the redo stack.

**Why this priority**: Redo is the complement to undo. It must work correctly with all the undo fixes to provide a complete editing experience.

**Independent Test**: Draw two strokes. Undo both. Redo one. Verify the first stroke reappears. Draw a new stroke. Verify redo is no longer available.

**Acceptance Scenarios**:

1. **Given** two undone strokes, **When** the user presses Ctrl+Y, **Then** the most recently undone stroke is restored.
2. **Given** one undone stroke and a redo available, **When** the user draws a new stroke, **Then** the redo stack is cleared and the new stroke becomes the latest undo entry.
3. **Given** an empty redo stack, **When** the user presses Ctrl+Y, **Then** nothing happens.

---

### User Story 6 - Efficient undo capture (Priority: P3)

Undo entries capture only the data that was actually modified by the action. A paint stroke on a single layer captures only that layer's pixel changes. A layer rename captures only the metadata change. The system does not store a full copy of all layers for every action.

**Why this priority**: While not user-visible in behavior, efficient capture is critical for memory usage and performance, especially when working with multi-layer textures. This enables comfortable editing sessions without memory pressure.

**Independent Test**: Perform 50 paint operations on a 5-layer texture. Memory usage should scale with the size of changes made, not with the total texture size multiplied by the number of operations.

**Acceptance Scenarios**:

1. **Given** a texture with 5 layers, **When** the user paints on one layer, **Then** the undo entry captures only the affected layer's data, not all 5 layers.
2. **Given** a layer property change (rename, visibility, blend mode, opacity), **When** the undo entry is created, **Then** it captures only the changed metadata, not pixel data.
3. **Given** 50 sequential paint operations on a single layer, **When** examining memory usage, **Then** memory consumed by undo history is proportional to pixels changed, not total texture size times 50.

---

### Edge Cases

- What happens when the undo history reaches maximum capacity? Oldest entries should be discarded first (FIFO) to make room for new ones.
- What happens when the user performs a compound operation (e.g., delete a layer with painted content)? It should produce a single undo entry that restores both the layer and its content.
- What happens when the user undoes a layer deletion and then continues editing the restored layer? All subsequent operations should work normally.
- What happens when the user rapidly alternates between undo and redo? Each operation should execute atomically and the stacks should remain consistent.
- What happens when there is only one layer and the user tries to undo its creation? The system should follow the existing minimum-layer policy (preventing removal of the last layer, or restoring to a default empty state).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST create exactly one undo entry per completed paint stroke (mouse press, drag, release), regardless of stroke duration or speed.
- **FR-002**: The system MUST create separate undo entries for consecutively drawn strokes, even when drawn in rapid succession (< 500ms apart).
- **FR-003**: When the user triggers undo during an active stroke (mouse still held down), the system MUST first finalize the in-progress stroke as a complete undo entry, then undo the previous completed action.
- **FR-004**: The system MUST create one undo entry per layer operation: add, remove, reorder, rename, visibility toggle, blend mode change, and opacity change.
- **FR-005**: Undo entries for paint strokes MUST capture only the affected layer's pixel data, not the full texture state.
- **FR-006**: Undo entries for layer property changes (rename, visibility, blend mode, opacity) MUST capture only the changed metadata.
- **FR-007**: Undo entries for layer structural changes (add, remove, reorder) SHOULD capture only the structural change and the affected layer data. Full-stack snapshots are acceptable when they provide a simpler and equally correct implementation (per Constitution Principle VI — Simplicity).
- **FR-008**: Redo MUST restore exactly the action that was undone, in the correct order (LIFO).
- **FR-009**: Performing any new editing action MUST clear the redo stack entirely.
- **FR-010**: The undo/redo stacks MUST remain in a consistent state after any combination of draw, undo, redo, and layer operations.
- **FR-011**: The system MUST enforce a maximum undo history limit, discarding the oldest entries when the limit is reached.

### Key Entities

- **Undo Entry**: A record of a single reversible action, containing the operation type and only the data needed to reverse (and re-apply) it.
- **Undo Stack**: An ordered collection of undo entries, with the most recent action on top (LIFO).
- **Redo Stack**: An ordered collection of undone entries available for restoration (LIFO). Cleared when a new action is performed.
- **Operation Type**: A classification of the action performed (paint stroke, layer add, layer remove, layer reorder, layer property change).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of paint strokes (press, drag, release) produce exactly one independently undoable entry, including strokes drawn in rapid succession (< 500ms apart).
- **SC-002**: Pressing Ctrl+Z mid-stroke results in a consistent canvas state with no data corruption, verified across 20 rapid mid-stroke undo attempts.
- **SC-003**: All 6 layer operation types (add, remove, reorder, rename, visibility, blend mode/opacity) are individually undoable and redoable.
- **SC-004**: Memory consumed by 50 sequential undo entries on a multi-layer texture is proportional to the data changed, not total texture size times 50.
- **SC-005**: Undo/redo sequences of 100+ operations (mixed paint and layer operations) complete without state inconsistency or data loss.

## Assumptions

- The undo history limit is a reasonable default (e.g., 50-100 entries). Exact value can be configured later.
- Textures are Minecraft-sized (typically 16x16 to 64x64 pixels, occasionally up to 512x512). Extreme texture sizes (4096x4096+) are not a target for this fix.
- The existing keyboard shortcut bindings (Ctrl+Z for undo, Ctrl+Y / Ctrl+Shift+Z for redo) remain unchanged. Integration with the command registry from #34 can happen separately.
- A compound operation (e.g., deleting a layer) produces a single undo entry, not multiple entries for sub-operations.
- The minimum layer count policy (whether a texture can have zero layers) follows existing application rules and is not changed by this feature.
- Backend fixes are independent of #34 (Command Registry) as stated in the issue. Both can proceed in parallel.
