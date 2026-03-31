import { listen } from "@tauri-apps/api/event";
import { memo, useCallback, useEffect, useRef } from "react";
import { getComposite } from "../../api/commands";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useResizeObserver } from "../../hooks/useResizeObserver";
import { useEditorStore } from "../../store/editorStore";
import { useViewportStore } from "../../store/viewportStore";
import { ToolOptionsBar } from "../shell/ToolOptionsBar";
import { useCanvasRenderer } from "./useCanvasRenderer";
import { useViewportControls } from "./useViewportControls";

/** Callback subscribers for cursor pixel updates (used by StatusBar). */
export type CursorListener = (pixel: { x: number; y: number } | null) => void;

const cursorListeners = new Set<CursorListener>();

/** Module-level ref for mid-stroke finalization (used by ToolsSidebar and keyboard shortcuts). */
let finalizeStrokeCallback: (() => void) | null = null;

export function setFinalizeStrokeCallback(cb: (() => void) | null): void {
  finalizeStrokeCallback = cb;
}

export function finalizeActiveStroke(): void {
  finalizeStrokeCallback?.();
}

export function subscribeToCursor(listener: CursorListener): () => void {
  cursorListeners.add(listener);
  return () => cursorListeners.delete(listener);
}

export function notifyCursorListeners(pixel: { x: number; y: number } | null): void {
  for (const listener of cursorListeners) {
    listener(pixel);
  }
}

const CanvasViewport = memo(function CanvasViewport(_props?: Record<string, unknown>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const texture = useEditorStore((s) => s.texture);

  useResizeObserver(containerRef);
  const renderer = useCanvasRenderer(canvasRef);
  const { updateComposite, requestRedraw } = renderer;
  const { spaceHeldRef, finalizeStroke } = useViewportControls(canvasRef, renderer);
  useKeyboardShortcuts(spaceHeldRef, requestRedraw);

  // Register finalizeStroke for external callers
  useEffect(() => {
    setFinalizeStrokeCallback(finalizeStroke);
    return () => setFinalizeStrokeCallback(null);
  }, [finalizeStroke]);

  const fetchAndApplyComposite = useCallback(async () => {
    try {
      const dto = await getComposite();
      const data = new Uint8ClampedArray(dto.data);
      updateComposite(data, dto.width, dto.height);
    } catch (err) {
      console.error("[CanvasViewport] getComposite failed:", err);
    }
  }, [updateComposite]);

  // Fetch composite when texture loads/changes
  useEffect(() => {
    if (!texture) return;
    fetchAndApplyComposite();
  }, [texture, fetchAndApplyComposite]);

  // Listen to state-changed events to re-fetch composite
  useEffect(() => {
    if (!texture) return;

    const unlisten = listen("state-changed", fetchAndApplyComposite);

    return () => {
      unlisten.then((fn) => fn()).catch(() => {});
    };
  }, [texture, fetchAndApplyComposite]);

  // Fit to viewport on initial texture load (only when going from null → loaded)
  const prevTextureRef = useRef<boolean>(false);
  useEffect(() => {
    const hasTexture = texture !== null;
    if (hasTexture && !prevTextureRef.current) {
      const { containerWidth, containerHeight } = useViewportStore.getState();
      if (containerWidth > 0 && containerHeight > 0) {
        useViewportStore.getState().fitToViewport(texture.width, texture.height);
        requestRedraw();
      }
    }
    prevTextureRef.current = hasTexture;
  }, [texture, requestRedraw]);

  // Empty state
  if (!texture) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <ToolOptionsBar />
        <div
          ref={containerRef}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#2D2D2D",
            overflow: "hidden",
          }}
        >
          <span style={{ color: "#666", fontSize: 14, userSelect: "none" }}>
            No texture loaded
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <ToolOptionsBar />
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          background: "#2D2D2D",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            imageRendering: "pixelated",
          }}
        />
      </div>
    </div>
  );
});

export default CanvasViewport;
