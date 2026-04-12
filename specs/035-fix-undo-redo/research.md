# Research: Fix Undo/Redo System

**Feature**: 035-fix-undo-redo | **Date**: 2026-04-10

## R1: Snapshot Architecture — Full-Stack vs Targeted Payloads

### Context

The current system stores a `TextureSnapshot` (all layers, all pixel data) for every undo entry, regardless of operation type. The constitution (Principle VI) states: "Undo/redo uses full-layer snapshots, not diff-based." The spec (FR-005/006/007) requires capturing only affected data.

### Decision: Discriminated `UndoPayload` enum

Replace the uniform `TextureSnapshot` with a three-variant enum:

1. **`SingleLayer(LayerSnapshot)`** — for draw operations. Captures the full pixel data of the ONE affected layer before the stroke. Aligned with the constitution's "full-layer snapshots" principle — we snapshot the entire layer, not pixel diffs. The optimization is avoiding snapshots of unaffected layers.

2. **`Property { layer_id, old_value }`** — for layer property changes (opacity, blend mode, visibility, name, locked). Captures only the changed metadata. No pixel data. Obviously simpler and more efficient than snapshotting pixel data for a name change.

3. **`FullStack(TextureSnapshot)`** — for structural changes (add, remove, reorder). Captures the full layer stack before the operation. This is the same as current behavior.

### Rationale

- **Memory impact**: For a 5-layer 64x64 texture with 100 history entries, full-stack everywhere = ~40MB. With targeted payloads, a typical session (80% draws on 1 layer, 15% property changes, 5% structural) = ~6MB. A 6x reduction.
- **Constitution compliance**: "Full-layer snapshots, not diff-based" is preserved — draw entries store the complete layer buffer, not pixel-level patches. We simply don't snapshot layers that weren't touched.
- **Simplicity**: The symmetric swap pattern (`apply_history_swap`) still works for SingleLayer and FullStack. Property changes use a simpler capture/restore pair. Only 3 code paths instead of per-operation-type logic.

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| **Pixel diff/patch per stroke** | Violates constitution Principle VI. Complex to implement correctly (bounding box tracking, delta encoding). Over-engineering for Minecraft texture sizes. |
| **Command pattern (inverse operations)** | Asymmetric undo/redo logic per operation type. Structural changes become complex (re-inserting layers with exact pixel data requires storing the layer anyway). More code, more bugs. |
| **Keep full TextureSnapshot everywhere** | Violates FR-005/006. Wastes memory for property changes. Doesn't scale if users work with larger textures or more layers. |
| **Targeted per structural op type** (LayerAdded stores only new ID, LayerRemoved stores removed layer + index) | Breaks the symmetric swap pattern. Requires different restore logic for undo vs redo per structural variant. Higher complexity with marginal memory savings (structural ops are infrequent). |

---

## R2: Mid-Stroke Undo Finalization

### Context

If the user presses Ctrl+Z while a stroke is in progress (mouse held down), the current system calls `EditorService::undo()` directly. The `pending_snapshot` field is populated but the stroke hasn't been finalized. This means:
- Undo operates on the previous entry, but the in-progress pixels remain on the canvas
- The pending snapshot is orphaned (never pushed to the undo stack)
- The canvas state diverges from history state = corruption

### Decision: Finalize-then-undo in `EditorService::undo()`

When `undo()` is called and `pending_snapshot` is `Some`:
1. **Finalize**: If `pixels_modified_in_cycle` is true, push the pending snapshot as a `Draw` undo entry. Clear `pending_snapshot` and `pixels_modified_in_cycle`.
2. **Proceed with undo**: The just-finalized stroke is now the top of the undo stack. Normal undo pops it, restoring to before the stroke.

Net effect: mid-stroke Ctrl+Z cleanly cancels the in-progress stroke. The stroke is recorded as an undo entry so Ctrl+Y can redo it.

If no pixels were modified during the stroke, the pending snapshot is simply discarded and normal undo proceeds.

### Rationale

- **Backend-authoritative**: The finalization logic lives in `EditorService`, not the frontend. This ensures consistency regardless of how undo is triggered (keyboard, command palette, MCP).
- **No frontend coordination needed**: The frontend undo command (`edit.undo`) doesn't need to know about stroke state. It calls `invoke("undo")` and the backend handles everything.
- **Atomic**: Lock is already held during the undo command, so finalization + undo happen in one atomic operation.

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| **Frontend checks stroke state before undo** | Violates Principle III (dual-access). MCP would need separate logic. State split between frontend and backend. |
| **Disable undo during active stroke** | Poor UX. Users commonly press Ctrl+Z mid-stroke to cancel. Every major editor supports this. |
| **Cancel stroke without undo entry** | Spec requires stroke finalization as an undo entry (US3-AS1). User should be able to redo the cancelled stroke. |

