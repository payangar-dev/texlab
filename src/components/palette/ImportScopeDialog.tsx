import { useState } from "react";
import type { PaletteScopeDto } from "../../api/commands";
import { colors, fontSizes, fonts } from "../../styles/theme";

interface ImportScopeDialogProps {
  canCreateProjectPalette: boolean;
  onSubmit: (scope: PaletteScopeDto) => void;
  onCancel: () => void;
}

export function ImportScopeDialog({
  canCreateProjectPalette,
  onSubmit,
  onCancel,
}: ImportScopeDialogProps) {
  const [scope, setScope] = useState<PaletteScopeDto>("global");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(scope);
  };

  return (
    <div style={backdropStyle} role="dialog" aria-label="Import palette — choose scope">
      <form style={cardStyle} onSubmit={handleSubmit}>
        <h2 style={titleStyle}>Import palette</h2>
        <div style={{ color: colors.textSecondary, fontSize: fontSizes.sm }}>
          Where should this palette live?
        </div>
        <fieldset style={fieldsetStyle}>
          <label style={radioLabelStyle}>
            <input
              type="radio"
              name="scope"
              value="global"
              checked={scope === "global"}
              onChange={() => setScope("global")}
            />
            Global
          </label>
          <label
            style={{
              ...radioLabelStyle,
              opacity: canCreateProjectPalette ? 1 : 0.5,
              cursor: canCreateProjectPalette ? "pointer" : "not-allowed",
            }}
            title={
              canCreateProjectPalette
                ? undefined
                : "Open a project to import palettes into project scope."
            }
          >
            <input
              type="radio"
              name="scope"
              value="project"
              checked={scope === "project"}
              disabled={!canCreateProjectPalette}
              onChange={() => setScope("project")}
            />
            Project
          </label>
        </fieldset>
        <div style={actionsStyle}>
          <button type="button" style={buttonStyle} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            style={{ ...buttonStyle, background: colors.accent, color: "#FFFFFF" }}
          >
            Import
          </button>
        </div>
      </form>
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const cardStyle: React.CSSProperties = {
  background: colors.panelHeader,
  color: colors.textPrimary,
  padding: 20,
  borderRadius: 6,
  minWidth: 320,
  fontFamily: fonts.ui,
  fontSize: fontSizes.sm,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: fontSizes.md,
  color: colors.textTitle,
};

const fieldsetStyle: React.CSSProperties = {
  border: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  gap: 14,
};

const radioLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  color: colors.textPrimary,
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
};

const buttonStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 4,
  border: "none",
  background: colors.inputField,
  color: colors.textPrimary,
  cursor: "pointer",
  fontSize: fontSizes.sm,
};
