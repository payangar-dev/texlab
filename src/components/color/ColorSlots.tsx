import { ArrowLeftRight } from "lucide-react";
import { useToolStore } from "../../store/toolStore";
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
          border: activeSlot === "primary" ? "1.5px solid #4A9FD8" : "1px solid #444444",
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
        <ArrowLeftRight size={10} />
      </button>
      <button
        type="button"
        onClick={() => setActiveSlot("secondary")}
        style={{
          ...slotStyle,
          backgroundColor: rgbToHex(secondaryColor.r, secondaryColor.g, secondaryColor.b),
          border:
            activeSlot === "secondary" ? "1.5px solid #4A9FD8" : "1px solid #444444",
        }}
        title="Secondary color"
      />
      <style>{swapHoverCss}</style>
    </>
  );
}

const slotStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 3,
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
  color: "#666666",
};

const swapHoverCss = `
  .color-swap-btn:hover { color: #CCCCCC !important; }
`;
