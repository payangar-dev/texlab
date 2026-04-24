import { useEffect, useRef, useState } from "react";
import type { PaletteScopeDto } from "../../api/commands";
import { colors, fontSizes, opacities, sizing, spacing } from "../../styles/theme";
import {
  Dialog,
  DialogActions,
  DialogButton,
  DialogInput,
  DialogTitle,
} from "../primitives/Dialog";
import { validatePaletteName } from "./paletteNameValidation";

interface NewPaletteDialogProps {
  canCreateProjectPalette: boolean;
  onSubmit: (payload: { name: string; scope: PaletteScopeDto }) => void;
  onCancel: () => void;
}

export function NewPaletteDialog({
  canCreateProjectPalette,
  onSubmit,
  onCancel,
}: NewPaletteDialogProps) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<PaletteScopeDto>("global");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validatePaletteName(name);
    if (err) {
      setError(err);
      return;
    }
    onSubmit({ name, scope });
  };

  return (
    <Dialog ariaLabel="New palette" onSubmit={handleSubmit} onEscape={onCancel}>
      <DialogTitle>New palette</DialogTitle>
      <label style={labelStyle} htmlFor="new-palette-name">
        Name
        <DialogInput
          id="new-palette-name"
          inputRef={inputRef}
          value={name}
          onChange={(v) => {
            setName(v);
            setError(null);
          }}
          onEscape={onCancel}
          ariaLabel="Palette name"
        />
      </label>
      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>Scope</legend>
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
              : "Open a project to save palettes in project scope."
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
      {error && (
        <div style={errorStyle} role="alert">
          {error}
        </div>
      )}
      <DialogActions>
        <DialogButton onClick={onCancel}>Cancel</DialogButton>
        <DialogButton type="submit" variant="primary">
          Create
        </DialogButton>
      </DialogActions>
    </Dialog>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing.sm,
  color: colors.textSecondary,
};

const fieldsetStyle: React.CSSProperties = {
  border: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  gap: sizing.dialog.fieldsetGap,
};

const legendStyle: React.CSSProperties = {
  color: colors.textSecondary,
  padding: 0,
  marginBottom: spacing.sm,
};

const radioLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: spacing.sm,
  color: colors.textPrimary,
};

const errorStyle: React.CSSProperties = {
  color: colors.errorText,
  fontSize: fontSizes.xs,
};
