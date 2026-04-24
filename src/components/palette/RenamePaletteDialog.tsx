import { useEffect, useRef, useState } from "react";
import { colors, fontSizes, spacing } from "../../styles/theme";
import {
  Dialog,
  DialogActions,
  DialogButton,
  DialogInput,
  DialogTitle,
} from "../primitives/Dialog";
import { validatePaletteName } from "./paletteNameValidation";

interface RenamePaletteDialogProps {
  currentName: string;
  onSubmit: (newName: string) => void;
  onCancel: () => void;
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
    const err = validatePaletteName(name);
    if (err) {
      setError(err);
      return;
    }
    onSubmit(name);
  };

  return (
    <Dialog ariaLabel="Rename palette" onSubmit={handleSubmit} onEscape={onCancel}>
      <DialogTitle>Rename palette</DialogTitle>
      <label style={labelStyle} htmlFor="rename-palette-name">
        New name
        <DialogInput
          id="rename-palette-name"
          inputRef={inputRef}
          value={name}
          onChange={(v) => {
            setName(v);
            setError(null);
          }}
          onEscape={onCancel}
          ariaLabel="New palette name"
        />
      </label>
      {error && (
        <div style={errorStyle} role="alert">
          {error}
        </div>
      )}
      <DialogActions>
        <DialogButton onClick={onCancel}>Cancel</DialogButton>
        <DialogButton type="submit" variant="primary">
          Rename
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

const errorStyle: React.CSSProperties = {
  color: colors.errorText,
  fontSize: fontSizes.xs,
};
