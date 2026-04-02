import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

// Mock @dnd-kit — render children without drag behavior
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  defaultDropAnimationSideEffects: vi.fn(() => ({})),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/modifiers", () => ({
  restrictToVerticalAxis: vi.fn(),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: vi.fn(),
  arrayMove: vi.fn((arr: unknown[], from: number, to: number) => {
    const copy = [...arr];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  }),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

import { invoke } from "@tauri-apps/api/core";
import type { EditorStateDto, LayerInfoDto } from "../../api/commands";
import { useEditorStore } from "../../store/editorStore";

const mockedInvoke = vi.mocked(invoke);

function makeLayer(
  id: string,
  name: string,
  overrides?: Partial<LayerInfoDto>,
): LayerInfoDto {
  return {
    id,
    name,
    opacity: 1.0,
    blendMode: "normal",
    visible: true,
    locked: false,
    thumbnail: [],
    ...overrides,
  };
}

function makeReturnState(
  layers: LayerInfoDto[],
  activeLayerId: string | null,
): EditorStateDto {
  return {
    texture: { namespace: "mc", path: "stone", width: 16, height: 16, dirty: true },
    layers,
    activeLayerId,
    canUndo: true,
    canRedo: false,
  };
}

function setStoreState(layers: LayerInfoDto[], activeLayerId: string | null) {
  useEditorStore.setState({
    texture: { namespace: "mc", path: "stone", width: 16, height: 16, dirty: false },
    layers,
    activeLayerId,
    canUndo: false,
    canRedo: false,
  });
}

async function importAndRender() {
  const { LayersPanel } = await import("./LayersPanel");
  return render(<LayersPanel />);
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

describe("LayersPanel", () => {
  it("shows empty state when no texture is open", async () => {
    await importAndRender();
    expect(screen.getByText("No texture open")).toBeDefined();
  });

  it("renders layer rows in reverse order (topmost first)", async () => {
    const layers = [
      makeLayer("a", "Bottom"),
      makeLayer("b", "Middle"),
      makeLayer("c", "Top"),
    ];
    setStoreState(layers, "b");

    await importAndRender();

    const names = screen.getAllByText(/Bottom|Middle|Top/);
    expect(names[0].textContent).toBe("Top");
    expect(names[1].textContent).toBe("Middle");
    expect(names[2].textContent).toBe("Bottom");
  });

  it("renders action buttons when texture is open", async () => {
    setStoreState([makeLayer("a", "Base")], "a");
    await importAndRender();
    expect(screen.getByTitle("Add layer")).toBeDefined();
    expect(screen.getByTitle(/[Dd]elete/)).toBeDefined();
    expect(screen.getByTitle("Duplicate layer")).toBeDefined();
  });

  it("disables delete button when only one layer", async () => {
    setStoreState([makeLayer("a", "Only")], "a");
    await importAndRender();
    const btn = screen.getByTitle("Cannot delete the last layer") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("enables delete button when multiple layers exist", async () => {
    setStoreState([makeLayer("a", "A"), makeLayer("b", "B")], "a");
    await importAndRender();
    const btn = screen.getByTitle("Delete layer") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  // US2: Add
  it("calls addLayer when add button is clicked", async () => {
    mockedInvoke.mockResolvedValueOnce(
      makeReturnState([makeLayer("a", "Base"), makeLayer("b", "Layer 1")], "b"),
    );
    setStoreState([makeLayer("a", "Base")], "a");
    await importAndRender();

    await act(async () => {
      fireEvent.click(screen.getByTitle("Add layer"));
    });

    expect(mockedInvoke).toHaveBeenCalledWith(
      "add_layer",
      expect.objectContaining({ name: expect.any(String) }),
    );
  });

  // US2: Delete
  it("calls removeLayer when delete button is clicked with multiple layers", async () => {
    mockedInvoke.mockResolvedValueOnce(makeReturnState([makeLayer("b", "B")], "b"));
    setStoreState([makeLayer("a", "A"), makeLayer("b", "B")], "a");
    await importAndRender();

    await act(async () => {
      fireEvent.click(screen.getByTitle("Delete layer"));
    });

    expect(mockedInvoke).toHaveBeenCalledWith("remove_layer", { layerId: "a" });
  });

  // US2: Duplicate
  it("calls duplicateLayer when duplicate button is clicked", async () => {
    mockedInvoke.mockResolvedValueOnce(
      makeReturnState([makeLayer("a", "Base"), makeLayer("b", "Base (copy)")], "b"),
    );
    setStoreState([makeLayer("a", "Base")], "a");
    await importAndRender();

    await act(async () => {
      fireEvent.click(screen.getByTitle("Duplicate layer"));
    });

    expect(mockedInvoke).toHaveBeenCalledWith("duplicate_layer", { layerId: "a" });
  });

  // US1: Select layer
  it("selecting a layer updates activeLayerId in store", async () => {
    setStoreState([makeLayer("a", "Bottom"), makeLayer("b", "Top")], "a");
    await importAndRender();

    fireEvent.click(screen.getByText("Top"));

    expect(useEditorStore.getState().activeLayerId).toBe("b");
  });

  // US6: Blend mode change
  it("calls setLayerBlendMode when blend mode is changed", async () => {
    mockedInvoke.mockResolvedValueOnce(
      makeReturnState([makeLayer("a", "Base", { blendMode: "multiply" })], "a"),
    );
    setStoreState([makeLayer("a", "Base")], "a");
    await importAndRender();

    const select = screen.getByRole("combobox");
    await act(async () => {
      fireEvent.change(select, { target: { value: "multiply" } });
    });

    expect(mockedInvoke).toHaveBeenCalledWith("set_layer_blend_mode", {
      layerId: "a",
      blendMode: "multiply",
    });
  });

  // US6: Blend mode reflects active layer
  it("renders blend mode selector for active layer", async () => {
    setStoreState([makeLayer("a", "Base", { blendMode: "screen" })], "a");
    await importAndRender();
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("screen");
  });

  // Error handling
  it("logs error when addLayer fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedInvoke.mockRejectedValueOnce(new Error("IPC failed"));
    setStoreState([makeLayer("a", "Base")], "a");
    await importAndRender();

    await act(async () => {
      fireEvent.click(screen.getByTitle("Add layer"));
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "[LayersPanel] addLayer failed:",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});
