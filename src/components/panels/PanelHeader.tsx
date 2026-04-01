import type { IDockviewPanelHeaderProps } from "dockview";
import { GripHorizontal } from "lucide-react";
import { colors, fontSizes, fonts } from "../../styles/theme";

export function PanelHeader({ api }: IDockviewPanelHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        height: 28,
        padding: "0 8px",
        background: colors.panelHeader,
        userSelect: "none",
        cursor: "grab",
      }}
    >
      <GripHorizontal size={12} color={colors.iconDefault} />
      <span
        style={{
          fontFamily: fonts.ui,
          fontSize: fontSizes.sm,
          fontWeight: 600,
          color: colors.textTitle,
          lineHeight: "28px",
        }}
      >
        {api.title}
      </span>
    </div>
  );
}
