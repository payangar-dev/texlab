import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Translate: { toString: () => undefined } },
}));

import { invoke } from "@tauri-apps/api/core";
import type { LayerInfoDto } from "../../api/commands";
import { useEditorStore } from "../../store/editorStore";

const mockedInvoke = vi.mocked(invoke);

function makeLayer(overrides: Partial<LayerInfoDto> = {}): LayerInfoDto {
  return {
    id: "layer1",
    name: "Background",
    opacity: 1.0,
    blendMode: "normal",
    visible: true,
    locked: false,
    thumbnail: [],
    ...overrides,
  };
}

const emptyReturnState = {
  texture: null,
  layers: [],
  activeLayerId: null,
  canUndo: false,
  canRedo: false,
};

async function renderRow(
  layer: LayerInfoDto,
  opts: { isActive?: boolean; onSelect?: (id: string) => void } = {},
) {
  const { LayerRow } = await import("./LayerRow");
  return render(
    <LayerRow
      layer={layer}
      textureWidth={16}
      textureHeight={16}
      isActive={opts.isActive ?? false}
      onSelect={opts.onSelect ?? vi.fn()}
    />,
  );
}

beforeEach(() => {
  useEditorStore.setState({
    texture: null,
    layers: [],
    activeLayerId: null,
    canUndo: false,
    canRedo: false,
  });
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("LayerRow", () => {
  it("renders layer name and opacity", async () => {
    await renderRow(makeLayer({ name: "Details", opacity: 0.75 }));
    expect(screen.getByText("Details")).toBeDefined();
    expect(screen.getByText("75%")).toBeDefined();
  });

  it("renders 100% for full opacity", async () => {
    await renderRow(makeLayer({ opacity: 1.0 }));
    expect(screen.getByText("100%")).toBeDefined();
  });

  it("calls onSelect when row is clicked", async () => {
    const onSelect = vi.fn();
    await renderRow(makeLayer({ id: "abc" }), { onSelect });
    fireEvent.click(screen.getByText("Background"));
    expect(onSelect).toHaveBeenCalledWith("abc");
  });

  // US3: Visibility toggle
  it("toggles visibility when eye icon is clicked", async () => {
    mockedInvoke.mockResolvedValueOnce(emptyReturnState);
    await renderRow(makeLayer({ id: "x", visible: true }));

    const svgs = document.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(svgs[0]);
    });

    expect(mockedInvoke).toHaveBeenCalledWith("set_layer_visibility", {
      layerId: "x",
      visible: false,
    });
  });

  // US5-AS1: Double-click rename
  it("enters rename mode on double-click", async () => {
    await renderRow(makeLayer({ name: "MyLayer" }));
    const nameSpan = screen.getByText("MyLayer");
    fireEvent.doubleClick(nameSpan);
    const input = screen.getByDisplayValue("MyLayer") as HTMLInputElement;
    expect(input).toBeDefined();
  });

  // US5-AS2: F2 rename
  it("enters rename mode on F2 when active", async () => {
    const { container } = await renderRow(makeLayer({ name: "TestLayer" }), {
      isActive: true,
    });
    const row = container.firstElementChild as HTMLElement;
    fireEvent.keyDown(row, { key: "F2" });
    const input = screen.getByDisplayValue("TestLayer") as HTMLInputElement;
    expect(input).toBeDefined();
  });

  it("does not enter rename mode on F2 when inactive", async () => {
    const { container } = await renderRow(makeLayer({ name: "TestLayer" }), {
      isActive: false,
    });
    const row = container.firstElementChild as HTMLElement;
    fireEvent.keyDown(row, { key: "F2" });
    expect(screen.queryByDisplayValue("TestLayer")).toBeNull();
    expect(screen.getByText("TestLayer")).toBeDefined();
  });

  // US5-AS3: Enter confirms
  it("confirms rename on Enter", async () => {
    mockedInvoke.mockResolvedValueOnce(emptyReturnState);
    await renderRow(makeLayer({ id: "r1", name: "Old" }));
    fireEvent.doubleClick(screen.getByText("Old"));
    const input = screen.getByDisplayValue("Old");
    fireEvent.change(input, { target: { value: "New" } });

    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(mockedInvoke).toHaveBeenCalledWith("set_layer_name", {
      layerId: "r1",
      name: "New",
    });
  });

  // US5-AS4: Escape cancels
  it("cancels rename on Escape", async () => {
    await renderRow(makeLayer({ name: "Keep" }));
    fireEvent.doubleClick(screen.getByText("Keep"));
    const input = screen.getByDisplayValue("Keep");
    fireEvent.change(input, { target: { value: "Changed" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByDisplayValue("Changed")).toBeNull();
    expect(screen.getByText("Keep")).toBeDefined();
  });

  // US5-AS5: Blur confirms
  it("confirms rename on blur", async () => {
    mockedInvoke.mockResolvedValueOnce(emptyReturnState);
    await renderRow(makeLayer({ id: "r2", name: "Original" }));
    fireEvent.doubleClick(screen.getByText("Original"));
    const input = screen.getByDisplayValue("Original");
    fireEvent.change(input, { target: { value: "Blurred" } });

    await act(async () => {
      fireEvent.blur(input);
    });

    expect(mockedInvoke).toHaveBeenCalledWith("set_layer_name", {
      layerId: "r2",
      name: "Blurred",
    });
  });

  // Edge case: empty name rejected
  it("rejects empty name on rename", async () => {
    await renderRow(makeLayer({ id: "r3", name: "Valid" }));
    fireEvent.doubleClick(screen.getByText("Valid"));
    const input = screen.getByDisplayValue("Valid");
    fireEvent.change(input, { target: { value: "   " } });

    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  // Edge case: same name is a no-op
  it("does not invoke setLayerName when name unchanged", async () => {
    await renderRow(makeLayer({ id: "r4", name: "Same" }));
    fireEvent.doubleClick(screen.getByText("Same"));
    const input = screen.getByDisplayValue("Same");

    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  // Dimmed row for hidden layers
  it("shows dimmed opacity for hidden layers", async () => {
    const { container } = await renderRow(makeLayer({ visible: false }));
    const row = container.firstElementChild as HTMLElement;
    expect(row.style.opacity).toBe("0.4");
  });

  // Error handling
  it("logs error when visibility toggle fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedInvoke.mockRejectedValueOnce(new Error("fail"));
    await renderRow(makeLayer({ id: "err", visible: true }));

    const svgs = document.querySelectorAll("svg");
    await act(async () => {
      fireEvent.click(svgs[0]);
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "[LayerRow] setLayerVisibility failed:",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});
