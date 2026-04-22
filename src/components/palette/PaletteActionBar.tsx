import {
  Palette as PaletteIcon,
  Pencil,
  Pipette,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { colors, fontSizes, fonts } from "../../styles/theme";

type ActionBarHandlers = {
  onNew: () => void;
  onRename: () => void;
  onDelete: () => void;
  onTogglePipette: () => void;
  onAddPrimary: () => void;
  onSave?: () => void;
  onLoad?: () => void;
};

interface PaletteActionBarProps extends ActionBarHandlers {
  hasActivePalette: boolean;
  pipetteActive: boolean;
  /** When false, the "Save"/"Load" actions still render but are disabled
   *  (US4 enables them with real dialog wiring). */
  saveLoadEnabled?: boolean;
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
  saveLoadEnabled = false,
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
        <Plus size={13} color={colors.textSecondary} />
      </button>
      <button
        type="button"
        style={{ ...buttonStyle, ...disabledIfStyle(!hasActivePalette) }}
        onClick={onRename}
        disabled={!hasActivePalette}
        title="Rename palette"
        aria-label="Rename palette"
      >
        <Pencil size={13} color={colors.textSecondary} />
      </button>
      <button
        type="button"
        style={{ ...buttonStyle, ...disabledIfStyle(!hasActivePalette) }}
        onClick={onDelete}
        disabled={!hasActivePalette}
        title="Delete palette"
        aria-label="Delete palette"
      >
        <Trash2 size={13} color={colors.textSecondary} />
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
        <Pipette size={13} color={pipetteActive ? "#FFFFFF" : colors.textSecondary} />
      </button>
      <button
        type="button"
        style={{ ...buttonStyle, ...disabledIfStyle(!hasActivePalette) }}
        onClick={onAddPrimary}
        disabled={!hasActivePalette}
        title="Add primary color to the palette"
        aria-label="Add primary color"
      >
        <PaletteIcon size={13} color={colors.textSecondary} />
      </button>
      <div style={separatorStyle} />
      <button
        type="button"
        style={{
          ...buttonStyle,
          ...disabledIfStyle(!saveLoadEnabled || !hasActivePalette),
        }}
        onClick={onSave}
        disabled={!saveLoadEnabled || !hasActivePalette}
        title="Export palette to a .texpal file"
        aria-label="Save palette"
      >
        <Save size={13} color={colors.textSecondary} />
      </button>
      <button
        type="button"
        style={{ ...buttonStyle, ...disabledIfStyle(!saveLoadEnabled) }}
        onClick={onLoad}
        disabled={!saveLoadEnabled}
        title="Import a palette from a .texpal file"
        aria-label="Load palette"
      >
        <Upload size={13} color={colors.textSecondary} />
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
  padding: "4px 6px",
  height: 30,
  borderBottom: `1px solid ${colors.separator}`,
  background: colors.panelHeader,
  fontFamily: fonts.ui,
  fontSize: fontSizes.xs,
  flexShrink: 0,
};

const buttonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 22,
  borderRadius: 4,
  background: colors.inputField,
  border: "none",
  cursor: "pointer",
  padding: 0,
};

const separatorStyle: React.CSSProperties = {
  width: 1,
  height: 16,
  background: colors.separator,
  margin: "0 2px",
};
