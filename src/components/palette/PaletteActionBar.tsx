import {
  Palette as PaletteIcon,
  Pencil,
  Pipette,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { colors, opacities, sizing, spacing } from "../../styles/theme";
import { IconButton } from "../primitives/IconButton";

type ActionBarHandlers = {
  onNew: () => void;
  onRename: () => void;
  onDelete: () => void;
  onTogglePipette: () => void;
  onAddPrimary: () => void;
  onSave: () => void;
  onLoad: () => void;
};

interface PaletteActionBarProps extends ActionBarHandlers {
  hasActivePalette: boolean;
  pipetteActive: boolean;
}

export function PaletteActionBar({
  hasActivePalette,
  pipetteActive,
  onNew,
  onRename,
  onDelete,
  onTogglePipette,
  onAddPrimary,
  onSave,
  onLoad,
}: PaletteActionBarProps) {
  return (
    <div style={barStyle} role="toolbar" aria-label="Palette actions">
      <IconButton icon={Plus} title="New palette" onClick={onNew} />
      <IconButton
        icon={Pencil}
        title="Rename palette"
        onClick={onRename}
        disabled={!hasActivePalette}
      />
      <IconButton
        icon={Trash2}
        title="Delete palette"
        onClick={onDelete}
        disabled={!hasActivePalette}
      />
      <div style={separatorStyle} />
      <IconButton
        icon={Pipette}
        title={
          pipetteActive
            ? "Exit pipette mode"
            : "Pipette: click a canvas pixel to add its color"
        }
        aria-label="Toggle pipette mode"
        onClick={onTogglePipette}
        disabled={!hasActivePalette}
        toggled={pipetteActive}
      />
      <IconButton
        icon={PaletteIcon}
        title="Add primary color to the palette"
        aria-label="Add primary color"
        onClick={onAddPrimary}
        disabled={!hasActivePalette}
      />
      <div style={separatorStyle} />
      <IconButton
        icon={Save}
        title="Export palette to a .texpal file"
        aria-label="Save palette"
        onClick={onSave}
        disabled={!hasActivePalette}
      />
      <IconButton
        icon={Upload}
        title="Import a palette from a .texpal file"
        aria-label="Load palette"
        onClick={onLoad}
      />
    </div>
  );
}

const barStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing.sm,
  flexShrink: 0,
};

const separatorStyle: React.CSSProperties = {
  width: sizing.hairline,
  height: sizing.separatorShortHeight,
  background: colors.separator,
  margin: `0 ${spacing.xs}px`,
  opacity: opacities.subtle,
};
