import { registerEditCommands } from "./definitions/edit";
import { registerLayerCommands } from "./definitions/layers";
import { registerLayoutCommands } from "./definitions/layout";
import { registerToolCommands } from "./definitions/tools";
import { registerViewCommands } from "./definitions/view";

let initialized = false;

const registrations = [
  registerToolCommands,
  registerEditCommands,
  registerViewCommands,
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
