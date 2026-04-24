import { useCallback, useEffect, useRef, useState } from "react";
import type { ColorDto } from "../../api/commands";
import { colors, radii, sizing } from "../../styles/theme";
import { colorToGradientPos, HSV_HUE_STOPS } from "../../utils/color";

const CURSOR_OFFSET = sizing.hsvCursor / 2;

interface HsvGradientProps {
  color: ColorDto;
  onChange: (color: ColorDto) => void;
}

export function HsvGradient({ color, onChange }: HsvGradientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const drawGradient = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;

    // Layer 1: Horizontal hue spectrum
    const hueGrad = ctx.createLinearGradient(0, 0, width, 0);
    for (const stop of HSV_HUE_STOPS) {
      hueGrad.addColorStop(stop.offset, stop.color);
    }
    ctx.fillStyle = hueGrad;
    ctx.fillRect(0, 0, width, height);

    // Layer 2: White-to-transparent overlay (left=white, right=transparent)
    const whiteGrad = ctx.createLinearGradient(0, 0, width, 0);
    whiteGrad.addColorStop(0, "rgba(255, 255, 255, 1)");
    whiteGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, width, height);

    // Layer 3: Transparent-to-black overlay (top=transparent, bottom=black)
    const blackGrad = ctx.createLinearGradient(0, 0, 0, height);
    blackGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
    blackGrad.addColorStop(1, "rgba(0, 0, 0, 1)");
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, width, height);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const observer = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w === 0 || h === 0) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        drawGradient();
        setCanvasSize({ width: w, height: h });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [drawGradient]);

  const pickColor = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas || canvas.width === 0 || canvas.height === 0) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(canvas.width - 1, Math.round(clientX - rect.left)));
      const y = Math.max(0, Math.min(canvas.height - 1, Math.round(clientY - rect.top)));

      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      onChange({ r, g, b, a: 255 });
    },
    [onChange],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      pickColor(e.clientX, e.clientY);
    },
    [pickColor],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      pickColor(e.clientX, e.clientY);
    },
    [pickColor],
  );

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const cursorPos =
    canvasSize.width > 0 && canvasSize.height > 0
      ? colorToGradientPos(color, canvasSize.width, canvasSize.height)
      : null;

  return (
    <div ref={containerRef} style={containerStyle}>
      <canvas
        ref={canvasRef}
        style={canvasStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      {cursorPos && (
        <div
          style={{
            ...cursorStyle,
            left: cursorPos.x - CURSOR_OFFSET,
            top: cursorPos.y - CURSOR_OFFSET,
          }}
        />
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  flex: 1,
  minHeight: 0,
  borderRadius: radii.lg,
  overflow: "hidden",
};

const canvasStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  cursor: "crosshair",
};

const cursorStyle: React.CSSProperties = {
  position: "absolute",
  width: sizing.hsvCursor,
  height: sizing.hsvCursor,
  borderRadius: "50%",
  border: `${sizing.selectionRing}px solid ${colors.white}`,
  pointerEvents: "none",
  boxSizing: "border-box",
};
