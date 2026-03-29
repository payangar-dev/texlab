import { useEffect } from "react";
import { useEditorStore } from "../store/editorStore";
import { useViewportStore } from "../store/viewportStore";

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

      if (!e.ctrlKey && !e.metaKey) return;

      const store = useViewportStore.getState();

      switch (e.key) {
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
