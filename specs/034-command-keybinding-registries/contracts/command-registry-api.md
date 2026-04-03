# Contract: Command Registry API

**Feature**: 034-command-keybinding-registries
**Type**: Internal TypeScript API (frontend module)

## Overview

The Command Registry is the central store for all application commands. It provides registration, lookup, listing, and programmatic execution.

## Types

```typescript
type CommandCategory = "tools" | "edit" | "view" | "layers" | "layout";

interface CommandDefinition {
  id: string;
  label: string;
  category: CommandCategory;
  description?: string;
  execute: () => void;
  precondition?: () => boolean;
}
```

## API Surface

### `registerCommand(command: CommandDefinition): void`

Register a command. Throws if `id` is already registered.

**Constraints**:
- `id` must be unique
- `id` must follow `category.name` format
- `label` must be non-empty

### `getCommand(id: string): CommandDefinition | undefined`

Retrieve a command by its ID. Returns `undefined` if not found.

### `executeCommand(id: string): boolean`

Execute a command by ID. Returns `true` if executed, `false` if precondition failed or command not found.

**Flow**:
1. Resolve command by ID
2. If `precondition` is defined, evaluate it — if `false`, return `false`
3. Call `execute()`
4. Return `true`

### `getAllCommands(): CommandDefinition[]`

Return all registered commands, sorted by category then label.

### `getCommandsByCategory(category: CommandCategory): CommandDefinition[]`

Return commands in a specific category, sorted by label.

### `getCategories(): CommandCategory[]`

Return all categories that have at least one registered command.

## Usage Example

```typescript
import { commandRegistry } from "./commandRegistry";

// Registration (at app init)
commandRegistry.registerCommand({
  id: "tools.brush",
  label: "Brush",
  category: "tools",
  execute: () => {
    finalizeActiveStroke();
    useToolStore.getState().setActiveToolType("brush");
  },
});

// Programmatic execution (future: command palette)
commandRegistry.executeCommand("edit.undo");

// Discovery (future: keybinding editor)
const toolCommands = commandRegistry.getCommandsByCategory("tools");
```
