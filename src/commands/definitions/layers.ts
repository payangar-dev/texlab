import { removeLayer } from "../../api/commands";
import { useEditorStore } from "../../store/editorStore";
import { commandRegistry } from "../commandRegistry";
import { keybindingRegistry } from "../keybindingRegistry";

export function registerLayerCommands(): void {
  commandRegistry.registerCommand({
    id: "layers.removeActive",
    label: "Delete Layer",
    category: "layers",
    precondition: () => useEditorStore.getState().layers.length > 1,
    execute: () => {
      const { activeLayerId } = useEditorStore.getState();
      if (!activeLayerId) return;
      removeLayer(activeLayerId)
        .then((state) => useEditorStore.setState(state))
        .catch((err) => console.error("[layers.removeActive] removeLayer failed:", err));
    },
  });

  keybindingRegistry.registerKeybinding({
    key: "Delete",
    commandId: "layers.removeActive",
  });
}
