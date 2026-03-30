import {
  Eraser,
  Minus,
  PaintBucket,
  Paintbrush,
  Pipette,
  Redo2,
  SquareDashed,
  Undo2,
} from "lucide-react";
import { useCallback } from "react";
import { redo, undo } from "../../api/commands";
import { useEditorStore } from "../../store/editorStore";
import { type ToolType, useToolStore } from "../../store/toolStore";
import { colors } from "../../styles/theme";

const TOOLS: { type: ToolType; icon: React.ElementType }[] = [
  { type: "brush", icon: Paintbrush },
  { type: "eraser", icon: Eraser },
  { type: "fill", icon: PaintBucket },
  { type: "eyedropper", icon: Pipette },
  { type: "line", icon: Minus },
  { type: "rectangle", icon: SquareDashed },
];

export function ToolsSidebar() {
  const activeToolType = useToolStore((s) => s.activeToolType);
  const setActiveToolType = useToolStore((s) => s.setActiveToolType);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);

  const handleUndo = useCallback(async () => {
    try {
      await undo();
    } catch {
      useEditorStore.getState().refreshState();
    }
  }, []);

  const handleRedo = useCallback(async () => {
    try {
      await redo();
    } catch {
      useEditorStore.getState().refreshState();
    }
  }, []);

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
      {TOOLS.map(({ type, icon: Icon }) => (
        <ToolButton
          key={type}
          active={activeToolType === type}
          onClick={() => setActiveToolType(type)}
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

      <ToolButton onClick={handleUndo} disabled={!canUndo}>
        <Undo2 size={18} />
      </ToolButton>
      <ToolButton onClick={handleRedo} disabled={!canRedo}>
        <Redo2 size={18} />
      </ToolButton>
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
