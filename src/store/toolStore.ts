import { create } from "zustand";
import type { ColorDto } from "../api/commands";

export type ToolType =
  | "brush"
  | "eraser"
  | "fill"
  | "eyedropper"
  | "line"
  | "selection"
  | "move"
  | "zoom";

export type PipetteMode = "composite" | "active_layer";

interface ToolState {
  activeToolType: ToolType;
  brushSize: number;
  opacity: number;
  activeColor: ColorDto;
  secondaryColor: ColorDto;
  pipetteMode: PipetteMode;
}

interface ToolActions {
  setActiveToolType: (toolType: ToolType) => void;
  setBrushSize: (size: number) => void;
  setOpacity: (opacity: number) => void;
  setActiveColor: (color: ColorDto) => void;
  setSecondaryColor: (color: ColorDto) => void;
  swapColors: () => void;
  setPipetteMode: (mode: PipetteMode) => void;
}

export type ToolStore = ToolState & ToolActions;

export const useToolStore = create<ToolStore>((set) => ({
  activeToolType: "brush",
  brushSize: 1,
  opacity: 100,
  activeColor: { r: 0, g: 0, b: 0, a: 255 },
  secondaryColor: { r: 255, g: 255, b: 255, a: 255 },
  pipetteMode: "composite",

  setActiveToolType: (toolType) => set({ activeToolType: toolType }),
  setBrushSize: (size) => set({ brushSize: Math.max(1, Math.min(32, size)) }),
  setOpacity: (opacity) => set({ opacity: Math.max(0, Math.min(100, opacity)) }),
  setActiveColor: (color) => set({ activeColor: color }),
  setSecondaryColor: (color) => set({ secondaryColor: color }),
  swapColors: () =>
    set((state) => ({
      activeColor: state.secondaryColor,
      secondaryColor: state.activeColor,
    })),
  setPipetteMode: (mode) => set({ pipetteMode: mode }),
}));
