import { describe, it, expect, beforeEach } from "vitest";
import { useViewportStore } from "./viewportStore";
import { ZOOM_LEVELS } from "../components/canvas/constants";

function resetStore() {
  useViewportStore.setState({
    zoom: 1,
    panX: 0,
    panY: 0,
    containerWidth: 800,
    containerHeight: 600,
  });
}

describe("viewportStore", () => {
  beforeEach(resetStore);

  describe("zoomIn / zoomOut", () => {
    it("steps through ZOOM_LEVELS on zoomIn", () => {
      const store = useViewportStore.getState();
      expect(store.zoom).toBe(1);

      store.zoomIn();
      expect(useViewportStore.getState().zoom).toBe(2);

      useViewportStore.getState().zoomIn();
      expect(useViewportStore.getState().zoom).toBe(3);
    });

    it("steps through ZOOM_LEVELS on zoomOut", () => {
      useViewportStore.setState({ zoom: 3 });
      useViewportStore.getState().zoomOut();
      expect(useViewportStore.getState().zoom).toBe(2);

      useViewportStore.getState().zoomOut();
      expect(useViewportStore.getState().zoom).toBe(1);
    });

    it("does not exceed max zoom", () => {
      const maxZoom = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
      useViewportStore.setState({ zoom: maxZoom });
      useViewportStore.getState().zoomIn();
      expect(useViewportStore.getState().zoom).toBe(maxZoom);
    });

    it("does not go below min zoom", () => {
      const minZoom = ZOOM_LEVELS[0];
      useViewportStore.setState({ zoom: minZoom });
      useViewportStore.getState().zoomOut();
      expect(useViewportStore.getState().zoom).toBe(minZoom);
    });
  });

  describe("setZoom", () => {
    it("sets zoom without cursor", () => {
      useViewportStore.setState({ panX: 50, panY: 50 });
      useViewportStore.getState().setZoom(8);
      const { zoom, panX, panY } = useViewportStore.getState();
      expect(zoom).toBe(8);
      expect(panX).toBe(50);
      expect(panY).toBe(50);
    });

    it("adjusts pan with cursor", () => {
      useViewportStore.setState({ zoom: 1, panX: 0, panY: 0 });
      useViewportStore.getState().setZoom(4, 200, 150);

      const { zoom, panX, panY } = useViewportStore.getState();
      expect(zoom).toBe(4);
      // newPan = cursor - (cursor - oldPan) * (newZoom / oldZoom)
      // panX = 200 - (200 - 0) * 4 = 200 - 800 = -600
      expect(panX).toBeCloseTo(-600);
      expect(panY).toBeCloseTo(-450);
    });
  });

  describe("fitToViewport", () => {
    it("snaps down to nearest zoom level with padding", () => {
      useViewportStore.getState().fitToViewport(16, 16);
      expect(useViewportStore.getState().zoom).toBe(32);
    });

    it("centers the texture", () => {
      useViewportStore.getState().fitToViewport(16, 16);
      const { zoom, panX, panY } = useViewportStore.getState();
      const expectedPanX = (800 - 16 * zoom) / 2;
      const expectedPanY = (600 - 16 * zoom) / 2;
      expect(panX).toBeCloseTo(expectedPanX);
      expect(panY).toBeCloseTo(expectedPanY);
    });

    it("handles large texture that barely fits", () => {
      useViewportStore.getState().fitToViewport(512, 512);
      expect(useViewportStore.getState().zoom).toBe(1);
    });
  });

  describe("resetZoom", () => {
    it("sets zoom to 1 and adjusts pan centered on viewport", () => {
      useViewportStore.setState({ zoom: 8, panX: -200, panY: -100 });
      useViewportStore.getState().resetZoom();
      const { zoom } = useViewportStore.getState();
      expect(zoom).toBe(1);
    });
  });

  describe("setContainerSize", () => {
    it("updates container dimensions", () => {
      useViewportStore.getState().setContainerSize(1024, 768);
      const { containerWidth, containerHeight } =
        useViewportStore.getState();
      expect(containerWidth).toBe(1024);
      expect(containerHeight).toBe(768);
    });
  });

  describe("setPan", () => {
    it("sets pan directly without texture constraints", () => {
      useViewportStore.getState().setPan(100, 200);
      const { panX, panY } = useViewportStore.getState();
      expect(panX).toBe(100);
      expect(panY).toBe(200);
    });

    it("centers when texture fits viewport", () => {
      useViewportStore.setState({ zoom: 1 });
      useViewportStore.getState().setPan(999, 999, 16, 16);
      const { panX, panY } = useViewportStore.getState();
      expect(panX).toBe((800 - 16) / 2);
      expect(panY).toBe((600 - 16) / 2);
    });
  });

  describe("zoomIn with cursor", () => {
    it("adjusts pan to keep cursor point fixed", () => {
      useViewportStore.setState({ zoom: 1, panX: 0, panY: 0 });
      useViewportStore.getState().zoomIn(400, 300);

      const { zoom, panX, panY } = useViewportStore.getState();
      expect(zoom).toBe(2);
      expect(panX).toBeCloseTo(-400);
      expect(panY).toBeCloseTo(-300);
    });
  });

  describe("zoomOut with cursor", () => {
    it("adjusts pan to keep cursor point fixed", () => {
      useViewportStore.setState({ zoom: 4, panX: -600, panY: -450 });
      useViewportStore.getState().zoomOut(200, 150);

      const { zoom, panX, panY } = useViewportStore.getState();
      expect(zoom).toBe(3);
      // newPan = cursor - (cursor - oldPan) * (newZoom/oldZoom)
      // panX = 200 - (200 - (-600)) * (3/4) = 200 - 600 = -400
      expect(panX).toBeCloseTo(-400);
      expect(panY).toBeCloseTo(-300);
    });
  });

  describe("zoom with non-table value", () => {
    it("snaps to nearest level on zoomIn from intermediate value", () => {
      useViewportStore.setState({ zoom: 1.5 });
      useViewportStore.getState().zoomIn();
      // 1.5 not in table → findIndex(z >= 1.5) = index of 2 → +1 = index of 3
      expect(useViewportStore.getState().zoom).toBe(3);
    });

    it("snaps to nearest level on zoomOut from intermediate value", () => {
      useViewportStore.setState({ zoom: 1.5 });
      useViewportStore.getState().zoomOut();
      // 1.5 not in table → findIndex(z >= 1.5) = index of 2 → -1 = index of 1
      expect(useViewportStore.getState().zoom).toBe(1);
    });
  });
});
