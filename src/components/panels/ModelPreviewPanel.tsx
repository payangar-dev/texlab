import type { IDockviewPanelProps } from "dockview";
import { fontSizes } from "../../styles/theme";

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
  background: "#252525",
};

const placeholderStyle: React.CSSProperties = {
  color: "#666666",
  fontSize: fontSizes.lg,
  userSelect: "none",
};
