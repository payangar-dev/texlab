import { listen } from "@tauri-apps/api/event";
import { memo, useCallback, useEffect, useRef } from "react";
import { getComposite } from "../../api/commands";
import { useResizeObserver } from "../../hooks/useResizeObserver";
import { useEditorStore } from "../../store/editorStore";
import { useViewportStore } from "../../store/viewportStore";
import { colors, fontSizes } from "../../styles/theme";
import { ToolOptionsBar } from "../shell/ToolOptionsBar";
import { useCanvasRenderer } from "./useCanvasRenderer";
import { useViewportControls } from "./useViewportControls";

/** Callback subscribers for cursor pixel updates (used by StatusBar). */
export type CursorListener = (pixel: { x: number; y: number } | null) => void;

const cursorListeners = new Set<CursorListener>();

/** Module-level ref for mid-stroke finalization (used by ToolsSidebar and command definitions). */
let finalizeStrokeCallback: (() => void) | null = null;

export function setFinalizeStrokeCallback(cb: (() => void) | null): void {
  finalizeStrokeCallback = cb;
}

export function finalizeActiveStroke(): void {
  finalizeStrokeCallback?.();
}

/** Module-level callback for canvas redraw (used by view commands). */
let redrawCallback: (() => void) | null = null;

export function setRedrawCallback(cb: (() => void) | null): void {
  redrawCallback = cb;
}

export function requestCanvasRedraw(): void {
  redrawCallback?.();
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
  const { finalizeStroke } = useViewportControls(canvasRef, renderer);

  // Register finalizeStroke for external callers
  useEffect(() => {
    setFinalizeStrokeCallback(finalizeStroke);
    return () => setFinalizeStrokeCallback(null);
  }, [finalizeStroke]);

  // Register redraw callback for external callers (view commands)
  useEffect(() => {
    setRedrawCallback(requestRedraw);
    return () => setRedrawCallback(null);
  }, [requestRedraw]);

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
            background: colors.canvasBackground,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              color: colors.textMuted,
              fontSize: fontSizes.lg,
              userSelect: "none",
            }}
          >
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
          background: colors.canvasBackground,
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
