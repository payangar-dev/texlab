# Contract: Keybinding Registry API

**Feature**: 034-command-keybinding-registries
**Type**: Internal TypeScript API (frontend module)

## Overview

The Keybinding Registry maps key combinations to commands with context-aware dispatch. It works alongside the Command Registry.

## Types

```typescript
interface KeybindingDefinition {
  key: string;                          // Canonical format: "Mod+z", "b", "Delete", "Space"
  commandId: string;                    // Must reference a registered command
  when?: string | null;                  // undefined = default "!inputFocused && !dialogOpen", null = always fire (bypass suppression), string = custom clause
  trigger?: "keydown" | "keyup";        // Default: "keydown"
}

interface KeybindingMatch {
  keybinding: KeybindingDefinition;
  command: CommandDefinition;
}
```

## API Surface

### `registerKeybinding(binding: KeybindingDefinition): void`

Register a keybinding. Logs a warning if a conflict is detected (same `key` + overlapping `when` clause).

**Conflict detection rules**:
- Same `key` + same `trigger` + identical `when` (or both undefined) = conflict → `console.warn`
- Same `key` + same `trigger` + different `when` = no conflict (context-based overloading)
- Same `key` + different `trigger` = no conflict (keydown vs keyup)

### `findMatch(key: string, trigger: "keydown" | "keyup", context: Map<string, boolean>): KeybindingMatch | undefined`

Find the first keybinding that matches the given key, trigger type, and context.

**Flow**:
1. Filter keybindings by `key` and `trigger`
2. For each candidate, evaluate `when` clause against context
3. Return first match (with its resolved command), or `undefined`

### `getAllKeybindings(): KeybindingDefinition[]`

Return all registered keybindings.

### `getKeybindingsForCommand(commandId: string): KeybindingDefinition[]`

Return all keybindings that map to a specific command.

## Key Normalization

### `normalizeKeyEvent(e: KeyboardEvent): string`

Convert a raw `KeyboardEvent` into a canonical key string.

**Algorithm**:
1. Build modifier prefix: `Mod+` if `e.ctrlKey || e.metaKey`, `Alt+` if `e.altKey`, `Shift+` if `e.shiftKey`
2. Determine base key:
   - If `e.code` is in the symbol map (`Equal`, `Minus`, `BracketLeft`, `BracketRight`): use mapped value (`=`, `-`, `[`, `]`)
   - If `e.code === "Space"`: use `Space`
   - If `e.key.length === 1`: use `e.key.toLowerCase()`
   - Otherwise: use `e.key` (e.g., `Delete`, `F2`, `Escape`)
3. Skip if key is a modifier itself (`Control`, `Shift`, `Alt`, `Meta`)
4. Concatenate: `modifiers + baseKey`

**Symbol code map** (handles Shift-altered keys):
```
Equal    → =
Minus    → -
BracketLeft  → [
BracketRight → ]
Digit0   → 0
Digit1   → 1
```

### Examples

| Event | Normalized |
|-------|-----------|
| `key:"b", ctrl:false, shift:false` | `b` |
| `key:"Z", ctrl:true, shift:true` | `Mod+Shift+z` |
| `key:"+", ctrl:true, shift:true, code:"Equal"` | `Mod+Shift+=` |
| `key:"Delete"` | `Delete` |
| `code:"Space"` | `Space` |
| `key:"-", ctrl:true, code:"Minus"` | `Mod+-` |

## Usage Example

```typescript
import { keybindingRegistry, normalizeKeyEvent } from "./keybindingRegistry";
import { commandRegistry } from "./commandRegistry";

// Registration
keybindingRegistry.registerKeybinding({
  key: "Mod+z",
  commandId: "edit.undo",
});

keybindingRegistry.registerKeybinding({
  key: "Space",
  commandId: "view.panStart",
  trigger: "keydown",
  when: "!inputFocused",
});

keybindingRegistry.registerKeybinding({
  key: "Space",
  commandId: "view.panEnd",
  trigger: "keyup",
});

// Dispatch (inside useCommandDispatcher)
const normalized = normalizeKeyEvent(event);
const context = getContext();
const match = keybindingRegistry.findMatch(normalized, "keydown", context);
if (match) {
  event.preventDefault();
  commandRegistry.executeCommand(match.command.id);
}
```
