import { useEffect, useRef, useState } from "react";
import { colors, fontSizes, fonts } from "../../styles/theme";

interface RenamePaletteDialogProps {
  currentName: string;
  onSubmit: (newName: string) => void;
  onCancel: () => void;
}

function validateName(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "Name cannot be empty.";
  if (trimmed !== raw) return "Leading or trailing whitespace is not allowed.";
  if (Array.from(trimmed).length > 64) return "Name is too long (max 64 characters).";
  return null;
}

export function RenamePaletteDialog({
  currentName,
  onSubmit,
  onCancel,
}: RenamePaletteDialogProps) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateName(name);
    if (err) {
      setError(err);
      return;
    }
    onSubmit(name);
  };

  return (
    <div style={backdropStyle} role="dialog" aria-label="Rename palette">
      <form style={cardStyle} onSubmit={handleSubmit}>
        <h2 style={titleStyle}>Rename palette</h2>
        <label style={labelStyle}>
          New name
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
            aria-label="New palette name"
          />
        </label>
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
            Rename
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
