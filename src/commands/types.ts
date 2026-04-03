export type CommandCategory = "tools" | "edit" | "view" | "layers" | "layout";

export interface CommandDefinition {
  id: string;
  label: string;
  category: CommandCategory;
  description?: string;
  execute: () => void;
  precondition?: () => boolean;
}

export interface KeybindingDefinition {
  key: string;
  commandId: string;
  /**
   * Context clause controlling when this keybinding is active.
   * - `undefined` (default): applies `"!inputFocused && !dialogOpen"` — suppressed in text inputs and dialogs.
   * - `null`: always fires regardless of context (used for zoom, space-to-pan, layout reset).
   * - `string`: custom conjunction expression, e.g. `"inputFocused"` or `"!dialogOpen"`.
   */
  when?: string | null;
  trigger?: "keydown" | "keyup";
}

export interface KeybindingMatch {
  keybinding: KeybindingDefinition;
  command: CommandDefinition;
}
