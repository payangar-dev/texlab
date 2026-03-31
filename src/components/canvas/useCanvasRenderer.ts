import { useCallback, useEffect, useRef } from "react";
import { useViewportStore } from "../../store/viewportStore";
import { CHECKERBOARD_COLOR_A, CHECKERBOARD_COLOR_B, GRID_THRESHOLD } from "./constants";
import { bresenhamLine, gridOpacity } from "./math";

export interface CanvasRendererApi {
  updateComposite: (data: Uint8ClampedArray, width: number, height: number) => void;
  requestRedraw: () => void;
  /** Ref to current cursor pixel for overlay drawing. Set by useViewportControls. */
  cursorPixelRef: React.RefObject<{ x: number; y: number } | null>;
  /** Ref to current brush size for overlay drawing. */
  brushSizeRef: React.RefObject<number>;
  /** Ref to line tool preview start point. Set on line tool press, cleared on release. */
  linePreviewRef: React.RefObject<{ startX: number; startY: number } | null>;
  /** Ref to brush preview size override (e.g., 1 for fill/eyedropper). 0 = no preview. */
  brushPreviewSizeRef: React.RefObject<number>;
}

export function useCanvasRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
): CanvasRendererApi {
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const patternRef = useRef<CanvasPattern | null>(null);
  const dirtyRef = useRef(true);
  const animFrameRef = useRef(0);
  const textureSizeRef = useRef({ width: 0, height: 0 });
  const cursorPixelRef = useRef<{ x: number; y: number } | null>(null);
  const brushSizeRef = useRef(1);
  const linePreviewRef = useRef<{ startX: number; startY: number } | null>(null);
  const brushPreviewSizeRef = useRef(1);

  // Create checkerboard pattern once
  const getCheckerboardPattern = useCallback(
    (ctx: CanvasRenderingContext2D): CanvasPattern | null => {
      if (patternRef.current) return patternRef.current;
      const patternCanvas = document.createElement("canvas");
      patternCanvas.width = 2;
      patternCanvas.height = 2;
      const pCtx = patternCanvas.getContext("2d");
      if (!pCtx) return null;
      pCtx.fillStyle = CHECKERBOARD_COLOR_A;
      pCtx.fillRect(0, 0, 2, 2);
      pCtx.fillStyle = CHECKERBOARD_COLOR_B;
      pCtx.fillRect(1, 0, 1, 1);
      pCtx.fillRect(0, 1, 1, 1);
      patternRef.current = ctx.createPattern(patternCanvas, "repeat");
      return patternRef.current;
    },
    [],
  );

  const updateComposite = useCallback(
    (data: Uint8ClampedArray, width: number, height: number) => {
      if (!offscreenRef.current) {
        offscreenRef.current = document.createElement("canvas");
      }
      const oc = offscreenRef.current;
      if (oc.width !== width || oc.height !== height) {
        oc.width = width;
        oc.height = height;
        offscreenCtxRef.current = oc.getContext("2d", {
          willReadFrequently: true,
        });
      }
      const ctx = offscreenCtxRef.current;
      if (!ctx) return;
      const imageData = new ImageData(data, width, height);
      ctx.putImageData(imageData, 0, 0);
      textureSizeRef.current = { width, height };
      dirtyRef.current = true;
    },
    [],
  );

  const requestRedraw = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  // Render loop
  useEffect(() => {
    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);

      if (!dirtyRef.current) return;
      dirtyRef.current = false;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const { zoom, panX, panY, containerWidth, containerHeight } =
        useViewportStore.getState();

      // Resize canvas backing store if needed
      const backingW = Math.round(containerWidth * dpr);
      const backingH = Math.round(containerHeight * dpr);
      if (canvas.width !== backingW || canvas.height !== backingH) {
        canvas.width = backingW;
        canvas.height = backingH;
        canvas.style.width = `${containerWidth}px`;
        canvas.style.height = `${containerHeight}px`;
        // imageSmoothingEnabled resets on resize
        ctx.imageSmoothingEnabled = false;
      }

      const offscreen = offscreenRef.current;
      const { width: texW, height: texH } = textureSizeRef.current;

      // Clear
      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!offscreen || texW === 0 || texH === 0) return;

      // Set transform: zoom + pan, scaled by DPR
      ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, panX * dpr, panY * dpr);

      // Draw checkerboard in texture space
      const pattern = getCheckerboardPattern(ctx);
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, texW, texH);
      }

      // Draw texture
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offscreen, 0, 0);

      // Pixel grid overlay
      if (zoom >= GRID_THRESHOLD) {
        const alpha = gridOpacity(zoom);
        ctx.resetTransform();

        // Compute visible texture area in screen space
        const startX = Math.max(0, panX) * dpr;
        const startY = Math.max(0, panY) * dpr;
        const endX = Math.min(containerWidth, panX + texW * zoom) * dpr;
        const endY = Math.min(containerHeight, panY + texH * zoom) * dpr;

        // Compute which texture pixels are visible
        const firstCol = Math.max(0, Math.floor(-panX / zoom));
        const lastCol = Math.min(texW, Math.ceil((containerWidth - panX) / zoom));
        const firstRow = Math.max(0, Math.floor(-panY / zoom));
        const lastRow = Math.min(texH, Math.ceil((containerHeight - panY) / zoom));

        ctx.strokeStyle = `rgba(128,128,128,${alpha})`;
        ctx.lineWidth = 1;

        ctx.beginPath();
        // Vertical lines
        for (let col = firstCol; col <= lastCol; col++) {
          const x = Math.round((panX + col * zoom) * dpr) + 0.5;
          ctx.moveTo(x, startY);
          ctx.lineTo(x, endY);
        }
        // Horizontal lines
        for (let row = firstRow; row <= lastRow; row++) {
          const y = Math.round((panY + row * zoom) * dpr) + 0.5;
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
        }
        ctx.stroke();
      }

      // Brush preview overlay (pixel-snapped rectangle showing affected area)
      const cursor = cursorPixelRef.current;
      const previewSize = brushPreviewSizeRef.current;

      if (cursor && previewSize > 0) {
        ctx.resetTransform();
        const rx = Math.round((panX + (cursor.x + 0.5 - previewSize / 2) * zoom) * dpr);
        const ry = Math.round((panY + (cursor.y + 0.5 - previewSize / 2) * zoom) * dpr);
        const rw = Math.round(previewSize * zoom * dpr);
        const rh = Math.round(previewSize * zoom * dpr);

        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
      }

      // Line tool preview overlay
      if (cursor) {
        const lineStart = linePreviewRef.current;
        if (lineStart) {
          const brushSize = brushSizeRef.current;
          const halfF = brushSize / 2;
          const points = bresenhamLine(
            lineStart.startX,
            lineStart.startY,
            cursor.x,
            cursor.y,
          );

          ctx.resetTransform();
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";

          for (const pt of points) {
            const lx = Math.round((panX + (pt.x + 0.5 - halfF) * zoom) * dpr);
            const ly = Math.round((panY + (pt.y + 0.5 - halfF) * zoom) * dpr);
            const lw = Math.round(brushSize * zoom * dpr);
            const lh = Math.round(brushSize * zoom * dpr);
            ctx.fillRect(lx, ly, lw, lh);
          }
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [canvasRef, getCheckerboardPattern]);

  // Subscribe to viewport store changes (transient pattern)
  useEffect(() => {
    const unsub = useViewportStore.subscribe(() => {
      dirtyRef.current = true;
    });
    return unsub;
  }, []);

  return {
    updateComposite,
    requestRedraw,
    cursorPixelRef,
    brushSizeRef,
    linePreviewRef,
    brushPreviewSizeRef,
  };
}
