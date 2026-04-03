# Data Model: Command & Keybinding Registries

**Feature**: 034-command-keybinding-registries
**Date**: 2026-04-03

## Entities

### Command

An action that can be triggered by a keybinding, programmatically, or (future) via a command palette.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | yes | Unique identifier, namespaced by category (e.g., `"tools.brush"`, `"edit.undo"`, `"view.zoomIn"`) |
| `label` | `string` | yes | Human-readable display label (e.g., `"Brush"`, `"Undo"`, `"Zoom In"`) |
| `category` | `CommandCategory` | yes | One of: `"tools"`, `"edit"`, `"view"`, `"layers"`, `"layout"` |
| `description` | `string` | no | Optional longer description for tooltips / command palette |
| `execute` | `() => void` | yes | Function to run when the command is triggered |
| `precondition` | `() => boolean` | no | If defined, command only executes when this returns `true` |

**Validation rules**:
- `id` must be unique across the entire registry
- `id` format: `category.name` (lowercase, dot-separated)
- `label` must be non-empty
- `category` must be a valid `CommandCategory` value

### Keybinding

A mapping from a key combination to a command, with optional context and trigger type.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `key` | `string` | yes | — | Canonical key combination (e.g., `"Mod+z"`, `"b"`, `"Delete"`, `"Space"`) |
| `commandId` | `string` | yes | — | ID of the command to execute |
| `when` | `string` | no | `"!inputFocused && !dialogOpen"` | Context clause for conditional activation |
| `trigger` | `"keydown" \| "keyup"` | no | `"keydown"` | Which keyboard event fires this binding |

**Validation rules**:
- `commandId` must reference a registered command
- `key` must follow canonical format: `[Mod+][Alt+][Shift+]<key>` with key lowercase for letters, PascalCase for special keys
- Duplicate `key` + `when` combination = conflict (warning at registration time)

### CommandCategory

Enumeration of command categories.

```typescript
type CommandCategory = "tools" | "edit" | "view" | "layers" | "layout";
```

### ContextMap

Runtime context state used to evaluate `when` clauses.

| Key | Type | Description |
|-----|------|-------------|
| `inputFocused` | `boolean` | An INPUT, TEXTAREA, or contentEditable element is focused |
| `dialogOpen` | `boolean` | A modal dialog (with `open` attribute) is currently visible |

**Maintained by**: Global `focusin`/`focusout` listeners + DOM query for dialogs.
**Storage**: Plain `Map<string, boolean>` singleton (not a React store).

## Relationships

```
Command 1 ←──── * Keybinding
   │                  │
   │ id ◄─────── commandId
   │
   │ precondition ──► evaluated before execute()
   │
   Keybinding
   │
   │ when ──► evaluated against ContextMap
   │ trigger ──► determines keydown vs keyup listener
```

- One command can have zero or multiple keybindings (e.g., `edit.redo` is bound to both `Mod+Shift+z` and `Mod+y`)
- A keybinding maps to exactly one command
- Context evaluation happens before command precondition check

## Command Inventory

### Category: Tools

| Command ID | Label | Key | Precondition | Notes |
|-----------|-------|-----|--------------|-------|
| `tools.brush` | Brush | `b` | — | Calls `finalizeActiveStroke()` before switching |
| `tools.eraser` | Eraser | `e` | — | Same |
| `tools.fill` | Fill | `g` | — | Same |
| `tools.eyedropper` | Eyedropper | `i` | — | Same |
| `tools.line` | Line | `l` | — | Same |
| `tools.selection` | Selection | `m` | — | Same |
| `tools.move` | Move | `v` | — | Same |
| `tools.zoom` | Zoom | `z` | — | Same (note: not Ctrl+Z, just `z` without modifiers) |

### Category: Edit

| Command ID | Label | Key | Precondition | Notes |
|-----------|-------|-----|--------------|-------|
| `edit.undo` | Undo | `Mod+z` | — | Calls Tauri IPC `undo()` |
| `edit.redo` | Redo | `Mod+Shift+z` | — | Calls Tauri IPC `redo()` |
| `edit.redoAlt` | Redo | `Mod+y` | — | Alternative binding, same command as `edit.redo` |
| `edit.brushSizeDecrease` | Decrease Brush Size | `BracketLeft` | — | `setBrushSize(current - 1)` |
| `edit.brushSizeIncrease` | Increase Brush Size | `BracketRight` | — | `setBrushSize(current + 1)` |
| `edit.swapColors` | Swap Colors | `x` | — | `swapColors()` |

Note: `edit.redo` and `edit.redoAlt` — the same command (`edit.redo`) has two keybindings, not two commands.

### Category: View

| Command ID | Label | Key | Trigger | Precondition | Notes |
|-----------|-------|-----|---------|--------------|-------|
| `view.zoomIn` | Zoom In | `Mod+=` | keydown | — | Needs `requestRedraw()` |
| `view.zoomOut` | Zoom Out | `Mod+-` | keydown | — | Needs `requestRedraw()` |
| `view.fitToViewport` | Fit to Viewport | `Mod+0` | keydown | texture loaded | Needs texture dimensions |
| `view.resetZoom` | Reset Zoom (100%) | `Mod+1` | keydown | — | Needs `requestRedraw()` |
| `view.panStart` | Start Pan | `Space` | keydown | — | Sets pan-held state |
| `view.panEnd` | End Pan | `Space` | keyup | — | Clears pan-held state |

### Category: Layers

| Command ID | Label | Key | Precondition | Notes |
|-----------|-------|-----|--------------|-------|
| `layers.removeActive` | Delete Layer | `Delete` | ≥ 2 layers exist | Calls Tauri IPC `removeLayer()` |

### Category: Layout

| Command ID | Label | Key | Precondition | Notes |
|-----------|-------|-----|--------------|-------|
| `layout.reset` | Reset Layout | `Mod+Shift+r` | — | Calls `resetLayout()` from layoutStore |

## State Transitions

### Command Dispatch Flow

```
KeyboardEvent
  │
  ├─ e.repeat === true? → IGNORE (unless allowRepeat)
  │
  ├─ Normalize to canonical key string
  │
  ├─ Look up keybinding by (key, trigger)
  │   └─ No match? → PASS THROUGH (don't preventDefault)
  │
  ├─ Evaluate `when` clause against ContextMap
  │   └─ Fails? → PASS THROUGH
  │
  ├─ Resolve command by commandId
  │   └─ Not found? → WARN + PASS THROUGH
  │
  ├─ Check command precondition
  │   └─ Fails? → PASS THROUGH (silent, command is disabled)
  │
  ├─ e.preventDefault()
  │
  └─ command.execute()
```

### Context Key Lifecycle

```
App mount
  │
  ├─ Register focusin/focusout listeners on window
  │   ├─ focusin: check if target is INPUT/TEXTAREA/contentEditable → set inputFocused
  │   └─ focusout: clear inputFocused
  │
  └─ Context map ready for dispatcher queries

Dispatcher keydown
  │
  └─ Also check dialogOpen lazily: document.querySelector("dialog[open]") !== null
     (Hybrid: inputFocused is eager, dialogOpen is lazy since dialogs are rare)
```
