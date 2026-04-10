# IPC Contracts: Undo/Redo System

**Feature**: 035-fix-undo-redo | **Date**: 2026-04-10

## Overview

The undo/redo system communicates between frontend and backend via Tauri IPC commands. This feature does NOT change any IPC signatures — the existing `undo`, `redo`, `tool_press`, `tool_drag`, and `tool_release` commands retain their exact input/output types. The changes are entirely within the backend behavior.

## Existing Commands (no signature change)

### `undo` → `Result<EditorStateDto, AppError>`

**Current behavior**: Pops from undo stack, restores snapshot, pushes to redo stack.

**New behavior**: If a stroke is in progress (`pending_snapshot` is populated):
1. Finalizes the in-progress stroke (pushes as undo entry if pixels were modified)
2. Clears active tool instance
3. Then proceeds with normal undo (pops the just-finalized stroke entry)

The DTO return type and structure are unchanged. The `canUndo` and `canRedo` fields in `EditorStateDto` reflect the post-operation state.

**Error cases** (unchanged):
- `AppError::NoEditorOpen` — no texture is open
- `AppError::Domain(DomainError::EmptyHistory)` — nothing to undo (after potential finalization)

---

### `redo` → `Result<EditorStateDto, AppError>`

**No behavioral change**. Redo is not affected by mid-stroke finalization (you can't redo during a stroke — there's nothing to redo). If somehow called mid-stroke, it operates normally on the redo stack.

---

### `tool_press` → `Result<ToolResultDto, AppError>`

**No change**. Continues to start a new stroke cycle and capture a pending snapshot.

---

### `tool_drag` → `Result<ToolResultDto, AppError>`

**No change**. Continues to apply drag phase to the active tool.

**New edge case**: If `undo` was called mid-stroke (clearing the active tool), a subsequent `tool_drag` call returns `AppError::Internal("no active tool")`. The frontend already handles this error in `useViewportControls.ts` via the error catch in `processDrag()`.

---

### `tool_release` → `Result<ToolResultDto, AppError>`

**No change**. Continues to finalize the stroke and push the undo entry.

**New edge case**: Same as `tool_drag` — if `undo` cleared the active tool, `tool_release` returns an error. The frontend handles this gracefully.

## Events (no change)

### `state-changed` (Tauri event)

Emitted after every state mutation (undo, redo, tool press with pixel modification, tool release, layer operations). No payload — frontend re-fetches state via `getEditorState()`.

No new events are added for mid-stroke cancellation. The existing `state-changed` event after `undo` is sufficient for the frontend to re-sync.

## DTO Structure (no change)

### `EditorStateDto`

```typescript
interface EditorStateDto {
  isOpen: boolean;
  namespace: string | null;
  path: string | null;
  width: number | null;
  height: number | null;
  isDirty: boolean;
  canUndo: boolean;    // reflects post-operation state
  canRedo: boolean;    // reflects post-operation state
  layers: LayerInfoDto[];
  activeLayerId: string | null;
}
```

### `ToolResultDto`

```typescript
interface ToolResultDto {
  resultType: "pixels_modified" | "color_picked" | "selection_changed" | "no_op";
  composite: number[] | null;  // RGBA flat array if pixels modified
  pickedColor: ColorDto | null;
  selection: SelectionDto | null;
}
```

## Frontend Impact

No frontend code changes are required for this feature. The existing error handling in `useViewportControls.ts` already handles the case where `tool_drag` / `tool_release` fail (e.g., when no active tool exists after mid-stroke undo). The pointer state (`isDrawingRef`) will be reset on the next `onPointerUp` event.
