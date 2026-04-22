import {
  open as openFileDialog,
  save as saveFileDialog,
} from "@tauri-apps/plugin-dialog";
import type { IDockviewPanelProps } from "dockview";
import { useEffect, useState } from "react";
import {
  addColorToActivePalette,
  createPalette,
  deletePalette,
  exportPalette,
  importPalette,
  type PaletteScopeDto,
  renamePalette,
  setActivePalette,
} from "../../api/commands";
import { classifyPaletteError } from "../../api/paletteErrors";
import { usePaletteStore } from "../../store/paletteStore";
import { useToolStore } from "../../store/toolStore";
import { colors, fontSizes, fonts } from "../../styles/theme";
import { colorDtoToHex } from "../../utils/colorHex";
import { showToast } from "../../utils/toast";
import { ImportConflictDialog } from "../palette/ImportConflictDialog";
import { ImportScopeDialog } from "../palette/ImportScopeDialog";
import { NewPaletteDialog } from "../palette/NewPaletteDialog";
import { PaletteActionBar } from "../palette/PaletteActionBar";
import { PaletteDropdown } from "../palette/PaletteDropdown";
import { RenamePaletteDialog } from "../palette/RenamePaletteDialog";
import { SwatchGrid } from "../palette/SwatchGrid";

type DialogState =
  | { kind: "none" }
  | { kind: "new" }
  | { kind: "rename"; currentName: string }
  | { kind: "confirmDelete"; paletteId: string; name: string }
  | { kind: "importScope"; sourcePath: string }
  | {
      kind: "importConflict";
      sourcePath: string;
      scope: PaletteScopeDto;
      suggestedName: string;
    };

