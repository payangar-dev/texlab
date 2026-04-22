import { useEffect, useRef } from "react";
import {
  addColorToActivePalette,
  getComposite,
  type ToolResultDto,
  toolDrag,
  toolPress,
  toolRelease,
} from "../../api/commands";
import crosshairSvg from "../../assets/cursors/crosshair.svg?raw";
import moveSvg from "../../assets/cursors/move.svg?raw";
import paintBucketSvg from "../../assets/cursors/paint-bucket.svg?raw";
import pipetteSvg from "../../assets/cursors/pipette.svg?raw";
import zoomInSvg from "../../assets/cursors/zoom-in.svg?raw";
import { usePaletteStore } from "../../store/paletteStore";

function svgCursor(svg: string, hotX: number, hotY: number, fallback: string): string {
  return `url('data:image/svg+xml,${encodeURIComponent(svg)}') ${hotX} ${hotY}, ${fallback}`;
}

import { isPanHeld } from "../../commands/definitions/view";
import { useEditorStore } from "../../store/editorStore";
import { type ToolType, useToolStore } from "../../store/toolStore";
import { useViewportStore } from "../../store/viewportStore";
import { notifyCursorListeners } from "./CanvasViewport";
import { isInBounds, pixelAtScreen } from "./math";
import type { CanvasRendererApi } from "./useCanvasRenderer";

type InteractionMode = "idle" | "tool" | "pan";

/**
 * Reads the composite pixel at (x, y) via IPC and appends its color to the
 * active palette. Used by palette pipette mode (FR-010). Called only when
 * `paletteStore.pipetteActive === true` so the extra getComposite round-trip
 * is bounded to explicit pipette clicks.
 */
async function sampleCompositeAndAppend(x: number, y: number): Promise<void> {
  const composite = await getComposite();
  const index = (y * composite.width + x) * 4;
  const r = composite.data[index] ?? 0;
  const g = composite.data[index + 1] ?? 0;
  const b = composite.data[index + 2] ?? 0;
  const hex = `#${[r, g, b]
    .map((n) => n.toString(16).padStart(2, "0").toUpperCase())
    .join("")}`;
  await addColorToActivePalette(hex);
}

const NON_DRAWING_TOOLS = new Set<ToolType>(["move", "zoom"]);

const TOOL_CURSORS: Record<ToolType, string> = {
  brush: svgCursor(crosshairSvg, 12, 12, "crosshair"),
  eraser: svgCursor(crosshairSvg, 12, 12, "crosshair"),
  line: svgCursor(crosshairSvg, 12, 12, "crosshair"),
  fill: svgCursor(paintBucketSvg, 17, 16, "crosshair"),
  eyedropper: svgCursor(pipetteSvg, 1, 22, "crosshair"),
  selection: svgCursor(crosshairSvg, 12, 12, "crosshair"),
  move: svgCursor(moveSvg, 12, 12, "move"),
  zoom: svgCursor(zoomInSvg, 11, 11, "zoom-in"),
};

/** Brush preview size per tool. 0 = no preview. */
function brushPreviewSize(tool: ToolType, brushSize: number): number {
  switch (tool) {
    case "brush":
    case "eraser":
    case "line":
      return brushSize;
    case "fill":
    case "eyedropper":
      return 1;
    default:
      return 0;
  }
}

/** Tools that support Shift+Click straight line drawing. */
const SHIFT_CLICK_TOOLS = new Set<ToolType>(["brush", "eraser", "line"]);

