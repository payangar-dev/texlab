import { registerEditCommands } from "./definitions/edit";
import { registerLayerCommands } from "./definitions/layers";
import { registerLayoutCommands } from "./definitions/layout";
import { registerPaletteCommands } from "./definitions/palette";
import { registerToolCommands } from "./definitions/tools";
import { registerViewCommands } from "./definitions/view";

let initialized = false;

const registrations = [
  registerToolCommands,
  registerEditCommands,
  registerViewCommands,
  // Palette must register before layers so its Delete keybinding wins
  // per FR-012 (delete-swatch is the v1 semantics for Delete — see
  // research.md §7). Layer delete remains available via the panel's
  // trash button.
  registerPaletteCommands,
  registerLayerCommands,
  registerLayoutCommands,
];

export function initializeCommands(): void {
  if (initialized) return;
  initialized = true;

  for (const register of registrations) {
    try {
      register();
    } catch (err) {
      console.error(`[initializeCommands] ${register.name} failed:`, err);
    }
  }
}
