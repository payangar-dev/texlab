import { useEffect, useRef, useState } from "react";
import type { PaletteScopeDto } from "../../api/commands";
import { colors, fontSizes, fonts } from "../../styles/theme";
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
    <div style={backdropStyle} role="dialog" aria-label="New palette">
      <form style={cardStyle} onSubmit={handleSubmit}>
        <h2 style={titleStyle}>New palette</h2>
        <label style={labelStyle}>
          Name
          <input
            ref={inputRef}
            type="text"
            style={inputStyle}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
            aria-label="Palette name"
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
              opacity: canCreateProjectPalette ? 1 : 0.5,
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
        <div style={actionsStyle}>
          <button type="button" style={buttonStyle} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            style={{ ...buttonStyle, background: colors.accent, color: "#FFFFFF" }}
          >
            Create
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

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  color: colors.textSecondary,
};

const inputStyle: React.CSSProperties = {
  background: colors.inputField,
  border: `1px solid ${colors.separator}`,
  color: colors.textPrimary,
  padding: "6px 8px",
  borderRadius: 4,
  fontSize: fontSizes.sm,
};

const fieldsetStyle: React.CSSProperties = {
  border: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  gap: 14,
};

const legendStyle: React.CSSProperties = {
  color: colors.textSecondary,
  padding: 0,
  marginBottom: 4,
};

const radioLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  color: colors.textPrimary,
};

const errorStyle: React.CSSProperties = {
  color: "#E06C6C",
  fontSize: fontSizes.xs,
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 6,
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
