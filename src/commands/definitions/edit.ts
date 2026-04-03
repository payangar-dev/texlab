import { redo, undo } from "../../api/commands";
import { useToolStore } from "../../store/toolStore";
import { commandRegistry } from "../commandRegistry";
import { keybindingRegistry } from "../keybindingRegistry";

export function registerEditCommands(): void {
  commandRegistry.registerCommand({
    id: "edit.undo",
    label: "Undo",
    category: "edit",
    execute: () => {
      undo().catch((err) => console.error("[edit.undo] undo failed:", err));
    },
  });

  commandRegistry.registerCommand({
    id: "edit.redo",
    label: "Redo",
    category: "edit",
    execute: () => {
      redo().catch((err) => console.error("[edit.redo] redo failed:", err));
    },
  });

  commandRegistry.registerCommand({
    id: "edit.brushSizeDecrease",
    label: "Decrease Brush Size",
    category: "edit",
    execute: () => {
      const store = useToolStore.getState();
      store.setBrushSize(store.brushSize - 1);
    },
  });

  commandRegistry.registerCommand({
    id: "edit.brushSizeIncrease",
    label: "Increase Brush Size",
    category: "edit",
    execute: () => {
      const store = useToolStore.getState();
      store.setBrushSize(store.brushSize + 1);
    },
  });

  commandRegistry.registerCommand({
    id: "edit.swapColors",
    label: "Swap Colors",
    category: "edit",
    execute: () => {
      useToolStore.getState().swapColors();
    },
  });

  keybindingRegistry.registerKeybinding({ key: "Mod+z", commandId: "edit.undo" });
  keybindingRegistry.registerKeybinding({ key: "Mod+Shift+z", commandId: "edit.redo" });
  keybindingRegistry.registerKeybinding({ key: "Mod+y", commandId: "edit.redo" });
  keybindingRegistry.registerKeybinding({
    key: "[",
    commandId: "edit.brushSizeDecrease",
  });
  keybindingRegistry.registerKeybinding({
    key: "]",
    commandId: "edit.brushSizeIncrease",
  });
  keybindingRegistry.registerKeybinding({ key: "x", commandId: "edit.swapColors" });
}
