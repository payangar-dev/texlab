# Contract: Command Dispatcher

**Feature**: 034-command-keybinding-registries
**Type**: React hook (frontend)

## Overview

The dispatcher is a single React hook that replaces all scattered `window.addEventListener("keydown", ...)` calls. It intercepts keyboard events, normalizes them, evaluates context, and routes to the matching command.

## API Surface

### `useCommandDispatcher(): void`

React hook. Must be called exactly once, at the `AppShell` component level.

**Behavior**:
1. On mount: registers `window.addEventListener("keydown", ...)` and `window.addEventListener("keyup", ...)`
2. On keydown:
   - If `e.repeat === true` → ignore
   - Normalize event → `normalizeKeyEvent(e)`
   - Build context → `getContext()`
   - Find match → `keybindingRegistry.findMatch(key, "keydown", context)`
   - If match found:
     - Check command precondition → if fails, pass through
     - Call `e.preventDefault()`
     - Call `command.execute()`
3. On keyup:
   - Normalize event
   - Find match for `"keyup"` trigger
   - If match found: execute (no precondition check for keyup, no preventDefault needed)
4. On unmount: removes both listeners

**Does NOT handle**:
- Mouse events (stays in `useViewportControls`)
- Local component keyboard handlers (F2/Enter/Escape in `LayerRow`)
- Wheel events (stays in `useViewportControls`)

## Context Evaluation

### `getContext(): Map<string, boolean>`

Returns the current context state for `when` clause evaluation.

**Maintained state**:
- `inputFocused`: Updated eagerly via `focusin`/`focusout` listeners on `window`
- `dialogOpen`: Checked lazily via `document.querySelector("dialog[open]") !== null`

### `initContext(): () => void`

Initializes context listeners (focusin/focusout). Returns a cleanup function. Called once in the dispatcher hook.

## Initialization

### `initializeCommands(): void`

Called once before the dispatcher hook runs. Registers all commands and keybindings.

**Cross-component dependencies**: Some commands need functions from other components (`requestRedraw` from canvas renderer, `resetLayout` from DockLayout). These use the **module-level callback pattern** already established by `finalizeActiveStroke` in CanvasViewport:

- `requestCanvasRedraw()` — exported from `CanvasViewport.tsx`, set during component mount
- `triggerLayoutReset()` — exported from `DockLayout.tsx`, set during component mount

Commands import and call these functions at execution time (not registration time), so mount order doesn't matter.

## Lifecycle

```
AppShell mount
  │
  ├─ initializeCommands()
  │   ├─ Register all commands to commandRegistry
  │   └─ Register all keybindings to keybindingRegistry
  │
  └─ useCommandDispatcher()
      ├─ initContext() → focusin/focusout listeners
      ├─ window.addEventListener("keydown", dispatcher)
      └─ window.addEventListener("keyup", dispatcher)

CanvasViewport
  │
  └─ No longer calls useKeyboardShortcuts (removed)
      Still handles: pointer events, wheel zoom, resize observer

LayersPanel
  │
  └─ No longer has global Delete keydown listener (moved to registry)

DockLayout
  │
  └─ No longer has Ctrl+Shift+R keydown listener (moved to registry)
```

## Dependencies Flow

```
  initializeCommands()
    │
    ├─ imports: commandRegistry, keybindingRegistry
    ├─ imports: useToolStore, useViewportStore, useEditorStore (via getState())
    ├─ imports: undo, redo, removeLayer (from api/commands)
    ├─ imports: finalizeActiveStroke, requestCanvasRedraw (from CanvasViewport)
    └─ imports: triggerLayoutReset (from DockLayout)
```
