import { commandRegistry } from "./commandRegistry";
import { evaluateWhen } from "./context";
import type { KeybindingDefinition, KeybindingMatch } from "./types";

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

/**
 * Maps `e.code` to the base (unshifted) key for symbols and digits.
 * Intentionally minimal — only codes used by current keybindings are mapped.
 * Extend when adding keybindings for other positional keys (e.g. Semicolon, Backquote).
 */
const CODE_TO_BASE_KEY: Record<string, string> = {
  Equal: "=",
  Minus: "-",
  BracketLeft: "[",
  BracketRight: "]",
  Digit0: "0",
  Digit1: "1",
};

/** Applied when a keybinding omits the `when` field (undefined). */
const DEFAULT_WHEN = "!inputFocused && !dialogOpen";

export function normalizeKeyEvent(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;

  // Code-mapped keys (=, -, [, ], 0, 1) resolve the physical key regardless of
  // Shift state. Shift is stripped so that e.g. Ctrl+Shift+= ("+") normalizes
  // to "Mod+=" — matching the same keybinding as Ctrl+= without Shift.
  const isCodeMapped = e.code in CODE_TO_BASE_KEY;

  let prefix = "";
  if (e.ctrlKey || e.metaKey) prefix += "Mod+";
  if (e.altKey) prefix += "Alt+";
  if (e.shiftKey && !isCodeMapped) prefix += "Shift+";

  let baseKey: string;
  if (isCodeMapped) {
    baseKey = CODE_TO_BASE_KEY[e.code];
  } else if (e.code === "Space") {
    baseKey = "Space";
  } else if (e.key.length === 1) {
    baseKey = e.key.toLowerCase();
  } else {
    baseKey = e.key;
  }

  return prefix + baseKey;
}

/**
 * Resolves the effective `when` clause for a keybinding:
 * - `undefined` → default suppression clause (see DEFAULT_WHEN)
 * - `null` → always fire (bypass context)
 * - `string` → custom clause
 */
function resolveWhen(when: string | null | undefined): string | null {
  if (when === undefined) return DEFAULT_WHEN;
  return when;
}

export class KeybindingRegistry {
  private bindings: KeybindingDefinition[] = [];

  registerKeybinding(binding: KeybindingDefinition): void {
    const newTrigger = binding.trigger ?? "keydown";
    const newWhen = resolveWhen(binding.when);

    for (const existing of this.bindings) {
      if (existing.key !== binding.key) continue;
      if ((existing.trigger ?? "keydown") !== newTrigger) continue;

      const existingWhen = resolveWhen(existing.when);
      if (existingWhen === newWhen) {
        console.warn(
          `[KeybindingRegistry] Conflict: "${binding.key}" is bound to both ` +
            `"${existing.commandId}" and "${binding.commandId}" ` +
            `(same trigger="${newTrigger}", when=${JSON.stringify(newWhen)}). ` +
            `First match ("${existing.commandId}") wins; "${binding.commandId}" will be unreachable.`,
        );
      }
    }

    this.bindings.push(binding);
  }

  findMatch(
    key: string,
    trigger: "keydown" | "keyup",
    context: Map<string, boolean>,
  ): KeybindingMatch | undefined {
    for (const binding of this.bindings) {
      if (binding.key !== key) continue;
      if ((binding.trigger ?? "keydown") !== trigger) continue;

      const when = resolveWhen(binding.when);
      if (!evaluateWhen(when, context)) continue;

      const command = commandRegistry.getCommand(binding.commandId);
      if (!command) {
        console.warn(
          `[KeybindingRegistry] Keybinding "${key}" references unknown command "${binding.commandId}"`,
        );
        continue;
      }

      return { keybinding: binding, command };
    }
    return undefined;
  }

  getKeybindingsForCommand(commandId: string): KeybindingDefinition[] {
    return this.bindings.filter((b) => b.commandId === commandId);
  }

  getAllKeybindings(): KeybindingDefinition[] {
    return [...this.bindings];
  }
}

export const keybindingRegistry = new KeybindingRegistry();
