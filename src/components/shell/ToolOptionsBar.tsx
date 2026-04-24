import { type ToolType, useToolStore } from "../../store/toolStore";
import {
  colors,
  fontSizes,
  fonts,
  fontWeights,
  radii,
  sizing,
  spacing,
} from "../../styles/theme";

const TOOL_LABELS: Record<ToolType, string> = {
  brush: "Brush",
  eraser: "Eraser",
  line: "Line",
  fill: "Fill",
  eyedropper: "Eyedropper",
  selection: "Selection",
  move: "Move",
  zoom: "Zoom",
};

const labelStyle: React.CSSProperties = {
  fontSize: fontSizes.sm,
  color: colors.textSecondary,
  userSelect: "none",
  fontFamily: fonts.ui,
};

const titleStyle: React.CSSProperties = {
  fontSize: fontSizes.md,
  fontWeight: fontWeights.semibold,
  color: colors.textTitle,
  userSelect: "none",
  fontFamily: fonts.ui,
};

const valueBoxStyle: React.CSSProperties = {
  height: sizing.button.xs,
  minWidth: sizing.valueBoxMinWidth,
  background: colors.inputField,
  borderRadius: radii.md,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: `0 ${spacing.md}px`,
};

const valueTextStyle: React.CSSProperties = {
  fontSize: fontSizes.xs,
  color: colors.textTitle,
  fontFamily: fonts.mono,
};

function NumericInput({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <>
      <span style={labelStyle}>{label}:</span>
      <div style={valueBoxStyle}>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const v = Number.parseInt(e.target.value, 10);
            if (!Number.isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
          style={{
            ...valueTextStyle,
            width: sizing.button.xl,
            background: colors.transparent,
            border: "none",
            outline: "none",
            textAlign: "center",
            padding: 0,
          }}
        />
        {suffix && <span style={valueTextStyle}>{suffix}</span>}
      </div>
    </>
  );
}

function ToggleButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...valueBoxStyle,
        background: active ? colors.accent : colors.inputField,
        color: active ? colors.white : colors.textSecondary,
        fontSize: fontSizes.xs,
        fontFamily: fonts.ui,
        border: "none",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {label}
    </button>
  );
}

function BrushOptions() {
  const brushSize = useToolStore((s) => s.brushSize);
  const opacity = useToolStore((s) => s.opacity);
  const setBrushSize = useToolStore((s) => s.setBrushSize);
  const setOpacity = useToolStore((s) => s.setOpacity);

  return (
    <>
      <NumericInput
        label="Size"
        value={brushSize}
        min={1}
        max={32}
        suffix="px"
        onChange={setBrushSize}
      />
      <NumericInput
        label="Opacity"
        value={opacity}
        min={0}
        max={100}
        suffix="%"
        onChange={setOpacity}
      />
    </>
  );
}

function EraserOptions() {
  const brushSize = useToolStore((s) => s.brushSize);
  const setBrushSize = useToolStore((s) => s.setBrushSize);

  return (
    <NumericInput
      label="Size"
      value={brushSize}
      min={1}
      max={32}
      suffix="px"
      onChange={setBrushSize}
    />
  );
}

function EyedropperOptions() {
  const pipetteMode = useToolStore((s) => s.pipetteMode);
  const setPipetteMode = useToolStore((s) => s.setPipetteMode);

  return (
    <>
      <span style={labelStyle}>Sample:</span>
      <ToggleButton
        label="Composite"
        active={pipetteMode === "composite"}
        onClick={() => setPipetteMode("composite")}
      />
      <ToggleButton
        label="Active Layer"
        active={pipetteMode === "active_layer"}
        onClick={() => setPipetteMode("active_layer")}
      />
    </>
  );
}

const TOOL_OPTIONS: Partial<Record<ToolType, React.FC>> = {
  brush: BrushOptions,
  eraser: EraserOptions,
  line: BrushOptions,
  eyedropper: EyedropperOptions,
};

export function ToolOptionsBar() {
  const activeToolType = useToolStore((s) => s.activeToolType);
  const OptionsComponent = TOOL_OPTIONS[activeToolType];

  return (
    <div
      style={{
        height: sizing.tabBarHeight,
        minHeight: sizing.tabBarHeight,
        background: colors.shellBackground,
        display: "flex",
        alignItems: "center",
        padding: `0 ${spacing.xl}px`,
        gap: spacing["2xl"],
      }}
    >
      <span style={titleStyle}>{TOOL_LABELS[activeToolType]}</span>
      {OptionsComponent && <OptionsComponent />}
    </div>
  );
}
