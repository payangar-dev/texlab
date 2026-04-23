import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockListen = vi.fn();
vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

const mockShowToast = vi.fn();
vi.mock("../utils/toast", () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

import { invoke } from "@tauri-apps/api/core";
import type { PaletteListDto } from "../api/commands";
import { initPaletteListener, usePaletteStore } from "./paletteStore";
import { useToolStore } from "./toolStore";

const mockedInvoke = vi.mocked(invoke);

beforeEach(() => {
  usePaletteStore.setState({
    palettes: [],
    activePaletteId: null,
    canCreateProjectPalette: false,
    pipetteActive: false,
  });
  useToolStore.setState({ activeToolType: "brush" });
  vi.clearAllMocks();
});

describe("paletteStore.refreshState", () => {
  it("populates store from get_palettes", async () => {
    const payload: PaletteListDto = {
      palettes: [{ id: "aa", name: "Blues", scope: "global", colors: ["#112233"] }],
      activePaletteId: "aa",
      canCreateProjectPalette: false,
    };
    mockedInvoke.mockResolvedValueOnce(payload);

    await usePaletteStore.getState().refreshState();

    const state = usePaletteStore.getState();
    expect(mockedInvoke).toHaveBeenCalledWith("get_palettes");
    expect(state.palettes).toHaveLength(1);
    expect(state.activePaletteId).toBe("aa");
    expect(state.canCreateProjectPalette).toBe(false);
  });

  it("clears state on subsequent empty refresh", async () => {
    usePaletteStore.setState({
      palettes: [{ id: "aa", name: "X", scope: "global", colors: [] }],
      activePaletteId: "aa",
    });
    mockedInvoke.mockResolvedValueOnce({
      palettes: [],
      activePaletteId: null,
      canCreateProjectPalette: false,
    } satisfies PaletteListDto);

    await usePaletteStore.getState().refreshState();

    const state = usePaletteStore.getState();
    expect(state.palettes).toEqual([]);
    expect(state.activePaletteId).toBeNull();
  });

  it("logs and toasts on IPC failure without mutating state", async () => {
    usePaletteStore.setState({
      palettes: [{ id: "aa", name: "X", scope: "global", colors: [] }],
      activePaletteId: "aa",
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedInvoke.mockRejectedValueOnce(new Error("boom"));

    await usePaletteStore.getState().refreshState();

    expect(spy).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith("Failed to load palettes.");
    const state = usePaletteStore.getState();
    expect(state.palettes).toHaveLength(1);
    expect(state.activePaletteId).toBe("aa");
    spy.mockRestore();
  });
});

describe("initPaletteListener", () => {
  it("registers a state-changed listener on first call", () => {
    // initPaletteListener is idempotent — must run before any other test
    // that calls it. Downstream `describe` blocks use the already-installed
    // listener rather than re-registering.
    mockListen.mockResolvedValue(() => {});
    initPaletteListener();
    expect(mockListen).toHaveBeenCalledWith("state-changed", expect.any(Function));
  });
});

describe("paletteStore.pipetteActive", () => {
  it("setPipetteActive toggles", () => {
    usePaletteStore.getState().setPipetteActive(true);
    expect(usePaletteStore.getState().pipetteActive).toBe(true);
    usePaletteStore.getState().setPipetteActive(false);
    expect(usePaletteStore.getState().pipetteActive).toBe(false);
  });

  it("reacts to toolStore tool change — exits pipette mode", () => {
    usePaletteStore.getState().setPipetteActive(true);
    useToolStore.setState({ activeToolType: "eraser" });
    expect(usePaletteStore.getState().pipetteActive).toBe(false);
  });
});

describe("paletteStore.getActivePalette", () => {
  it("returns null when nothing is active", () => {
    expect(usePaletteStore.getState().getActivePalette()).toBeNull();
  });

  it("returns the matching palette", () => {
    usePaletteStore.setState({
      palettes: [
        { id: "aa", name: "A", scope: "global", colors: [] },
        { id: "bb", name: "B", scope: "global", colors: [] },
      ],
      activePaletteId: "bb",
    });
    expect(usePaletteStore.getState().getActivePalette()?.name).toBe("B");
  });
});
