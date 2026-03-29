# Feature Specification: Undo/Redo System (Snapshot-Based)

**Feature Branch**: `004-undo-redo-system`
**Created**: 2026-03-29
**Status**: Draft
**Input**: GitHub Issue #4 — Undo/Redo system (snapshot-based)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Undo a Drawing Mistake (Priority: P1)

A texture artist is painting on a 16x16 block texture. They accidentally draw a stroke in the wrong place. They trigger "undo" and the texture instantly reverts to its state before that stroke, as if the mistake never happened. They can continue painting from the restored state.

**Why this priority**: Undo is the single most critical editing safety net. Without it, any mistake requires manual correction or starting over, making the editor frustrating and unreliable for real work.

**Independent Test**: Can be fully tested by performing any drawing operation, triggering undo, and verifying the texture returns to its exact prior state.

**Acceptance Scenarios**:

1. **Given** a texture with existing content and the user has just drawn pixels, **When** the user triggers undo, **Then** the texture reverts to its exact state before the drawing operation.
2. **Given** a texture where multiple drawing operations have been performed, **When** the user triggers undo multiple times, **Then** each undo reverts one operation in reverse chronological order.
3. **Given** a texture where no operations have been performed (empty history), **When** the user triggers undo, **Then** nothing happens and the texture remains unchanged.

---

### User Story 2 - Redo a Reverted Action (Priority: P2)

After undoing a stroke, the artist realizes the stroke was actually correct. They trigger "redo" and the stroke reappears exactly as it was. This lets them safely explore "what if I undo this?" without permanently losing work.

**Why this priority**: Redo complements undo and gives users confidence to experiment freely. Without redo, undo becomes risky — users hesitate to undo because they might lose something they wanted.

**Independent Test**: Can be fully tested by performing an operation, undoing it, then redoing it, and verifying the texture matches the post-operation state exactly.

**Acceptance Scenarios**:

1. **Given** the user has just undone an operation, **When** the user triggers redo, **Then** the operation is re-applied and the texture matches its state before the undo.
2. **Given** the user has undone multiple operations, **When** the user triggers redo multiple times, **Then** each redo re-applies one operation in chronological order.
3. **Given** the user has undone an operation and then performs a new operation, **When** the user triggers redo, **Then** nothing happens because the redo history was discarded when the new operation was performed.
4. **Given** no operations have been undone, **When** the user triggers redo, **Then** nothing happens and the texture remains unchanged.

---

### User Story 3 - Undo Layer Management Actions (Priority: P3)

The artist adds a new layer, rearranges layers, or changes a layer's properties (opacity, blend mode, visibility, name). They realize the change was wrong. They trigger undo and the layer stack returns to its previous state — the added layer disappears, the reorder reverts, or the property returns to its old value.

**Why this priority**: Layer operations are structural changes that significantly affect the composition. Being able to undo them is essential for a non-destructive workflow, but drawing undo (P1) delivers more immediate value since drawing is the most frequent activity.

**Independent Test**: Can be fully tested by performing a layer operation (add, remove, reorder, or property change), triggering undo, and verifying the layer stack matches its prior state.

**Acceptance Scenarios**:

1. **Given** the user has added a new layer, **When** the user triggers undo, **Then** the layer is removed and the layer stack matches its state before the addition.
2. **Given** the user has removed a layer, **When** the user triggers undo, **Then** the layer is restored with all its content and properties, in its original position.
3. **Given** the user has reordered layers, **When** the user triggers undo, **Then** the layers return to their previous order.
4. **Given** the user has changed a layer property (opacity, blend mode, visibility, name, locked state), **When** the user triggers undo, **Then** the property reverts to its previous value.

---

### User Story 4 - History Limit Protection (Priority: P4)

The artist has been working for an extended session, performing hundreds of operations. The system silently discards the oldest history entries beyond the configured limit, keeping memory usage bounded. The artist is not interrupted or notified — they simply cannot undo past the limit.

**Why this priority**: Prevents unbounded memory growth during long editing sessions. Lower priority because the default limit (100 steps) is generous and the per-snapshot memory cost is trivial for typical Minecraft textures.