---

## R3: Stroke Boundary Correctness Under Rapid Input

### Context

The spec (FR-002) requires separate undo entries for strokes drawn in rapid succession (< 500ms apart). The issue title mentions "stroke grouping" as a bug.

### Decision: Current architecture is already correct — no change needed

Analysis of the current code:
- `apply_tool_press()` captures a new `pending_snapshot` at the START of every stroke
- `apply_tool_release()` pushes the snapshot at the END of every stroke (if pixels modified)
- Each press-drag-release cycle is independent — no timer, no debounce, no grouping

The stroke boundary is defined by the press/release pointer events, not by timing. The frontend dispatches these 1:1 with pointer events via `onPointerDown` / `onPointerUp`. There is no batching or merging of press/release events.

**Verification**: The existing test `multiple_operations_sequential_undo_in_reverse_order` confirms two back-to-back strokes produce two independent undo entries.

### Rationale

No code change is needed. The "stroke grouping" mentioned in the issue title likely referred to the overall architecture review, not a specific timing bug. The current 1:1 stroke-to-entry mapping is correct by design.

### Risk Assessment

The only theoretical risk is if the frontend's `processDrag()` serialization (using `dragInFlightRef`) somehow loses a `tool_release` event. Inspection shows that `onPointerUp` always calls `toolRelease()` regardless of pending drag state, so this path is safe.

---

## R4: Undo/Redo Restore Logic Per Payload Type

### Context

The current `apply_history_swap` is generic — it captures the full texture state, restores from the popped entry, and pushes the captured state. With targeted payloads, we need type-specific restore logic.

### Decision: Match-based restore with symmetric capture

```
fn undo/redo:
  match popped_entry.payload:
    SingleLayer(old_snapshot):
      current_snapshot = LayerSnapshot::from_layer(find_layer(old_snapshot.id))
      layer.restore_from_snapshot(old_snapshot)
      push(SingleLayer(current_snapshot))
      
    FullStack(old_texture):
      current_texture = TextureSnapshot::capture(layer_stack)
      layer_stack.restore_from_snapshots(old_texture)
      push(FullStack(current_texture))
      
    Property { layer_id, old_value }:
      current_value = read_property(layer_id, old_value.kind())
      set_property(layer_id, old_value)
      push(Property { layer_id, current_value })
```

### Rationale

- **Symmetric**: Each variant captures the current state in the same format before restoring. Undo and redo use the exact same code path (just swapping which stack to pop from and push to).
- **Type-safe**: The match ensures every payload variant has explicit restore logic. No accidental fallthrough.
- **Efficient**: SingleLayer only reads/writes one layer. Property only reads/writes one field. FullStack works as before.

---

## R5: `PropertyChange` Enum Design

### Context

FR-006 requires property change undo entries to capture "only the changed metadata." We need a type to represent the old value of any layer property.

### Decision: Flat enum with one variant per property

```rust
enum PropertyChange {
    Opacity(f32),
    BlendMode(BlendMode),
    Visibility(bool),
    Name(String),
    Locked(bool),
}
```

### Rationale

- **Exhaustive**: Every settable layer property has a variant.
- **Simple**: No nested structs, no generics. Each variant carries exactly the old value.
- **Extensible**: Adding a new layer property means adding one variant and one match arm.
- **Domain-pure**: Uses only domain types (`BlendMode`, `f32`, `bool`, `String`).

---

## R6: History Command Mid-Stroke Coordination

### Context

The Tauri `undo` command in `history_commands.rs` currently calls `state.editor_mut()?.undo()`. But mid-stroke, the tool instance is stored in `AppState.active_tool`. After mid-stroke finalization, the tool should be cleared to prevent the frontend from sending further drag/release events for a stroke that no longer exists.

### Decision: Clear `active_tool` during mid-stroke undo in the command layer

In `history_commands.rs`, after the editor finalizes and undoes:
1. Check if `pending_snapshot` was present (indicates mid-stroke)
2. If yes, set `state.active_tool = None` (drop the tool instance)
3. This signals the frontend that the stroke is over

The frontend already handles missing `active_tool` gracefully — `tool_drag` and `tool_release` return an error if no active tool exists. The frontend can catch this and reset its pointer state.

### Rationale

- Backend stays authoritative — the tool lifecycle is managed in Rust, not JS
- Frontend error handling is already in place (error catch in `useViewportControls`)
- No new IPC event needed — the existing `state-changed` emission after undo is sufficient for the frontend to re-sync

### Alternative: Emit a dedicated `stroke-cancelled` event

Rejected because it adds a new event type for a rare edge case. The existing error path + state-changed event is sufficient.
