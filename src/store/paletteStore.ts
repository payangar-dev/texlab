import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import type { PaletteDto, PaletteListDto } from "../api/commands";
import { getPalettes } from "../api/commands";
import { useToolStore } from "./toolStore";

interface PaletteStoreState {
  palettes: PaletteDto[];
  activePaletteId: string | null;
  canCreateProjectPalette: boolean;
  pipetteActive: boolean;
  refreshState: () => Promise<void>;
  setPipetteActive: (active: boolean) => void;
  getActivePalette: () => PaletteDto | null;
}

export const usePaletteStore = create<PaletteStoreState>((set, get) => ({
  palettes: [],
  activePaletteId: null,
  canCreateProjectPalette: false,
  pipetteActive: false,

  refreshState: async () => {
    try {
      const state: PaletteListDto = await getPalettes();
      set({
        palettes: state.palettes,
        activePaletteId: state.activePaletteId,
        canCreateProjectPalette: state.canCreateProjectPalette,
      });
    } catch (err) {
      console.error("[paletteStore] failed to refresh state:", err);
    }
  },

  setPipetteActive: (active) => set({ pipetteActive: active }),

  getActivePalette: () => {
    const { palettes, activePaletteId } = get();
    if (!activePaletteId) return null;
    return palettes.find((p) => p.id === activePaletteId) ?? null;
  },
}));

let listenerInitialized = false;
let toolStoreSubscribed = false;

/**
 * Installs the `state-changed` listener and a tool-store subscription that
 * exits pipette mode whenever the user switches to a drawing tool (US2
 * FR-010 exit path). Idempotent — safe to call from `AppShell` alongside
 * `initEditorListener`.
 */
export function initPaletteListener(): void {
  if (!listenerInitialized) {
    listenerInitialized = true;
    listen("state-changed", () => {
      usePaletteStore
        .getState()
        .refreshState()
        .catch((err) => {
          console.error("[paletteStore] state-changed handler failed:", err);
        });
    });
  }

  if (!toolStoreSubscribed) {
    toolStoreSubscribed = true;
    let lastTool = useToolStore.getState().activeToolType;
    useToolStore.subscribe((tool) => {
      if (tool.activeToolType !== lastTool) {
        lastTool = tool.activeToolType;
        if (usePaletteStore.getState().pipetteActive) {
          usePaletteStore.getState().setPipetteActive(false);
        }
      }
    });
  }
}
