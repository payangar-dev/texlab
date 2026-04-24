import { useState } from "react";
import type { PaletteScopeDto } from "../../api/commands";
import { colors, fontSizes, opacities, sizing, spacing } from "../../styles/theme";
import { Dialog, DialogActions, DialogButton, DialogTitle } from "../primitives/Dialog";

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
    <Dialog
      ariaLabel="Import palette — choose scope"
      onSubmit={handleSubmit}
      onEscape={onCancel}
    >
      <DialogTitle>Import palette</DialogTitle>
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
            opacity: canCreateProjectPalette ? opacities.full : opacities.halfDimmed,
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
      <DialogActions>
        <DialogButton onClick={onCancel}>Cancel</DialogButton>
        <DialogButton type="submit" variant="primary">
          Import
        </DialogButton>
      </DialogActions>
    </Dialog>
  );
}

const fieldsetStyle: React.CSSProperties = {
  border: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  gap: sizing.dialog.fieldsetGap,
};

const radioLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: spacing.sm,
  color: colors.textPrimary,
};