**Independent Test**: Can be tested by performing more operations than the history limit and verifying that the oldest entries are no longer reachable via undo.

**Acceptance Scenarios**:

1. **Given** the history is at its maximum capacity (100 entries), **When** the user performs a new operation, **Then** the oldest history entry is discarded and the new operation is recorded.
2. **Given** the history has been truncated, **When** the user triggers undo repeatedly, **Then** they can only undo back to the oldest remaining entry, not beyond.

---

### Edge Cases

- What happens when the user undoes all operations back to the initial state? The texture should match the state when it was first opened/created.
- What happens when the user performs undo, then a new operation, then tries redo? The redo history is gone — the new operation forked the history.
- What happens when the same layer property is changed multiple times in succession? Each change is a separate undo step.
- What happens when a layer is locked and the user tries to undo a drawing operation on it? The undo should still work — undo bypasses the lock because it restores a prior state rather than performing a new edit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST record each user-initiated editing operation as an undoable entry in a per-texture history.
- **FR-002**: System MUST support undoing operations in reverse chronological order (last-in, first-out).
- **FR-003**: System MUST support redoing previously undone operations in chronological order.
- **FR-004**: System MUST discard all redo entries when a new operation is performed after an undo (fork behavior).
- **FR-005**: System MUST enforce a maximum history depth of 100 entries per texture, discarding the oldest entry when the limit is exceeded.
- **FR-006**: System MUST track the following operation types as undoable: drawing operations (brush, eraser, fill, line), layer addition, layer removal, layer reordering, and layer property changes (opacity, blend mode, visibility, name, locked state).
- **FR-007**: System MUST report whether undo and redo are currently available (for UI state such as disabling buttons).
- **FR-008**: System MUST restore the complete state of affected layers when undoing or redoing, including pixel data and all layer properties.
- **FR-009**: System MUST use full-layer snapshots as the storage mechanism for undo history, capturing the complete state before each operation.
- **FR-010**: Undo and redo operations MUST bypass layer lock restrictions, since they restore prior states rather than performing new edits.

### Key Entities

- **Undo Entry**: Represents a single undoable operation. Contains the operation type and the snapshot(s) needed to restore the previous state. Each entry captures enough information to reverse one user action.
- **Undo/Redo Manager**: Maintains the ordered history of undo entries for a given texture. Tracks the current position in the history and enforces the maximum depth. Provides undo, redo, and state query capabilities.
- **Editor Service**: Orchestrates user actions by coordinating between tools, layers, and the undo/redo manager. Ensures every undoable action is recorded before being applied.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can undo any supported operation and the texture visually returns to its exact prior state with no pixel-level differences.
- **SC-002**: Users can redo any undone operation and the texture visually matches the state before the undo, with no pixel-level differences.
- **SC-003**: Performing a new action after undo permanently removes all redo history for that texture.
- **SC-004**: The system supports at least 100 consecutive undo steps per texture without degradation.
- **SC-005**: All six supported operation types (draw, layer add, layer remove, layer reorder, layer property change) are individually undoable and redoable.
- **SC-006**: The system correctly reports undo/redo availability at all times (empty history, mid-history, after fork).

## Assumptions

- Textures are small (primarily 16x16, up to 64x64 for some assets), making full-layer snapshots a practical and simple approach with trivial memory cost (~1KB per snapshot at 16x16).
- The maximum history depth of 100 steps is sufficient for typical editing sessions. This value may be made configurable in a future iteration but is hardcoded for now.
- This feature covers the backend undo/redo logic only (domain + use cases). Frontend integration (keyboard shortcuts, toolbar buttons) is out of scope and will be addressed when the UI is implemented.
- Each tool interaction (press-drag-release cycle) counts as a single undoable operation, not each individual pixel change within a stroke.
- The color picker tool does not generate undo entries since it does not modify the texture.
- The selection tool's selection changes are not tracked in undo history — only operations that modify pixel data or layer structure are undoable.
- Depends on #2 (Layer, LayerStack) and #3 (Tools) being implemented, which are already complete.
- Undo history is per-texture and is not persisted to disk — closing a texture discards its history.