export function PalettePanel(_props: IDockviewPanelProps) {
  const palettes = usePaletteStore((s) => s.palettes);
  const activePaletteId = usePaletteStore((s) => s.activePaletteId);
  const canCreateProjectPalette = usePaletteStore((s) => s.canCreateProjectPalette);
  const pipetteActive = usePaletteStore((s) => s.pipetteActive);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [pulseIndex, setPulseIndex] = useState<number | null>(null);

  useEffect(() => {
    usePaletteStore
      .getState()
      .refreshState()
      .catch(() => {});
  }, []);

  const activePalette = palettes.find((p) => p.id === activePaletteId) ?? null;

  const handleSelect = async (paletteId: string | null) => {
    try {
      await setActivePalette(paletteId);
    } catch (err) {
      console.error("[PalettePanel] setActivePalette failed:", err);
    }
  };

  const handleNew = () => setDialog({ kind: "new" });

  const handleRename = () => {
    if (!activePalette) return;
    setDialog({ kind: "rename", currentName: activePalette.name });
  };

  const handleDelete = () => {
    if (!activePalette) return;
    setDialog({
      kind: "confirmDelete",
      paletteId: activePalette.id,
      name: activePalette.name,
    });
  };

  const handleTogglePipette = () => {
    const current = usePaletteStore.getState().pipetteActive;
    usePaletteStore.getState().setPipetteActive(!current);
  };

  const handleAddPrimary = async () => {
    const primary = useToolStore.getState().activeColor;
    const hex = colorDtoToHex(primary);
    try {
      const result = await addColorToActivePalette(hex);
      if (!result.added) setPulseIndex(result.index);
    } catch (err) {
      console.error("[PalettePanel] addColorToActivePalette failed:", err);
    }
  };

  const submitNewPalette = async (payload: { name: string; scope: PaletteScopeDto }) => {
    try {
      await createPalette(payload.name, payload.scope);
      setDialog({ kind: "none" });
    } catch (err) {
      const classified = classifyPaletteError(err);
      if (classified.kind === "nameInvalid" || classified.kind === "duplicate") {
        showToast(classified.message);
      } else {
        console.error("[PalettePanel] createPalette failed:", err);
        showToast("Failed to create palette.");
      }
    }
  };

  const submitRename = async (newName: string) => {
    if (!activePalette) return;
    try {
      await renamePalette(activePalette.id, newName);
      setDialog({ kind: "none" });
    } catch (err) {
      const classified = classifyPaletteError(err);
      if (classified.kind === "nameInvalid" || classified.kind === "duplicate") {
        showToast(classified.message);
      } else {
        console.error("[PalettePanel] renamePalette failed:", err);
        showToast("Failed to rename palette.");
      }
    }
  };

  const confirmDelete = async (paletteId: string) => {
    try {
      await deletePalette(paletteId);
    } catch (err) {
      console.error("[PalettePanel] deletePalette failed:", err);
    } finally {
      setDialog({ kind: "none" });
    }
  };

  // Pulse cleanup — reset the index a tick after it is set so the grid
  // only plays the animation once per add attempt.
  useEffect(() => {
    if (pulseIndex == null) return;
    const t = window.setTimeout(() => setPulseIndex(null), 450);
    return () => window.clearTimeout(t);
  }, [pulseIndex]);

  const handleSave = async () => {
    if (!activePalette) return;
    try {
      const chosen = await saveFileDialog({
        title: "Export palette",
        defaultPath: `${activePalette.name}.texpal`,
        filters: [{ name: "TexLab Palette", extensions: ["texpal"] }],
      });
      if (!chosen) return;
      await exportPalette(activePalette.id, chosen);
      showToast(`Saved to ${chosen}`);
    } catch (err) {
      console.error("[PalettePanel] export failed:", err);
      showToast("Failed to save palette.");
    }
  };

  const handleLoad = async () => {
    try {
      const chosen = await openFileDialog({
        multiple: false,
        filters: [{ name: "TexLab Palette", extensions: ["texpal"] }],
      });
      if (!chosen || typeof chosen !== "string") return;
      setDialog({ kind: "importScope", sourcePath: chosen });
    } catch (err) {
      console.error("[PalettePanel] load failed:", err);
      showToast("Failed to open file picker.");
    }
  };

  const performImport = async (
    sourcePath: string,
    scope: PaletteScopeDto,
    strategy?: Parameters<typeof importPalette>[2],
  ) => {
    try {
      await importPalette(sourcePath, scope, strategy);
      setDialog({ kind: "none" });
    } catch (err) {
      const classified = classifyPaletteError(err);
      if (classified.kind === "collision" && classified.suggested) {
        setDialog({
          kind: "importConflict",
          sourcePath,
          scope,
          suggestedName: classified.suggested,
        });
      } else if (classified.kind === "malformed") {
        setDialog({ kind: "none" });
        showToast(`Invalid palette file: ${classified.message}`);
      } else {
        setDialog({ kind: "none" });
        showToast(`Import failed: ${classified.message}`);
      }
    }
  };

  return (
    <div style={containerStyle}>
      <PaletteActionBar
        hasActivePalette={activePalette !== null}
        pipetteActive={pipetteActive}
        saveLoadEnabled
        onNew={handleNew}
        onRename={handleRename}
        onDelete={handleDelete}
        onTogglePipette={handleTogglePipette}
        onAddPrimary={handleAddPrimary}
        onSave={handleSave}
        onLoad={handleLoad}
      />
      <div style={dropdownWrapStyle}>
        {palettes.length === 0 ? (
          <span style={emptyStyle}>No palettes — create one.</span>
        ) : (
          <PaletteDropdown
            palettes={palettes}
            activePaletteId={activePaletteId}
            onSelect={handleSelect}
          />
        )}
      </div>
      {activePalette &&
        (activePalette.colors.length === 0 ? (
          <div style={emptyStyle}>This palette has no swatches. Add colors above.</div>
        ) : (
          <SwatchGrid colors={activePalette.colors} pulseIndex={pulseIndex} />
        ))}

      {dialog.kind === "new" && (
        <NewPaletteDialog
          canCreateProjectPalette={canCreateProjectPalette}
          onCancel={() => setDialog({ kind: "none" })}
          onSubmit={submitNewPalette}
        />
      )}
      {dialog.kind === "rename" && (
        <RenamePaletteDialog
          currentName={dialog.currentName}
          onCancel={() => setDialog({ kind: "none" })}
          onSubmit={submitRename}
        />
      )}
      {dialog.kind === "confirmDelete" && (
        <ConfirmPopover
          title={`Delete palette "${dialog.name}"?`}
          onCancel={() => setDialog({ kind: "none" })}
          onConfirm={() => confirmDelete(dialog.paletteId)}
        />
      )}
      {dialog.kind === "importScope" && (
        <ImportScopeDialog
          canCreateProjectPalette={canCreateProjectPalette}
          onCancel={() => setDialog({ kind: "none" })}
          onSubmit={(scope) => performImport(dialog.sourcePath, scope)}
        />
      )}
      {dialog.kind === "importConflict" && (
        <ImportConflictDialog
          suggestedName={dialog.suggestedName}
          onCancel={() => setDialog({ kind: "none" })}
          onStrategy={(strategy) => {
            if (strategy.action === "cancel") {
              setDialog({ kind: "none" });
              return;
            }
            performImport(dialog.sourcePath, dialog.scope, strategy);
          }}
        />
      )}
    </div>
  );
}

function ConfirmPopover({
  title,
  onCancel,
  onConfirm,
}: {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={backdropStyle} role="alertdialog" aria-label={title}>
      <div style={confirmCardStyle}>
        <div style={{ fontSize: fontSizes.md }}>{title}</div>
        <div style={confirmActionsStyle}>
          <button type="button" style={confirmButtonStyle} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            style={{ ...confirmButtonStyle, background: "#E06C6C", color: "#FFFFFF" }}
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: colors.panelBody,
  overflow: "hidden",
};

const dropdownWrapStyle: React.CSSProperties = {
  padding: 6,
  borderBottom: `1px solid ${colors.separator}`,
};

const emptyStyle: React.CSSProperties = {
  display: "block",
  padding: 12,
  textAlign: "center",
  color: colors.textMuted,
  fontFamily: fonts.ui,
  fontSize: fontSizes.sm,
};

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const confirmCardStyle: React.CSSProperties = {
  background: colors.panelHeader,
  color: colors.textPrimary,
  padding: 20,
  borderRadius: 6,
  minWidth: 300,
  fontFamily: fonts.ui,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const confirmActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
};

const confirmButtonStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 4,
  border: "none",
  background: colors.inputField,
  color: colors.textPrimary,
  cursor: "pointer",
  fontSize: fontSizes.sm,
};
