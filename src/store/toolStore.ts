import { create } from "zustand";
import type { ColorDto } from "../api/commands";

export type ToolType = "brush" | "eraser" | "fill" | "eyedropper" | "line" | "rectangle";

interface ToolState {
  activeToolType: ToolType;
  brushSize: number;
  activeColor: ColorDto;
}

interface ToolActions {
  setActiveToolType: (toolType: ToolType) => void;
  setBrushSize: (size: number) => void;
  setActiveColor: (color: ColorDto) => void;
}

export type ToolStore = ToolState & ToolActions;

export const useToolStore = create<ToolStore>((set) => ({
  activeToolType: "brush",
  brushSize: 1,
  activeColor: { r: 0, g: 0, b: 0, a: 255 },

  setActiveToolType: (toolType) => set({ activeToolType: toolType }),
  setBrushSize: (size) => set({ brushSize: Math.max(1, size) }),
  setActiveColor: (color) => set({ activeColor: color }),
}));
