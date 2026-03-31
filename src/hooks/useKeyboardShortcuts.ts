import { useEffect } from "react";
import { redo, undo } from "../api/commands";
import { finalizeActiveStroke } from "../components/canvas/CanvasViewport";
import { useEditorStore } from "../store/editorStore";
import { type ToolType, useToolStore } from "../store/toolStore";
import { useViewportStore } from "../store/viewportStore";

function shouldSuppressShortcut(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return true;
  if (target.closest("dialog[open]")) return true;
  return false;
}

const TOOL_SHORTCUTS: Record<string, ToolType> = {
  b: "brush",
  e: "eraser",
  g: "fill",
  i: "eyedropper",
  l: "line",
  m: "selection",
  v: "move",
  z: "zoom",
};

export function useKeyboardShortcuts(
  spaceHeldRef: React.RefObject<boolean>,
  requestRedraw: () => void,
): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Space key tracking for pan mode
      if (e.code === "Space" && !e.repeat) {
        spaceHeldRef.current = true;
        e.preventDefault();
        return;
      }

      // Ctrl/Meta shortcuts (zoom, undo/redo)
      if (e.ctrlKey || e.metaKey) {
        const store = useViewportStore.getState();

        switch (e.key) {
          case "z":
          case "Z":
            // Ctrl+Shift+Z = redo, Ctrl+Z = undo
            // Skip when in text inputs (preserve native undo)
            if (shouldSuppressShortcut(e)) break;
            e.preventDefault();
            if (e.shiftKey) {
              redo().catch(() => {});
            } else {
              undo().catch(() => {});
            }
            break;
          case "y":
            if (shouldSuppressShortcut(e)) break;
            e.preventDefault();
            redo().catch(() => {});
            break;
          case "=":
          case "+":
            e.preventDefault();
            store.zoomIn();
            requestRedraw();
            break;
          case "-":
            e.preventDefault();
            store.zoomOut();
            requestRedraw();
            break;
          case "0": {
            e.preventDefault();
            const texture = useEditorStore.getState().texture;
            if (texture) {
              store.fitToViewport(texture.width, texture.height);
              requestRedraw();
            }
            break;
          }
          case "1":
            e.preventDefault();
            store.resetZoom();
            requestRedraw();
            break;
        }
        return;
      }

      // Non-modifier shortcuts — suppress in text inputs
      if (shouldSuppressShortcut(e)) return;

      const key = e.key.toLowerCase();

      // Tool selection shortcuts
      const toolType = TOOL_SHORTCUTS[key];
      if (toolType) {
        e.preventDefault();
        finalizeActiveStroke();
        useToolStore.getState().setActiveToolType(toolType);
        return;
      }

      // Brush size: [ decrease, ] increase
      if (e.key === "[") {
        e.preventDefault();
        const store = useToolStore.getState();
        store.setBrushSize(store.brushSize - 1);
        return;
      }
      if (e.key === "]") {
        e.preventDefault();
        const store = useToolStore.getState();
        store.setBrushSize(store.brushSize + 1);
        return;
      }

      // X: swap primary/secondary colors
      if (key === "x") {
        e.preventDefault();
        useToolStore.getState().swapColors();
        return;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeldRef.current = false;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [spaceHeldRef, requestRedraw]);
}
