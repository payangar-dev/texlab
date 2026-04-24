import {
  Eraser,
  Minus,
  Move,
  PaintBucket,
  Paintbrush,
  Pipette,
  SquareDashed,
  ZoomIn,
} from "lucide-react";
import { type ToolType, useToolStore } from "../../store/toolStore";
import { colors, iconSizes, radii, sizing, spacing } from "../../styles/theme";
import { finalizeActiveStroke } from "../canvas/CanvasViewport";

const DRAWING_TOOLS: { type: ToolType; icon: React.ElementType }[] = [
  { type: "brush", icon: Paintbrush },
  { type: "eraser", icon: Eraser },
  { type: "fill", icon: PaintBucket },
  { type: "eyedropper", icon: Pipette },
  { type: "line", icon: Minus },
  { type: "selection", icon: SquareDashed },
];

const NAV_TOOLS: { type: ToolType; icon: React.ElementType }[] = [
  { type: "move", icon: Move },
  { type: "zoom", icon: ZoomIn },
];

export function ToolsSidebar() {
  const activeToolType = useToolStore((s) => s.activeToolType);
  const setActiveToolType = useToolStore((s) => s.setActiveToolType);

  const handleToolClick = (type: ToolType) => {
    finalizeActiveStroke();
    setActiveToolType(type);
  };

  return (
    <div
      style={{
        width: sizing.toolSidebarWidth,
        minWidth: sizing.toolSidebarWidth,
        background: colors.panelBody,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: `${spacing.lg}px ${spacing.sm}px`,
        gap: spacing.sm,
      }}
    >
      {DRAWING_TOOLS.map(({ type, icon: Icon }) => (
        <ToolButton
          key={type}
          active={activeToolType === type}
          onClick={() => handleToolClick(type)}
        >
          <Icon size={iconSizes.lg} />
        </ToolButton>
      ))}

      <div
        style={{
          width: sizing.toolSeparatorWidth,
          height: sizing.hairline,
          background: colors.separator,
          margin: `${spacing.sm}px 0`,
        }}
      />

      {NAV_TOOLS.map(({ type, icon: Icon }) => (
        <ToolButton
          key={type}
          active={activeToolType === type}
          onClick={() => handleToolClick(type)}
        >
          <Icon size={iconSizes.lg} />
        </ToolButton>
      ))}
    </div>
  );
}

function ToolButton({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: sizing.button.xl,
        height: sizing.button.xl,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? colors.accent : colors.transparent,
        border: "none",
        borderRadius: radii.lg,
        color: active ? colors.white : colors.iconDefault,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.3 : 1,
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}
