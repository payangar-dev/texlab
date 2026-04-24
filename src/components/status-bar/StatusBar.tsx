import { useEffect, useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import { useViewportStore } from "../../store/viewportStore";
import { colors, fontSizes, fonts, sizing, spacing } from "../../styles/theme";
import { subscribeToCursor } from "../canvas/CanvasViewport";

const monoStyle: React.CSSProperties = {
  fontFamily: fonts.mono,
  fontSize: fontSizes.sm,
  color: colors.textSecondary,
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
        height: sizing.tabBarHeight,
        minHeight: sizing.tabBarHeight,
        background: colors.statusBar,
        display: "flex",
        alignItems: "center",
        gap: spacing["3xl"],
        padding: `0 ${spacing.xl}px`,
      }}
    >
      <span style={monoStyle}>
        {cursor ? `X: ${cursor.x}  Y: ${cursor.y}` : "\u00A0"}
      </span>
      <span style={monoStyle}>
        {texture ? `${texture.width} \u00D7 ${texture.height}` : "\u00A0"}
      </span>
      <span style={monoStyle}>{`${Math.round(zoom * 100)}%`}</span>
      <span style={{ flex: 1 }} />
    </div>
  );
}
