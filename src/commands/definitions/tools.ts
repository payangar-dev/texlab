import { finalizeActiveStroke } from "../../components/canvas/CanvasViewport";
import { type ToolType, useToolStore } from "../../store/toolStore";
import { commandRegistry } from "../commandRegistry";
import { keybindingRegistry } from "../keybindingRegistry";

const TOOL_COMMANDS: { id: string; label: string; key: string; toolType: ToolType }[] = [
  { id: "tools.brush", label: "Brush", key: "b", toolType: "brush" },
  { id: "tools.eraser", label: "Eraser", key: "e", toolType: "eraser" },
  { id: "tools.fill", label: "Fill", key: "g", toolType: "fill" },
  { id: "tools.eyedropper", label: "Eyedropper", key: "i", toolType: "eyedropper" },
  { id: "tools.line", label: "Line", key: "l", toolType: "line" },
  { id: "tools.selection", label: "Selection", key: "m", toolType: "selection" },
  { id: "tools.move", label: "Move", key: "v", toolType: "move" },
  { id: "tools.zoom", label: "Zoom", key: "z", toolType: "zoom" },
];

export function registerToolCommands(): void {
  for (const { id, label, key, toolType } of TOOL_COMMANDS) {
    commandRegistry.registerCommand({
      id,
      label,
      category: "tools",
      execute: () => {
        finalizeActiveStroke();
        useToolStore.getState().setActiveToolType(toolType);
      },
    });

    keybindingRegistry.registerKeybinding({ key, commandId: id });
  }
}
