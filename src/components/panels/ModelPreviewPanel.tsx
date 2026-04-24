import type { IDockviewPanelProps } from "dockview";
import { colors, fontSizes } from "../../styles/theme";

export function ModelPreviewPanel(_props: IDockviewPanelProps) {
  return (
    <div style={containerStyle}>
      <span style={placeholderStyle}>Model Preview</span>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: colors.panelBody,
};

const placeholderStyle: React.CSSProperties = {
  color: colors.textMuted,
  fontSize: fontSizes.lg,
  userSelect: "none",
};
