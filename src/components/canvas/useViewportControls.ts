import { useEffect, useRef } from "react";
import { type ToolResultDto, toolDrag, toolPress, toolRelease } from "../../api/commands";
import { useEditorStore } from "../../store/editorStore";
import { useToolStore } from "../../store/toolStore";
import { useViewportStore } from "../../store/viewportStore";
import { notifyCursorListeners } from "./CanvasViewport";
import { isInBounds, pixelAtScreen } from "./math";
import type { CanvasRendererApi } from "./useCanvasRenderer";

type InteractionMode = "idle" | "tool" | "pan";

export function useViewportControls(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  renderer: CanvasRendererApi,
): {
  interactionModeRef: React.RefObject<InteractionMode>;
  cursorPixelRef: React.RefObject<{ x: number; y: number } | null>;
  spaceHeldRef: React.RefObject<boolean>;
} {
  const interactionModeRef = useRef<InteractionMode>("idle");
  const spaceHeldRef = useRef(false);
  const panStartRef = useRef({ screenX: 0, screenY: 0, panX: 0, panY: 0 });

  // Wheel zoom handler (native listener for passive: false)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const store = useViewportStore.getState();
      if (e.deltaY < 0) {
        store.zoomIn(e.offsetX, e.offsetY);
      } else {
        store.zoomOut(e.offsetX, e.offsetY);
      }
      renderer.requestRedraw();
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [canvasRef, renderer]);

  // Pointer events for pan and tool dispatch
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCursor = () => {
      if (interactionModeRef.current === "pan") {
        canvas.style.cursor = "grabbing";
      } else if (spaceHeldRef.current) {
        canvas.style.cursor = "grab";
      } else {
        canvas.style.cursor = "crosshair";
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      const isPanTrigger = e.button === 1 || (e.button === 0 && spaceHeldRef.current);

      if (isPanTrigger && interactionModeRef.current === "idle") {
        interactionModeRef.current = "pan";
        canvas.setPointerCapture(e.pointerId);
        const { panX, panY } = useViewportStore.getState();
        panStartRef.current = {
          screenX: e.clientX,
          screenY: e.clientY,
          panX,
          panY,
        };
        updateCursor();
        e.preventDefault();
        return;
      }

      if (e.button === 0 && interactionModeRef.current === "idle") {
        const { zoom, panX, panY } = useViewportStore.getState();
        const pixel = pixelAtScreen(e.offsetX, e.offsetY, panX, panY, zoom);
        const { texture, activeLayerId } = useEditorStore.getState();
        if (!texture || !activeLayerId) return;
        if (!isInBounds(pixel.x, pixel.y, texture.width, texture.height)) return;

        // Set mode and capture only after validation passes
        interactionModeRef.current = "tool";
        canvas.setPointerCapture(e.pointerId);

        const { activeToolType, brushSize, activeColor } = useToolStore.getState();
        toolPress(activeToolType, activeLayerId, pixel.x, pixel.y, activeColor, brushSize)
          .then((result) => handleToolResult(result))
          .catch((err) => console.error("[useViewportControls] toolPress failed:", err));
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const { zoom, panX, panY } = useViewportStore.getState();
      const texture = useEditorStore.getState().texture;

      // Update cursor pixel for overlay
      if (texture) {
        const pixel = pixelAtScreen(e.offsetX, e.offsetY, panX, panY, zoom);
        if (isInBounds(pixel.x, pixel.y, texture.width, texture.height)) {
          renderer.cursorPixelRef.current = pixel;
          notifyCursorListeners(pixel);
        } else {
          renderer.cursorPixelRef.current = null;
          notifyCursorListeners(null);
        }
        renderer.brushSizeRef.current = useToolStore.getState().brushSize;
        renderer.requestRedraw();
      }

      if (interactionModeRef.current === "pan") {
        const dx = e.clientX - panStartRef.current.screenX;
        const dy = e.clientY - panStartRef.current.screenY;
        const newPanX = panStartRef.current.panX + dx;
        const newPanY = panStartRef.current.panY + dy;

        if (texture) {
          useViewportStore
            .getState()
            .setPan(newPanX, newPanY, texture.width, texture.height);
        } else {
          useViewportStore.getState().setPan(newPanX, newPanY);
        }
        renderer.requestRedraw();
        return;
      }

      if (interactionModeRef.current === "tool") {
        const pixel = pixelAtScreen(e.offsetX, e.offsetY, panX, panY, zoom);
        const activeLayerId = useEditorStore.getState().activeLayerId;
        if (!texture || !activeLayerId) return;
        if (!isInBounds(pixel.x, pixel.y, texture.width, texture.height)) return;

        const { brushSize, activeColor } = useToolStore.getState();
        toolDrag(activeLayerId, pixel.x, pixel.y, activeColor, brushSize)
          .then((result) => handleToolResult(result))
          .catch((err) => console.error("[useViewportControls] toolDrag failed:", err));
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (interactionModeRef.current === "pan") {
        interactionModeRef.current = "idle";
        canvas.releasePointerCapture(e.pointerId);
        updateCursor();
        return;
      }

      if (interactionModeRef.current === "tool") {
        interactionModeRef.current = "idle";
        canvas.releasePointerCapture(e.pointerId);

        const { zoom, panX, panY } = useViewportStore.getState();
        const pixel = pixelAtScreen(e.offsetX, e.offsetY, panX, panY, zoom);
        const { texture, activeLayerId } = useEditorStore.getState();
        if (!texture || !activeLayerId) return;
        if (!isInBounds(pixel.x, pixel.y, texture.width, texture.height)) return;

        const { brushSize, activeColor } = useToolStore.getState();
        toolRelease(activeLayerId, pixel.x, pixel.y, activeColor, brushSize)
          .then((result) => handleToolResult(result))
          .catch((err) =>
            console.error("[useViewportControls] toolRelease failed:", err),
          );
      }
    };

    const onPointerLeave = () => {
      renderer.cursorPixelRef.current = null;
      notifyCursorListeners(null);
      renderer.requestRedraw();
    };

    const handleToolResult = (result: ToolResultDto) => {
      if (result.resultType === "pixels_modified" && result.composite) {
        const data = new Uint8ClampedArray(result.composite.data);
        renderer.updateComposite(data, result.composite.width, result.composite.height);
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [canvasRef, renderer]);

  return {
    interactionModeRef,
    cursorPixelRef: renderer.cursorPixelRef,
    spaceHeldRef,
  };
}
