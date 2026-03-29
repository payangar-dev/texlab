import { useState, useEffect } from "react";
import { useViewportStore } from "../../store/viewportStore";
import { useEditorStore } from "../../store/editorStore";
import { subscribeToCursor } from "../canvas/CanvasViewport";

const monoStyle: React.CSSProperties = {
  fontFamily: "'Geist Mono', monospace",
  fontSize: 10,
  color: "#888888",
  whiteSpace: "nowrap",
};

export default function StatusBar() {
  const zoom = useViewportStore((s) => s.zoom);
  const texture = useEditorStore((s) => s.texture);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return subscribeToCursor(setCursor);
  }, []);

  return (
    <div
      style={{
        height: 28,
        minHeight: 28,
        background: "#161616",
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "0 12px",
      }}
    >
      <span style={monoStyle}>
        {cursor ? `X: ${cursor.x}  Y: ${cursor.y}` : "\u00A0"}
      </span>
      <span style={monoStyle}>
        {texture ? `${texture.width} \u00D7 ${texture.height}` : "\u00A0"}
      </span>
      <span style={monoStyle}>
        {`${Math.round(zoom * 100)}%`}
      </span>
      <span style={{ flex: 1 }} />
    </div>
  );
}
