import { useState } from "react";
import type { ImportStrategyDto } from "../../api/commands";
import { colors, spacing } from "../../styles/theme";
import {
  Dialog,
  DialogActions,
  DialogButton,
  DialogInput,
  DialogTitle,
} from "../primitives/Dialog";

interface ImportConflictDialogProps {
  suggestedName: string;
  onStrategy: (strategy: ImportStrategyDto) => void;
}

export function ImportConflictDialog({
  suggestedName,
  onStrategy,
}: ImportConflictDialogProps) {
  const [name, setName] = useState(suggestedName);

  const trimmed = name.trim();
  const nameValid =
    trimmed.length > 0 && trimmed === name && Array.from(trimmed).length <= 64;

  return (
    <Dialog ariaLabel="Palette name collision" size="lg">
      <DialogTitle>A palette with this name already exists</DialogTitle>
      <label style={labelStyle} htmlFor="import-conflict-name">
        Suggested new name
        <DialogInput
          id="import-conflict-name"
          value={name}
          onChange={setName}
          ariaLabel="New palette name"
        />
      </label>
      <DialogActions>
        <DialogButton onClick={() => onStrategy({ action: "cancel" })}>
          Cancel
        </DialogButton>
        <DialogButton onClick={() => onStrategy({ action: "overwrite" })}>
          Overwrite
        </DialogButton>
        <DialogButton
          variant="primary"
          autoFocus
          disabled={!nameValid}
          onClick={() => onStrategy({ action: "rename", newName: name })}
        >
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
