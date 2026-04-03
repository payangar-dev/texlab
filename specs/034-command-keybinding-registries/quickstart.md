# Quickstart: Command & Keybinding Registries

**Feature**: 034-command-keybinding-registries

## What This Does

Replaces 3 scattered `window.addEventListener("keydown", ...)` calls with a centralized command + keybinding system. All existing shortcuts work identically — this is a pure infrastructure refactor.

## Architecture at a Glance

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  KeyboardEvent   │────▶│    Dispatcher     │────▶│   Command    │
│  (window level)  │     │  normalize + ctx  │     │   execute()  │
└─────────────────┘     └──────────────────┘     └──────────────┘
                              │       │
                    ┌─────────┘       └─────────┐
               ┌────▼─────┐            ┌────────▼───────┐
               │ Keybinding│            │  Context Map   │
               │ Registry  │            │ inputFocused   │
               │ key→cmdId │            │ dialogOpen     │
               └───────────┘            └────────────────┘
```

## How to Add a New Command

1. **Define the command** in the appropriate file under `src/commands/definitions/`:

```typescript
// src/commands/definitions/edit.ts
import { commandRegistry } from "../commandRegistry";
import { keybindingRegistry } from "../keybindingRegistry";

export function registerEditCommands(): void {
  commandRegistry.registerCommand({
    id: "edit.myNewAction",
    label: "My New Action",
    category: "edit",
    execute: () => {
      // your action here
    },
  });

  keybindingRegistry.registerKeybinding({
    key: "Mod+Shift+n",
    commandId: "edit.myNewAction",
  });
}
```

2. **Call the registration function** from `src/commands/index.ts`:

```typescript
import { registerEditCommands } from "./definitions/edit";
// ...
export function initializeCommands(deps: CommandDependencies): void {
  registerEditCommands();
  // ... other categories
}
```

That's it. No event listener boilerplate needed.

## How to Add a Shortcut to an Existing Command

```typescript
keybindingRegistry.registerKeybinding({
  key: "Mod+Shift+z",
  commandId: "edit.redo",
});
// Now both Mod+Shift+Z and Mod+Y trigger redo
```

## How to Add a Preconditioned Command

```typescript
commandRegistry.registerCommand({
  id: "layers.removeActive",
  label: "Delete Layer",
  category: "layers",
  execute: () => removeLayer(activeLayerId),
  precondition: () => useEditorStore.getState().layers.length > 1,
});
```

If the precondition returns `false`, the shortcut is silently ignored (no error, no notification).

## Key Conventions

- Command IDs: `category.camelCaseName` (e.g., `tools.brush`, `edit.undo`, `view.zoomIn`)
- Key notation: `Mod` for Ctrl/Cmd, letters lowercase, special keys PascalCase
- Default `when`: `!inputFocused && !dialogOpen` (shortcuts suppressed in text fields)
- `trigger: "keyup"` for release-based commands (only space-to-pan currently)

## Files Changed

| File | Change |
|------|--------|
| `src/commands/types.ts` | NEW — Type definitions |
| `src/commands/commandRegistry.ts` | NEW — Command registry |
| `src/commands/keybindingRegistry.ts` | NEW — Keybinding registry + normalizer |
| `src/commands/context.ts` | NEW — Context evaluation |
| `src/commands/dispatcher.ts` | NEW — `useCommandDispatcher` hook |
| `src/commands/definitions/*.ts` | NEW — Command definitions by category |
| `src/commands/index.ts` | NEW — `initializeCommands()` entry point |
| `src/hooks/useKeyboardShortcuts.ts` | DELETED |
| `src/components/canvas/CanvasViewport.tsx` | Remove `useKeyboardShortcuts` call |
| `src/components/layers/LayersPanel.tsx` | Remove global Delete listener |
| `src/components/shell/DockLayout.tsx` | Remove global Ctrl+Shift+R listener |
| `src/components/shell/AppShell.tsx` | Mount `useCommandDispatcher` |
