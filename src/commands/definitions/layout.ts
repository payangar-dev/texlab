import { triggerLayoutReset } from "../../components/shell/DockLayout";
import { commandRegistry } from "../commandRegistry";
import { keybindingRegistry } from "../keybindingRegistry";

export function registerLayoutCommands(): void {
  commandRegistry.registerCommand({
    id: "layout.reset",
    label: "Reset Layout",
    category: "layout",
    execute: () => {
      triggerLayoutReset();
    },
  });

  keybindingRegistry.registerKeybinding({
    key: "Mod+Shift+r",
    commandId: "layout.reset",
    when: null,
  });
}
