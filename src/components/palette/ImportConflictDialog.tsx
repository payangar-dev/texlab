import { useEffect, useRef, useState } from "react";
import type { ImportStrategyDto } from "../../api/commands";
import { colors, fontSizes, fonts } from "../../styles/theme";

interface ImportConflictDialogProps {
  suggestedName: string;
  onStrategy: (strategy: ImportStrategyDto) => void;
  // `onCancel` is accepted for API symmetry with the other dialogs; this
  // dialog routes cancellation through onStrategy({action:"cancel"}) so
  // callers see a uniform surface. Kept in props to avoid forcing callers
  // to branch on dialog type just to forget a prop.
  onCancel?: () => void;
}

/**
 * Three-action dialog for FR-020a. *Rename* is the default action (focused
 * on mount), with the suggested name editable. *Overwrite* replaces the
 * existing palette's content in place. *Cancel* is a no-op.
 */
export function ImportConflictDialog({
  suggestedName,
  onStrategy,
}: ImportConflictDialogProps) {
  const [name, setName] = useState(suggestedName);
  const renameButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    renameButtonRef.current?.focus();
  }, []);

  const trimmed = name.trim();
  const nameValid =
    trimmed.length > 0 && trimmed === name && Array.from(trimmed).length <= 64;

  return (
    <div style={backdropStyle} role="dialog" aria-label="Palette name collision">
      <div style={cardStyle}>
        <h2 style={titleStyle}>A palette with this name already exists</h2>
        <label style={labelStyle}>
          Suggested new name
          <input
            type="text"
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="New palette name"
          />
        </label>
        <div style={actionsStyle}>
          <button
            type="button"
            style={{ ...buttonStyle }}
            onClick={() => onStrategy({ action: "cancel" })}
          >
            Cancel
          </button>
          <button
            type="button"
            style={{ ...buttonStyle }}
            onClick={() => onStrategy({ action: "overwrite" })}
          >
            Overwrite
          </button>
          <button
            ref={renameButtonRef}
            type="button"
            disabled={!nameValid}
            style={{
              ...buttonStyle,
              background: colors.accent,
              color: "#FFFFFF",
              opacity: nameValid ? 1 : 0.5,
              cursor: nameValid ? "pointer" : "not-allowed",
            }}
            onClick={() => onStrategy({ action: "rename", newName: name })}
          >
            Rename
          </button>
        </div>
      </div>
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
  minWidth: 360,
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
