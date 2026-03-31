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
import { colors } from "../../styles/theme";
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
        width: 48,
        minWidth: 48,
        background: colors.panelBody,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 4px",
        gap: 4,
      }}
    >
      {DRAWING_TOOLS.map(({ type, icon: Icon }) => (
        <ToolButton
          key={type}
          active={activeToolType === type}
          onClick={() => handleToolClick(type)}
        >
          <Icon size={18} />
        </ToolButton>
      ))}

      <div
        style={{
          width: 28,
          height: 1,
          background: colors.separator,
          margin: "4px 0",
        }}
      />

      {NAV_TOOLS.map(({ type, icon: Icon }) => (
        <ToolButton
          key={type}
          active={activeToolType === type}
          onClick={() => handleToolClick(type)}
        >
          <Icon size={18} />
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
        width: 36,
        height: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? colors.accent : "transparent",
        border: "none",
        borderRadius: 6,
        color: active ? "#FFFFFF" : colors.iconDefault,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.3 : 1,
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}
