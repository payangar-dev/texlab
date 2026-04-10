# Quickstart: Fix Undo/Redo System

**Feature**: 035-fix-undo-redo | **Date**: 2026-04-10

## Prerequisites

- Rust >= 1.77 with `cargo` installed
- Node.js >= 20 LTS with `npm`
- Tauri v2 CLI: `cargo install tauri-cli --version "^2"`

## Build & Run

```bash
# From project root
cd apps/texture-lab

# Install frontend dependencies
npm install

# Run in development mode (hot reload)
cargo tauri dev

# Run Rust tests only (no frontend needed)
cd src-tauri && cargo test
```

## Key Files to Modify

| File | Change Scope | Purpose |
|------|-------------|---------|
| `src-tauri/src/domain/undo.rs` | MAJOR | Add `UndoPayload`, `PropertyChange` enums. Update `UndoEntry` to use `UndoPayload` instead of `TextureSnapshot`. |
| `src-tauri/src/use_cases/editor_service.rs` | MAJOR | Targeted snapshot capture per operation type. Mid-stroke finalization in `undo()`. New restore logic per payload variant. Add `pending_draw_layer_id` field. |
| `src-tauri/src/domain/layer_stack.rs` | MINOR | Add `restore_single_layer(LayerSnapshot)` method for single-layer restore. |
| `src-tauri/src/commands/history_commands.rs` | MINOR | Clear `active_tool` after mid-stroke undo finalization. |

## Test Strategy

All tests are in-memory Rust unit tests. No real file I/O.

```bash
# Run all tests
cd src-tauri && cargo test

# Run only undo-related tests
cd src-tauri && cargo test undo

# Run only editor_service tests
cd src-tauri && cargo test editor_service
```

### Test Coverage Required

1. **Targeted snapshots**: Verify that a draw undo entry contains only the affected layer's data, not all layers.
2. **Property undo round-trip**: Change opacity → undo → verify old opacity restored, no pixel data in entry.
3. **Mid-stroke undo**: Press → drag (modify pixels) → undo → verify stroke is cancelled and canvas is clean.
4. **Mid-stroke undo with no modification**: Press → undo (no drag) → verify no empty entry pushed, previous action undone.
5. **Rapid strokes**: Multiple press/release cycles → verify each has its own undo entry.
6. **Mixed operations**: Draw + layer add + property change → undo all three → verify correct state at each step.
7. **History limit**: Push > max_depth entries → verify oldest evicted, newest retained.
8. **Redo after mid-stroke undo**: Mid-stroke undo → redo → verify stroke is restored.

## Architecture Notes

- **Domain purity**: `UndoPayload` and `PropertyChange` are in `domain/undo.rs`. They use only domain types. No serde, no tauri, no external crates.
- **Symmetric swap**: SingleLayer and FullStack variants use the same capture-restore-push pattern. Property uses a simpler read-write-push pattern.
- **Constitution compliance**: "Full-layer snapshots, not diff-based" — SingleLayer stores the complete layer buffer, not pixel diffs. We just don't snapshot unaffected layers.
