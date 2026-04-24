import type { IDockviewPanelHeaderProps } from "dockview";
import { GripHorizontal } from "lucide-react";
import {
  colors,
  fontSizes,
  fonts,
  fontWeights,
  iconSizes,
  sizing,
  spacing,
} from "../../styles/theme";

export function PanelHeader({ api }: IDockviewPanelHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.md,
        width: "100%",
        height: sizing.tabBarHeight,
        padding: `0 ${spacing.lg}px`,
        background: colors.panelHeader,
        userSelect: "none",
        cursor: "grab",
      }}
    >
      <GripHorizontal size={iconSizes.sm} color={colors.iconDefault} />
      <span
        style={{
          fontFamily: fonts.ui,
          fontSize: fontSizes.sm,
          fontWeight: fontWeights.semibold,
          color: colors.textTitle,
          lineHeight: `${sizing.tabBarHeight}px`,
        }}
      >
        {api.title}
      </span>
    </div>
  );
}
