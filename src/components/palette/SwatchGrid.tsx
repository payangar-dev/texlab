import { useEffect, useRef } from "react";
import { useToolStore } from "../../store/toolStore";
import { colors, fontSizes } from "../../styles/theme";
import { colorDtoToHex, hexToColorDto } from "../../utils/colorHex";

interface SwatchGridProps {
  colors: string[];
  /** Index of the swatch to briefly pulse. */
  pulseIndex?: number | null;
  /** Increment to re-trigger the pulse on the same index. */
  pulseToken?: number;
}

const PULSE_DURATION_MS = 400;

export function SwatchGrid({
  colors: swatches,
  pulseIndex,
  pulseToken,
}: SwatchGridProps) {
  const activeColor = useToolStore((s) => s.activeColor);
  const secondaryColor = useToolStore((s) => s.secondaryColor);

  const primaryHex = colorDtoToHex(activeColor);
  const secondaryHex = colorDtoToHex(secondaryColor);

  const pulseRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (pulseIndex == null) return;
    const el = pulseRefs.current.get(pulseIndex);
    if (!el) return;
    el.classList.remove("texlab-swatch-pulse");
    // Force reflow so re-adding the class restarts the animation.
    void el.offsetWidth;
    el.classList.add("texlab-swatch-pulse");
    const timer = window.setTimeout(() => {
      el.classList.remove("texlab-swatch-pulse");
    }, PULSE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [pulseIndex, pulseToken]);

  if (swatches.length === 0) {
    return <div style={emptyStyle}>This palette has no swatches.</div>;
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>, hex: string) => {
    const store = useToolStore.getState();
    const color = hexToColorDto(hex);
    if (e.button === 0) {
      store.setActiveSlot("primary");
      store.setActiveColor(color);
    } else if (e.button === 2) {
      store.setSecondaryColor(color);
    }
  };

  return (
    <div
      style={gridStyle}
      onContextMenu={(e) => e.preventDefault()}
      role="listbox"
      aria-label="Palette swatches"
    >
      {swatches.map((hex, index) => {
        const upper = hex.toUpperCase();
        const isPrimary = upper === primaryHex;
        const isSecondary = upper === secondaryHex;
        return (
          <button
            key={upper}
            type="button"
            ref={(el) => {
              if (el) pulseRefs.current.set(index, el);
              else pulseRefs.current.delete(index);
            }}
            data-index={index}
            data-hex={upper}
            aria-label={`Swatch ${upper}`}
            onMouseDown={(e) => handleMouseDown(e, upper)}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              ...swatchStyle,
              background: upper,
              boxShadow: buildShadow(isPrimary, isSecondary),
            }}
          />
        );
      })}
    </div>
  );
}

function buildShadow(isPrimary: boolean, isSecondary: boolean): string {
  const rings: string[] = [];
  if (isPrimary) rings.push(`0 0 0 2px ${colors.accent}`);
  if (isSecondary) rings.push(`0 0 0 2px #FFFFFF`);
  rings.push("inset 0 0 0 1px rgba(0,0,0,0.35)");
  return rings.join(", ");
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(16px, 1fr))",
  gap: 3,
  overflowY: "auto",
  flex: 1,
  alignContent: "start",
};

const swatchStyle: React.CSSProperties = {
  width: "100%",
  aspectRatio: "1 / 1",
  border: "none",
  borderRadius: 2,
  padding: 0,
  cursor: "pointer",
};

const emptyStyle: React.CSSProperties = {
  padding: 12,
  color: colors.textMuted,
  fontSize: fontSizes.sm,
  textAlign: "center",
};

// Inject pulse keyframes once — keeps the component self-contained without
// requiring a stylesheet edit.
if (typeof document !== "undefined") {
  const id = "texlab-swatch-pulse-kf";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes texlabSwatchPulse {
        0%   { transform: scale(1);   filter: brightness(1); }
        40%  { transform: scale(1.2); filter: brightness(1.4); }
        100% { transform: scale(1);   filter: brightness(1); }
      }
      .texlab-swatch-pulse { animation: texlabSwatchPulse ${PULSE_DURATION_MS}ms ease-out; }
    `;
    document.head.appendChild(style);
  }
}
