import { describe, it, expect, beforeEach } from "vitest";
import { useToolStore } from "./toolStore";

function resetStore() {
  useToolStore.setState({
    activeToolType: "brush",
    brushSize: 1,
    activeColor: { r: 0, g: 0, b: 0, a: 255 },
  });
}

describe("toolStore", () => {
  beforeEach(resetStore);

  describe("setActiveToolType", () => {
    it("changes the active tool", () => {
      useToolStore.getState().setActiveToolType("eraser");
      expect(useToolStore.getState().activeToolType).toBe("eraser");
    });

    it("accepts all valid tool types", () => {
      const tools = [
        "brush",
        "eraser",
        "fill",
        "eyedropper",
        "line",
        "rectangle",
      ] as const;
      for (const tool of tools) {
        useToolStore.getState().setActiveToolType(tool);
        expect(useToolStore.getState().activeToolType).toBe(tool);
      }
    });
  });

  describe("setBrushSize", () => {
    it("sets brush size", () => {
      useToolStore.getState().setBrushSize(5);
      expect(useToolStore.getState().brushSize).toBe(5);
    });

    it("clamps to minimum of 1", () => {
      useToolStore.getState().setBrushSize(0);
      expect(useToolStore.getState().brushSize).toBe(1);

      useToolStore.getState().setBrushSize(-5);
      expect(useToolStore.getState().brushSize).toBe(1);
    });
  });

  describe("setActiveColor", () => {
    it("sets the active color", () => {
      const color = { r: 255, g: 128, b: 0, a: 200 };
      useToolStore.getState().setActiveColor(color);
      expect(useToolStore.getState().activeColor).toEqual(color);
    });
  });

  describe("defaults", () => {
    it("starts with brush tool, size 1, black color", () => {
      const state = useToolStore.getState();
      expect(state.activeToolType).toBe("brush");
      expect(state.brushSize).toBe(1);
      expect(state.activeColor).toEqual({ r: 0, g: 0, b: 0, a: 255 });
    });
  });
});
