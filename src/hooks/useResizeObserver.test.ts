import { describe, it, expect, beforeEach, vi } from "vitest";
import { useViewportStore } from "../store/viewportStore";

describe("useResizeObserver logic", () => {
  beforeEach(() => {
    useViewportStore.setState({
      zoom: 1,
      panX: 0,
      panY: 0,
      containerWidth: 0,
      containerHeight: 0,
    });
  });

  it("updates container size when ResizeObserver fires", () => {
    // Simulate what the hook does: call setContainerSize on resize
    const setContainerSize = useViewportStore.getState().setContainerSize;
    setContainerSize(1024, 768);

    const { containerWidth, containerHeight } = useViewportStore.getState();
    expect(containerWidth).toBe(1024);
    expect(containerHeight).toBe(768);
  });

  it("handles zero dimensions", () => {
    const setContainerSize = useViewportStore.getState().setContainerSize;
    setContainerSize(0, 0);

    const { containerWidth, containerHeight } = useViewportStore.getState();
    expect(containerWidth).toBe(0);
    expect(containerHeight).toBe(0);
  });

  it("updates dimensions on subsequent resizes", () => {
    const setContainerSize = useViewportStore.getState().setContainerSize;

    setContainerSize(800, 600);
    expect(useViewportStore.getState().containerWidth).toBe(800);

    setContainerSize(1920, 1080);
    expect(useViewportStore.getState().containerWidth).toBe(1920);
    expect(useViewportStore.getState().containerHeight).toBe(1080);
  });
});