export function useViewportControls(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  renderer: CanvasRendererApi,
): {
  interactionModeRef: React.RefObject<InteractionMode>;
  cursorPixelRef: React.RefObject<{ x: number; y: number } | null>;
  lastCursorPixelRef: React.RefObject<{ x: number; y: number } | null>;
  finalizeStroke: () => void;
} {
  const interactionModeRef = useRef<InteractionMode>("idle");
  const panStartRef = useRef({ screenX: 0, screenY: 0, panX: 0, panY: 0 });
  const lastCursorPixelRef = useRef<{ x: number; y: number } | null>(null);
  const lastStrokeEndPointRef = useRef<{ x: number; y: number } | null>(null);
  const handleToolResultRef = useRef<(result: ToolResultDto) => void>(() => {});

  // Serialized drag: at most one toolDrag IPC in flight at a time
  const pendingDragRef = useRef<{ x: number; y: number } | null>(null);
  const dragInFlightRef = useRef(false);

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
      } else if (isPanHeld()) {
        canvas.style.cursor = "grab";
      } else {
        const tool = useToolStore.getState().activeToolType;
        canvas.style.cursor = TOOL_CURSORS[tool];
      }
    };
    updateCursor();

    const processDrag = () => {
      const pending = pendingDragRef.current;
      if (!pending || dragInFlightRef.current) return;
      pendingDragRef.current = null;
      dragInFlightRef.current = true;

      const { texture, activeLayerId } = useEditorStore.getState();
      if (!texture || !activeLayerId) {
        dragInFlightRef.current = false;
        return;
      }
      if (!isInBounds(pending.x, pending.y, texture.width, texture.height)) {
        dragInFlightRef.current = false;
        return;
      }

      const { brushSize, activeColor, opacity } = useToolStore.getState();
      toolDrag(activeLayerId, pending.x, pending.y, activeColor, brushSize, opacity / 100)
        .then((result) => handleToolResult(result))
        .catch((err) => console.error("[useViewportControls] toolDrag failed:", err))
        .finally(() => {
          dragInFlightRef.current = false;
          if (pendingDragRef.current) processDrag();
        });
    };

    const onPointerDown = (e: PointerEvent) => {
      // Left-click (0) triggers tools, middle-click (1) triggers pan
      if (e.button !== 0 && e.button !== 1) return;

      const isPanTrigger = e.button === 1 || (e.button === 0 && isPanHeld());

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
        const { activeToolType, brushSize, activeColor, opacity, pipetteMode } =
          useToolStore.getState();

        const { zoom, panX, panY } = useViewportStore.getState();
        const earlyPixel = pixelAtScreen(e.offsetX, e.offsetY, panX, panY, zoom);

        // Palette pipette mode: sample the composite at the clicked pixel and
        // append it to the active palette. Short-circuits the active tool
        // (FR-010). The texture must be open, but we do NOT require an
        // active layer since we sample the composite.
        if (usePaletteStore.getState().pipetteActive) {
          const { texture } = useEditorStore.getState();
          if (!texture) return;
          if (!isInBounds(earlyPixel.x, earlyPixel.y, texture.width, texture.height))
            return;
          e.preventDefault();
          sampleCompositeAndAppend(earlyPixel.x, earlyPixel.y).catch((err) =>
            console.error("[palette-pipette] failed:", err),
          );
          return;
        }

        // Non-drawing tools: no canvas action
        if (NON_DRAWING_TOOLS.has(activeToolType)) return;

        const pixel = earlyPixel;
        const { texture, activeLayerId } = useEditorStore.getState();
        if (!texture || !activeLayerId) return;
        if (!isInBounds(pixel.x, pixel.y, texture.width, texture.height)) return;

        // Shift+Click straight line
        if (
          e.shiftKey &&
          lastStrokeEndPointRef.current &&
          SHIFT_CLICK_TOOLS.has(activeToolType)
        ) {
          const lastPt = lastStrokeEndPointRef.current;
          interactionModeRef.current = "tool";
          canvas.setPointerCapture(e.pointerId);
          const op = opacity / 100;

          toolPress(
            activeToolType,
            activeLayerId,
            lastPt.x,
            lastPt.y,
            activeColor,
            brushSize,
            op,
            pipetteMode,
          )
            .then((result) => {
              handleToolResult(result);
              return toolDrag(
                activeLayerId,
                pixel.x,
                pixel.y,
                activeColor,
                brushSize,
                op,
              );
            })
            .then((result) => {
              handleToolResult(result);
              return toolRelease(
                activeLayerId,
                pixel.x,
                pixel.y,
                activeColor,
                brushSize,
                op,
              );
            })
            .then((result) => {
              handleToolResult(result);
              lastStrokeEndPointRef.current = pixel;
            })
            .catch((err) => {
              console.error("[useViewportControls] Shift+Click failed:", err);
              // Ensure stroke is finalized even on partial failure
              toolRelease(
                activeLayerId,
                pixel.x,
                pixel.y,
                activeColor,
                brushSize,
                op,
              ).catch(() => {});
            })
            .finally(() => {
              interactionModeRef.current = "idle";
              canvas.releasePointerCapture(e.pointerId);
            });
          return;
        }

        // Normal tool press
        interactionModeRef.current = "tool";
        canvas.setPointerCapture(e.pointerId);

        // Line tool preview: set start point
        if (activeToolType === "line") {
          renderer.linePreviewRef.current = { startX: pixel.x, startY: pixel.y };
        }

        toolPress(
          activeToolType,
          activeLayerId,
          pixel.x,
          pixel.y,
          activeColor,
          brushSize,
          opacity / 100,
          pipetteMode,
        )
          .then((result) => handleToolResult(result))
          .catch((err) => console.error("[useViewportControls] toolPress failed:", err));
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const { zoom, panX, panY } = useViewportStore.getState();
      const texture = useEditorStore.getState().texture;

      // Update cursor position for brush preview and status bar
      if (texture) {
        const pixel = pixelAtScreen(e.offsetX, e.offsetY, panX, panY, zoom);
        const isPanning = interactionModeRef.current === "pan";
        const { activeToolType, brushSize } = useToolStore.getState();

        if (isInBounds(pixel.x, pixel.y, texture.width, texture.height) && !isPanning) {
          lastCursorPixelRef.current = pixel;
          renderer.cursorPixelRef.current = pixel;
          notifyCursorListeners(pixel);
        } else {
          renderer.cursorPixelRef.current = null;
          notifyCursorListeners(null);
        }
        renderer.brushSizeRef.current = brushSize;
        renderer.brushPreviewSizeRef.current = isPanning
          ? 0
          : brushPreviewSize(activeToolType, brushSize);
        renderer.requestRedraw();
      }

      if (interactionModeRef.current === "pan") {
        const dx = e.clientX - panStartRef.current.screenX;
        const dy = e.clientY - panStartRef.current.screenY;
        const newPanX = panStartRef.current.panX + dx;
        const newPanY = panStartRef.current.panY + dy;

        useViewportStore.getState().setPan(newPanX, newPanY);
        renderer.requestRedraw();
        return;
      }

      if (interactionModeRef.current === "tool") {
        const pixel = pixelAtScreen(e.offsetX, e.offsetY, panX, panY, zoom);
        pendingDragRef.current = pixel;
        processDrag();
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
        // Clear line preview and pending drag state
        renderer.linePreviewRef.current = null;
        pendingDragRef.current = null;

        interactionModeRef.current = "idle";
        canvas.releasePointerCapture(e.pointerId);

        const { zoom, panX, panY } = useViewportStore.getState();
        const raw = pixelAtScreen(e.offsetX, e.offsetY, panX, panY, zoom);
        const { texture, activeLayerId } = useEditorStore.getState();
        if (!texture || !activeLayerId) return;

        // Clamp to texture bounds so toolRelease always fires (finalizes undo snapshot)
        const pixel = {
          x: Math.max(0, Math.min(texture.width - 1, raw.x)),
          y: Math.max(0, Math.min(texture.height - 1, raw.y)),
        };

        const { brushSize, activeColor, opacity } = useToolStore.getState();
        toolRelease(
          activeLayerId,
          pixel.x,
          pixel.y,
          activeColor,
          brushSize,
          opacity / 100,
        )
          .then((result) => {
            handleToolResult(result);
            lastStrokeEndPointRef.current = pixel;
          })
          .catch((err) =>
            console.error("[useViewportControls] toolRelease failed:", err),
          );
      }
    };

    const onPointerLeave = () => {
      renderer.cursorPixelRef.current = null;
      renderer.brushPreviewSizeRef.current = 0;
      notifyCursorListeners(null);
      renderer.requestRedraw();
    };

    const handleToolResult = (result: ToolResultDto) => {
      if (result.resultType === "pixels_modified" && result.composite) {
        const data = new Uint8ClampedArray(result.composite.data);
        renderer.updateComposite(data, result.composite.width, result.composite.height);
      } else if (result.resultType === "color_picked" && result.pickedColor) {
        useToolStore.getState().setActiveColor(result.pickedColor);
      }
    };
    handleToolResultRef.current = handleToolResult;

    // Set initial cursor
    updateCursor();

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);

    const unsubToolStore = useToolStore.subscribe(() => updateCursor());

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      unsubToolStore();
    };
  }, [canvasRef, renderer]);

  // Mid-stroke finalization: exposed for toolbar click and keyboard shortcuts
  const finalizeStroke = () => {
    if (interactionModeRef.current !== "tool") return;

    // Clear line preview
    renderer.linePreviewRef.current = null;

    const pixel = lastCursorPixelRef.current;
    if (!pixel) return;

    const { texture, activeLayerId } = useEditorStore.getState();
    if (!texture || !activeLayerId) return;

    const { brushSize, activeColor, opacity } = useToolStore.getState();
    interactionModeRef.current = "idle";

    toolRelease(activeLayerId, pixel.x, pixel.y, activeColor, brushSize, opacity / 100)
      .then((result) => {
        handleToolResultRef.current(result);
        lastStrokeEndPointRef.current = pixel;
      })
      .catch((err) => console.error("[useViewportControls] finalizeStroke failed:", err));
  };

  return {
    interactionModeRef,
    cursorPixelRef: renderer.cursorPixelRef,
    lastCursorPixelRef,
    finalizeStroke,
  };
}
