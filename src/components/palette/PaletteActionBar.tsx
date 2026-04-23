import {
  Palette as PaletteIcon,
  Pencil,
  Pipette,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { colors } from "../../styles/theme";

const ICON_SIZE = 12;

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
      <button
        type="button"
        style={buttonStyle}
        onClick={onNew}
        title="New palette"
        aria-label="New palette"
      >
        <Plus size={ICON_SIZE} color={colors.textSecondary} />
      </button>
      <button
        type="button"
        style={{ ...buttonStyle, ...disabledIfStyle(!hasActivePalette) }}
        onClick={onRename}
        disabled={!hasActivePalette}
        title="Rename palette"
        aria-label="Rename palette"
      >
        <Pencil size={ICON_SIZE} color={colors.textSecondary} />
      </button>
      <button
        type="button"
        style={{ ...buttonStyle, ...disabledIfStyle(!hasActivePalette) }}
        onClick={onDelete}
        disabled={!hasActivePalette}
        title="Delete palette"
        aria-label="Delete palette"
      >
        <Trash2 size={ICON_SIZE} color={colors.textSecondary} />
      </button>
      <div style={separatorStyle} />
      <button
        type="button"
        style={{
          ...buttonStyle,
          ...disabledIfStyle(!hasActivePalette),
          background: pipetteActive ? colors.accent : buttonStyle.background,
        }}
        onClick={onTogglePipette}
        disabled={!hasActivePalette}
        title={
          pipetteActive
            ? "Exit pipette mode"
            : "Pipette: click a canvas pixel to add its color"
        }
        aria-label="Toggle pipette mode"
        aria-pressed={pipetteActive}
      >
        <Pipette
          size={ICON_SIZE}
          color={pipetteActive ? "#FFFFFF" : colors.textSecondary}
        />
      </button>
      <button
        type="button"
        style={{ ...buttonStyle, ...disabledIfStyle(!hasActivePalette) }}
        onClick={onAddPrimary}
        disabled={!hasActivePalette}
        title="Add primary color to the palette"
        aria-label="Add primary color"
      >
        <PaletteIcon size={ICON_SIZE} color={colors.textSecondary} />
      </button>
      <div style={separatorStyle} />
      <button
        type="button"
        style={{ ...buttonStyle, ...disabledIfStyle(!hasActivePalette) }}
        onClick={onSave}
        disabled={!hasActivePalette}
        title="Export palette to a .texpal file"
        aria-label="Save palette"
      >
        <Save size={ICON_SIZE} color={colors.textSecondary} />
      </button>
      <button
        type="button"
        style={buttonStyle}
        onClick={onLoad}
        title="Import a palette from a .texpal file"
        aria-label="Load palette"
      >
        <Upload size={ICON_SIZE} color={colors.textSecondary} />
      </button>
    </div>
  );
}

function disabledIfStyle(disabled: boolean): React.CSSProperties {
  return disabled ? { opacity: 0.4, cursor: "not-allowed" } : {};
}

const barStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexShrink: 0,
};

const buttonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 20,
  borderRadius: 4,
  background: colors.inputField,
  border: "none",
  cursor: "pointer",
  padding: 0,
};

const separatorStyle: React.CSSProperties = {
  width: 1,
  height: 14,
  background: colors.separator,
  margin: "0 2px",
  opacity: 0.6,
};
