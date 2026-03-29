import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockListen = vi.fn();
vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

import { invoke } from "@tauri-apps/api/core";
import type { EditorStateDto } from "../api/commands";
import { initEditorListener, useEditorStore } from "./editorStore";

const mockedInvoke = vi.mocked(invoke);

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

describe("editorStore", () => {
  it("starts with empty state", () => {
    const state = useEditorStore.getState();
    expect(state.texture).toBeNull();
    expect(state.layers).toEqual([]);
    expect(state.activeLayerId).toBeNull();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
  });

  it("refreshState fetches state from Rust and updates store", async () => {
    const mockState: EditorStateDto = {
      texture: {
        namespace: "minecraft",
        path: "block/stone",
        width: 16,
        height: 16,
        dirty: false,
      },
      layers: [
        {
          id: "abc123",
          name: "Background",
          opacity: 1.0,
          blendMode: "normal",
          visible: true,
          locked: false,
        },
      ],
      activeLayerId: "abc123",
      canUndo: true,
      canRedo: false,
    };

    mockedInvoke.mockResolvedValueOnce(mockState);

    await useEditorStore.getState().refreshState();

    const state = useEditorStore.getState();
    expect(mockedInvoke).toHaveBeenCalledWith("get_editor_state");
    expect(state.texture?.namespace).toBe("minecraft");
    expect(state.layers).toHaveLength(1);
    expect(state.activeLayerId).toBe("abc123");
    expect(state.canUndo).toBe(true);
  });

  it("refreshState with null texture sets empty state", async () => {
    const emptyState: EditorStateDto = {
      texture: null,
      layers: [],
      activeLayerId: null,
      canUndo: false,
      canRedo: false,
    };

    mockedInvoke.mockResolvedValueOnce(emptyState);

    await useEditorStore.getState().refreshState();

    const state = useEditorStore.getState();
    expect(state.texture).toBeNull();
    expect(state.layers).toEqual([]);
    expect(state.activeLayerId).toBeNull();
  });

  it("refreshState handles errors gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedInvoke.mockRejectedValueOnce(new Error("IPC failed"));

    await useEditorStore.getState().refreshState();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[editorStore] failed to refresh state:",
      expect.any(Error),
    );

    // Store should remain unchanged
    expect(useEditorStore.getState().texture).toBeNull();
    consoleSpy.mockRestore();
  });
});

describe("initEditorListener", () => {
  it("registers a state-changed listener via listen()", () => {
    mockListen.mockResolvedValue(() => {});

    initEditorListener();

    expect(mockListen).toHaveBeenCalledWith("state-changed", expect.any(Function));
  });
});
