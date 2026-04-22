import { removeColorFromActivePaletteAt } from "../../api/commands";
import { usePaletteStore } from "../../store/paletteStore";
import { useToolStore } from "../../store/toolStore";
import { colorDtoToHex } from "../../utils/colorHex";
import { commandRegistry } from "../commandRegistry";
import { keybindingRegistry } from "../keybindingRegistry";

export function registerPaletteCommands(): void {
  /**
   * Delete the swatch that equals the active primary color (FR-012). No-op
   * if the primary does not match any swatch. Uses the existing palette
   * state already mirrored in the store — no extra backend round-trip to
   * resolve the index.
   */
  commandRegistry.registerCommand({
    id: "palette.deleteActiveSwatch",
    label: "Delete active swatch",
    category: "edit",
    precondition: () => {
      const active = usePaletteStore.getState().getActivePalette();
      if (!active || active.colors.length === 0) return false;
      const primary = useToolStore.getState().activeColor;
      const hex = colorDtoToHex(primary);
      return active.colors.some((c) => c.toUpperCase() === hex);
    },
    execute: () => {
      const active = usePaletteStore.getState().getActivePalette();
      if (!active) return;
      const primary = useToolStore.getState().activeColor;
      const hex = colorDtoToHex(primary);
      const index = active.colors.findIndex((c) => c.toUpperCase() === hex);
      if (index < 0) return;
      removeColorFromActivePaletteAt(index).catch((err) =>
        console.error("[palette.deleteActiveSwatch] failed:", err),
      );
    },
  });

  /**
   * Exit pipette mode (FR-010 alternative exit path). Gated on the pipette
   * being active so Escape remains available for other consumers when not
   * pipetting.
   */
  commandRegistry.registerCommand({
    id: "palette.exitPipette",
    label: "Exit palette pipette mode",
    category: "edit",
    precondition: () => usePaletteStore.getState().pipetteActive,
    execute: () => {
      usePaletteStore.getState().setPipetteActive(false);
    },
  });

  keybindingRegistry.registerKeybinding({
    key: "Delete",
    commandId: "palette.deleteActiveSwatch",
  });
  keybindingRegistry.registerKeybinding({
    key: "Escape",
    commandId: "palette.exitPipette",
  });
}
