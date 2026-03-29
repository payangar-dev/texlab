# Research: Undo/Redo System (Snapshot-Based)

**Feature**: 004-undo-redo-system
**Date**: 2026-03-29

## Decision 1: Snapshot Strategy

**Decision**: Full-layer snapshots (clone entire PixelBuffer + layer properties before each operation).

**Rationale**:
- Minecraft textures are small (16x16 = 1KB RGBA, 64x64 = 16KB). At 100 history entries of a single layer, worst case is ~1.6MB — trivial.
- Constitution Principle VI explicitly mandates this approach: "Undo/redo uses full-layer snapshots, not diff-based."
- Simpler to implement than diff-based: no delta computation, no patch application, no corruption risk from incomplete diffs.
- `PixelBuffer` already provides `clone_data() -> Vec<u8>` for cheap data cloning.

**Alternatives considered**:
- **Diff/delta-based**: Stores only changed pixels. Lower memory but complex patch logic, risk of corruption on out-of-order application. Rejected per constitution.
- **Command pattern with inverse ops**: Each operation has an undo counterpart. Fragile — every new operation needs a matching inverse. Spec explicitly chose snapshot-based.

## Decision 2: Undo/Redo Data Structure

**Decision**: Two `Vec`-based stacks (undo stack + redo stack) inside an `UndoManager` struct, with a configurable max depth (default 100).

**Rationale**:
- Classic undo/redo pattern: push to undo on new operation, pop from undo on undo (push to redo), pop from redo on redo (push to undo).
- `Vec` is efficient for stack operations (push/pop at end). Oldest entry removal (when at capacity) uses `remove(0)` which is O(n) but n ≤ 100, so negligible.
- Alternative: `VecDeque` for O(1) front removal. Viable optimization but unnecessary at n=100. Using `VecDeque` anyway for correctness.

**Alternatives considered**:
- **Single vector with cursor**: One list + index pointer. Simpler state but trickier fork behavior (must truncate on new operation after undo). Slightly less readable.
- **Linked list**: No benefit over Vec for small n, worse cache locality.

## Decision 3: What to Snapshot

**Decision**: Snapshot the full state of all affected layers (pixel data + properties) plus the layer stack structure (order, which layers exist).

**Rationale**:
- Drawing operations affect a single layer's pixel data → snapshot that layer's buffer.
- Layer operations (add, remove, reorder, property change) affect the layer stack structure → snapshot the full layer stack state.
- Using a unified `TextureSnapshot` that captures the complete LayerStack state simplifies the design: one snapshot type handles all operation types.
- Cost at 16x16 with 5 layers: 5 × 1KB = 5KB per snapshot. 100 snapshots = 500KB. Trivial.

**Alternatives considered**:
- **Per-layer snapshots for drawing, full stack for structural ops**: Two snapshot types, more complex but slightly more memory-efficient. Over-engineering for textures this small.
- **Snapshot only the modified layer**: Saves memory but requires tracking which layer changed and reconstructing partial state on restore. Complex for multi-layer operations.

## Decision 4: Architecture Placement

**Decision**:
- `UndoEntry` and `UndoManager` are **domain** types (in `domain/`).
- `EditorService` is a **use case** (in `use_cases/`) that orchestrates operations and manages undo recording.

**Rationale**:
- Undo/redo logic is pure business logic with no I/O dependencies → belongs in domain.
- `EditorService` coordinates domain operations (tools + undo manager + texture) → belongs in use_cases.
- Clean Architecture: domain knows nothing about who calls it. Use cases orchestrate.

**Alternatives considered**:
- **Everything in domain**: Would work but EditorService coordinates multiple domain entities, which is orchestration (use case responsibility).
- **Undo manager in use_cases**: Possible, but the undo/redo data structures and algorithms are pure logic with no I/O, fitting domain better.

## Decision 5: Snapshot Granularity for Tool Operations

**Decision**: Snapshot is taken before `on_press` and the entry is committed after `on_release`. The entire press-drag-release cycle is one undoable operation.

**Rationale**:
- Spec assumption: "Each tool interaction (press-drag-release cycle) counts as a single undoable operation."
- User expectation: one undo reverses one complete stroke, not individual pixels.
- `on_press` is the first mutation point → snapshot before it captures the pre-operation state.
- `on_release` marks operation completion → entry is finalized.

**Alternatives considered**:
- **Snapshot per drag event**: Too granular, floods history, not what users expect.
- **Snapshot on release only**: Would need to diff or replay, complex. Pre-snapshot is simpler.

## Decision 6: Layer Property Changes as Individual Entries

**Decision**: Each layer property change (opacity, blend mode, visibility, name, locked state) is a separate undo entry.

**Rationale**:
- Spec FR-006 lists layer property changes as undoable.
- Edge case in spec: "What happens when the same layer property is changed multiple times in succession? Each change is a separate undo step."
- No coalescing of property changes — simple and predictable behavior.

**Alternatives considered**:
- **Coalescing rapid property changes**: E.g., dragging an opacity slider creates one entry instead of many. Spec explicitly rejects this. Could be added as a future enhancement.

## Decision 7: Undo Bypasses Layer Lock

**Decision**: Undo/redo operations restore state directly, bypassing the `Layer::locked` guard.

**Rationale**:
- Spec FR-010: "Undo and redo operations MUST bypass layer lock restrictions, since they restore prior states rather than performing new edits."
- Edge case in spec confirms this: "The undo should still work — undo bypasses the lock because it restores a prior state rather than performing a new edit."
- Implementation: UndoManager restores by replacing layer state wholesale, not by calling guarded mutation methods.

**Alternatives considered**:
- **Temporarily unlock during undo**: Adds complexity and race conditions. Direct state replacement is cleaner.
