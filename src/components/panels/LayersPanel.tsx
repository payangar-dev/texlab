import type { IDockviewPanelProps } from "dockview";

export function LayersPanel(_props: IDockviewPanelProps) {
  return (
    <div style={containerStyle}>
      <span style={placeholderStyle}>Layers</span>
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
  fontSize: 13,
  userSelect: "none",
};
