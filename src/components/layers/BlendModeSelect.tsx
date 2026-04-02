import { ChevronDown } from "lucide-react";
import type { BlendMode } from "../../api/commands";
import { colors, fontSizes, fonts } from "../../styles/theme";

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
];

const VALID_BLEND_MODES = new Set<string>(BLEND_MODES.map((m) => m.value));

function isBlendMode(value: string): value is BlendMode {
  return VALID_BLEND_MODES.has(value);
}

interface BlendModeSelectProps {
  value: BlendMode;
  onChange: (mode: BlendMode) => void;
}

export function BlendModeSelect({ value, onChange }: BlendModeSelectProps) {
  return (
    <div style={containerStyle}>
      <span style={labelStyle}>Blend</span>
      <div style={selectWrapperStyle}>
        <select
          style={selectStyle}
          value={value}
          onChange={(e) => {
            if (isBlendMode(e.target.value)) onChange(e.target.value);
          }}
        >
          {BLEND_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
        <ChevronDown size={10} color={colors.textSecondary} style={chevronStyle} />
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  height: 28,
  padding: "0 8px",
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  color: colors.textSecondary,
  fontFamily: fonts.ui,
  fontSize: 9,
  fontWeight: 600,
  userSelect: "none",
  flexShrink: 0,
};

const selectWrapperStyle: React.CSSProperties = {
  position: "relative",
  flex: 1,
  minWidth: 0,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  height: 22,
  background: colors.inputField,
  color: colors.textTitle,
  fontFamily: fonts.ui,
  fontSize: fontSizes.xs,
  border: "none",
  borderRadius: 4,
  padding: "0 20px 0 6px",
  cursor: "pointer",
  appearance: "none",
  outline: "none",
};

const chevronStyle: React.CSSProperties = {
  position: "absolute",
  right: 6,
  top: "50%",
  transform: "translateY(-50%)",
  pointerEvents: "none",
};
