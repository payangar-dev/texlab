import { beforeEach, describe, expect, it } from "vitest";
import { useToolStore } from "./toolStore";

function resetStore() {
  useToolStore.setState({
    activeToolType: "brush",
    brushSize: 1,
    opacity: 100,
    activeColor: { r: 0, g: 0, b: 0, a: 255 },
    secondaryColor: { r: 255, g: 255, b: 255, a: 255 },
    pipetteMode: "composite",
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
        "selection",
        "move",
        "zoom",
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

    it("clamps to maximum of 32", () => {
      useToolStore.getState().setBrushSize(50);
      expect(useToolStore.getState().brushSize).toBe(32);

      useToolStore.getState().setBrushSize(33);
      expect(useToolStore.getState().brushSize).toBe(32);
    });
  });

  describe("setOpacity", () => {
    it("sets opacity", () => {
      useToolStore.getState().setOpacity(50);
      expect(useToolStore.getState().opacity).toBe(50);
    });

    it("clamps to minimum of 0", () => {
      useToolStore.getState().setOpacity(-10);
      expect(useToolStore.getState().opacity).toBe(0);
    });

    it("clamps to maximum of 100", () => {
      useToolStore.getState().setOpacity(150);
      expect(useToolStore.getState().opacity).toBe(100);
    });
  });

  describe("setActiveColor", () => {
    it("sets the active color", () => {
      const color = { r: 255, g: 128, b: 0, a: 200 };
      useToolStore.getState().setActiveColor(color);
      expect(useToolStore.getState().activeColor).toEqual(color);
    });
  });

  describe("setSecondaryColor", () => {
    it("sets the secondary color", () => {
      const color = { r: 100, g: 50, b: 25, a: 128 };
      useToolStore.getState().setSecondaryColor(color);
      expect(useToolStore.getState().secondaryColor).toEqual(color);
    });
  });

  describe("swapColors", () => {
    it("swaps primary and secondary colors", () => {
      const primary = { r: 255, g: 0, b: 0, a: 255 };
      const secondary = { r: 0, g: 0, b: 255, a: 255 };
      useToolStore.setState({ activeColor: primary, secondaryColor: secondary });

      useToolStore.getState().swapColors();

      expect(useToolStore.getState().activeColor).toEqual(secondary);
      expect(useToolStore.getState().secondaryColor).toEqual(primary);
    });
  });

  describe("setPipetteMode", () => {
    it("sets pipette mode", () => {
      useToolStore.getState().setPipetteMode("active_layer");
      expect(useToolStore.getState().pipetteMode).toBe("active_layer");

      useToolStore.getState().setPipetteMode("composite");
      expect(useToolStore.getState().pipetteMode).toBe("composite");
    });
  });

  describe("defaults", () => {
    it("starts with correct default values", () => {
      const state = useToolStore.getState();
      expect(state.activeToolType).toBe("brush");
      expect(state.brushSize).toBe(1);
      expect(state.opacity).toBe(100);
      expect(state.activeColor).toEqual({ r: 0, g: 0, b: 0, a: 255 });
      expect(state.secondaryColor).toEqual({ r: 255, g: 255, b: 255, a: 255 });
      expect(state.pipetteMode).toBe("composite");
    });
  });
});
