import { requestCanvasRedraw } from "../../components/canvas/CanvasViewport";
import { useEditorStore } from "../../store/editorStore";
import { useViewportStore } from "../../store/viewportStore";
import { commandRegistry } from "../commandRegistry";
import { keybindingRegistry } from "../keybindingRegistry";

let panHeld = false;

export function isPanHeld(): boolean {
  return panHeld;
}

export function registerViewCommands(): void {
  // Reset panHeld when the window loses focus (e.g. Alt-Tab while Space is held).
  // Without this, the keyup event is never fired and the cursor gets stuck in grab mode.
  window.addEventListener("blur", () => {
    panHeld = false;
  });

  commandRegistry.registerCommand({
    id: "view.zoomIn",
    label: "Zoom In",
    category: "view",
    execute: () => {
      useViewportStore.getState().zoomIn();
      requestCanvasRedraw();
    },
  });

  commandRegistry.registerCommand({
    id: "view.zoomOut",
    label: "Zoom Out",
    category: "view",
    execute: () => {
      useViewportStore.getState().zoomOut();
      requestCanvasRedraw();
    },
  });

  commandRegistry.registerCommand({
    id: "view.fitToViewport",
    label: "Fit to Viewport",
    category: "view",
    precondition: () => useEditorStore.getState().texture !== null,
    execute: () => {
      const texture = useEditorStore.getState().texture;
      if (texture) {
        useViewportStore.getState().fitToViewport(texture.width, texture.height);
        requestCanvasRedraw();
      }
    },
  });

  commandRegistry.registerCommand({
    id: "view.resetZoom",
    label: "Reset Zoom (100%)",
    category: "view",
    execute: () => {
      useViewportStore.getState().resetZoom();
      requestCanvasRedraw();
    },
  });

  commandRegistry.registerCommand({
    id: "view.panStart",
    label: "Start Pan",
    category: "view",
    execute: () => {
      panHeld = true;
    },
  });

  commandRegistry.registerCommand({
    id: "view.panEnd",
    label: "End Pan",
    category: "view",
    execute: () => {
      panHeld = false;
    },
  });

  // Zoom and space keybindings: when: null = always fire (bypass input suppression)
  keybindingRegistry.registerKeybinding({
    key: "Mod+=",
    commandId: "view.zoomIn",
    when: null,
  });
  keybindingRegistry.registerKeybinding({
    key: "Mod+-",
    commandId: "view.zoomOut",
    when: null,
  });
  keybindingRegistry.registerKeybinding({
    key: "Mod+0",
    commandId: "view.fitToViewport",
    when: null,
  });
  keybindingRegistry.registerKeybinding({
    key: "Mod+1",
    commandId: "view.resetZoom",
    when: null,
  });
  keybindingRegistry.registerKeybinding({
    key: "Space",
    commandId: "view.panStart",
    trigger: "keydown",
    when: null,
  });
  keybindingRegistry.registerKeybinding({
    key: "Space",
    commandId: "view.panEnd",
    trigger: "keyup",
    when: null,
  });
}
