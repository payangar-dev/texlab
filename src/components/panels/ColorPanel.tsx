import type { IDockviewPanelProps } from "dockview";
import { useToolStore } from "../../store/toolStore";
import { colors, spacing } from "../../styles/theme";
import { ColorSlots } from "../color/ColorSlots";
import { HexInput } from "../color/HexInput";
import { HsvGradient } from "../color/HsvGradient";

export function ColorPanel(_props: IDockviewPanelProps) {
  const activeSlot = useToolStore((s) => s.activeSlot);
  const activeColor = useToolStore((s) => s.activeColor);
  const secondaryColor = useToolStore((s) => s.secondaryColor);
  const setActiveColor = useToolStore((s) => s.setActiveColor);

  const editingColor = activeSlot === "primary" ? activeColor : secondaryColor;

  return (
    <div style={containerStyle}>
      <HsvGradient color={editingColor} onChange={setActiveColor} />
      <div style={colorInputRowStyle}>
        <ColorSlots />
        <HexInput color={editingColor} onChange={setActiveColor} />
      </div>
    </div>
  );
}

const colorInputRowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  width: "100%",
};

const containerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: colors.panelBody,
  padding: spacing.md,
  gap: spacing.md,
  boxSizing: "border-box",
};
