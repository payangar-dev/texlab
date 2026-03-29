import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "../../store/editorStore";
import { useViewportStore } from "../../store/viewportStore";
import StatusBar from "./StatusBar";

let capturedCursorCallback: ((pixel: { x: number; y: number } | null) => void) | null =
  null;

vi.mock("../canvas/CanvasViewport", () => ({
  subscribeToCursor: (cb: (pixel: { x: number; y: number } | null) => void) => {
    capturedCursorCallback = cb;
    return () => {
      capturedCursorCallback = null;
    };
  },
}));

function resetStores() {
  useViewportStore.setState({
    zoom: 1,
    panX: 0,
    panY: 0,
    containerWidth: 800,
    containerHeight: 600,
  });
  useEditorStore.setState({
    texture: null,
    layers: [],
    activeLayerId: null,
    canUndo: false,
    canRedo: false,
  });
}

describe("StatusBar", () => {
  beforeEach(() => {
    resetStores();
    capturedCursorCallback = null;
  });

  afterEach(cleanup);

  it("displays zoom percentage", () => {
    useViewportStore.setState({ zoom: 4 });
    render(<StatusBar />);
    expect(screen.getByText("400%")).toBeDefined();
  });

  it("displays texture dimensions when loaded", () => {
    useEditorStore.setState({
      texture: { namespace: "mc", path: "stone", width: 16, height: 16, dirty: false },
    });
    render(<StatusBar />);
    expect(screen.getByText("16 × 16")).toBeDefined();
  });

  it("shows no dimensions when no texture", () => {
    render(<StatusBar />);
    expect(screen.queryByText(/\d+ × \d+/)).toBeNull();
  });

  it("displays cursor coordinates when cursor is over texture", () => {
    render(<StatusBar />);
    act(() => {
      capturedCursorCallback?.({ x: 7, y: 3 });
    });
    expect(screen.getByText("X: 7 Y: 3")).toBeDefined();
  });

  it("clears cursor coordinates when cursor leaves texture", () => {
    render(<StatusBar />);
    act(() => {
      capturedCursorCallback?.({ x: 5, y: 5 });
    });
    expect(screen.getByText("X: 5 Y: 5")).toBeDefined();

    act(() => {
      capturedCursorCallback?.(null);
    });
    expect(screen.queryByText(/X: \d+/)).toBeNull();
  });

  it("updates zoom display reactively", () => {
    render(<StatusBar />);
    expect(screen.getByText("100%")).toBeDefined();

    act(() => {
      useViewportStore.setState({ zoom: 8 });
    });
    expect(screen.getByText("800%")).toBeDefined();
  });

  it("displays fractional zoom as rounded percentage", () => {
    useViewportStore.setState({ zoom: 0.33 });
    render(<StatusBar />);
    expect(screen.getByText("33%")).toBeDefined();
  });
});
