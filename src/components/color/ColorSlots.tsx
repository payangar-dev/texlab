import { ArrowLeftRight } from "lucide-react";
import { useToolStore } from "../../store/toolStore";
import { colors, iconSizes, radii, shadows, sizing } from "../../styles/theme";
import { rgbToHex } from "../../utils/color";

export function ColorSlots() {
  const activeColor = useToolStore((s) => s.activeColor);
  const secondaryColor = useToolStore((s) => s.secondaryColor);
  const activeSlot = useToolStore((s) => s.activeSlot);
  const setActiveSlot = useToolStore((s) => s.setActiveSlot);
  const swapColors = useToolStore((s) => s.swapColors);

  return (
    <>
      <button
        type="button"
        onClick={() => setActiveSlot("primary")}
        style={{
          ...slotStyle,
          backgroundColor: rgbToHex(activeColor.r, activeColor.g, activeColor.b),
          boxShadow: buildSlotShadow(activeSlot === "primary"),
        }}
        title="Primary color"
      />
      <button
        type="button"
        className="color-swap-btn"
        onClick={swapColors}
        style={swapButtonStyle}
        title="Swap colors (X)"
      >
        <ArrowLeftRight size={iconSizes.sm} />
      </button>
      <button
        type="button"
        onClick={() => setActiveSlot("secondary")}
        style={{
          ...slotStyle,
          backgroundColor: rgbToHex(secondaryColor.r, secondaryColor.g, secondaryColor.b),
          boxShadow: buildSlotShadow(activeSlot === "secondary"),
        }}
        title="Secondary color"
      />
      <style>{swapHoverCss}</style>
    </>
  );
}

/**
 * Selected rings match the palette swatch treatment: outer accent ring
 * on selection + inset hairline always visible so light colours still
 * show a boundary. ColorSlots live in a flex row inside ColorPanel
 * (padding = `spacing.md`, no overflow-clipping ancestor close by), so
 * the outer ring has room to render without the safe-zone hack that
 * SwatchGrid needs.
 */
function buildSlotShadow(selected: boolean): string {
  const parts: string[] = [];
  if (selected) parts.push(`0 0 0 ${sizing.selectionRing}px ${colors.accent}`);
  parts.push(shadows.swatchInsetBorder);
  return parts.join(", ");
}

const slotStyle: React.CSSProperties = {
  width: sizing.button.xs,
  height: sizing.button.xs,
  borderRadius: radii.sm,
  border: "none",
  padding: 0,
  cursor: "pointer",
  flexShrink: 0,
  boxSizing: "border-box",
  outline: "none",
};

const swapButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  flexShrink: 0,
  outline: "none",
  color: colors.textMuted,
};

const swapHoverCss = `
  .color-swap-btn:hover { color: ${colors.textTitle} !important; }
`;
