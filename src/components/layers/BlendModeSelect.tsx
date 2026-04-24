import { ChevronDown } from "lucide-react";
import type { BlendMode } from "../../api/commands";
import {
  colors,
  fontSizes,
  fonts,
  fontWeights,
  iconSizes,
  radii,
  sizing,
  spacing,
} from "../../styles/theme";

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
        <ChevronDown
          size={iconSizes.sm}
          color={colors.textSecondary}
          style={chevronStyle}
        />
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing.md,
  height: sizing.tabBarHeight,
  padding: `0 ${spacing.lg}px`,
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  color: colors.textSecondary,
  fontFamily: fonts.ui,
  fontSize: fontSizes.xs,
  fontWeight: fontWeights.semibold,
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
  height: sizing.input.sm,
  background: colors.inputField,
  color: colors.textTitle,
  fontFamily: fonts.ui,
  fontSize: fontSizes.xs,
  border: "none",
  borderRadius: radii.md,
  padding: `0 ${sizing.button.xs}px 0 ${spacing.md}px`,
  cursor: "pointer",
  appearance: "none",
  outline: "none",
};

const chevronStyle: React.CSSProperties = {
  position: "absolute",
  right: spacing.md,
  top: "50%",
  transform: "translateY(-50%)",
  pointerEvents: "none",
};
