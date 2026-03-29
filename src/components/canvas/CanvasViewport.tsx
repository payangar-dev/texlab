import { useRef, useEffect, useCallback, memo } from "react";
import { useEditorStore } from "../../store/editorStore";
import { useViewportStore } from "../../store/viewportStore";
import { useResizeObserver } from "../../hooks/useResizeObserver";
import { useCanvasRenderer } from "./useCanvasRenderer";
import { useViewportControls } from "./useViewportControls";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { getComposite } from "../../api/commands";
import { listen } from "@tauri-apps/api/event";

/** Callback subscribers for cursor pixel updates (used by StatusBar). */
export type CursorListener = (pixel: { x: number; y: number } | null) => void;

let cursorListeners = new Set<CursorListener>();

export function subscribeToCursor(listener: CursorListener): () => void {
  cursorListeners.add(listener);
  return () => cursorListeners.delete(listener);
}

export function notifyCursorListeners(
  pixel: { x: number; y: number } | null,
): void {
  for (const listener of cursorListeners) {
    listener(pixel);
  }
}

const CanvasViewport = memo(function CanvasViewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const texture = useEditorStore((s) => s.texture);

  useResizeObserver(containerRef);
  const renderer = useCanvasRenderer(canvasRef);
  const { updateComposite, requestRedraw } = renderer;
  const { spaceHeldRef } = useViewportControls(canvasRef, renderer);
  useKeyboardShortcuts(spaceHeldRef, requestRedraw);

  // Reset cursor listeners on mount/unmount to avoid stale singleton refs
  useEffect(() => {
    cursorListeners = new Set();
    return () => {
      cursorListeners = new Set();
    };
  }, []);

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

  // Fit to viewport on initial texture load
  useEffect(() => {
    if (!texture) return;
    const { containerWidth, containerHeight } = useViewportStore.getState();
    if (containerWidth > 0 && containerHeight > 0) {
      useViewportStore.getState().fitToViewport(texture.width, texture.height);
      requestRedraw();
    }
  }, [texture, requestRedraw]);

  // Empty state
  if (!texture) {
    return (
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
    );
  }

  return (
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
  );
});

export default CanvasViewport;
