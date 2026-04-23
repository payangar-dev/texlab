import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { usePaletteStore } from "../../store/paletteStore";
import { useToolStore } from "../../store/toolStore";
import { commandRegistry } from "../commandRegistry";
import { registerPaletteCommands } from "../definitions/palette";

const mockedInvoke = vi.mocked(invoke);

// Register once for the whole file — idempotency of registerCommand means we
// cannot call it twice without it throwing.
let registered = false;
function ensureRegistered() {
  if (!registered) {
    registerPaletteCommands();
    registered = true;
  }
}

beforeEach(() => {
  ensureRegistered();
  usePaletteStore.setState({
    palettes: [],
    activePaletteId: null,
    canCreateProjectPalette: false,
    pipetteActive: false,
  });
  useToolStore.setState({
    activeColor: { r: 0, g: 0, b: 0, a: 255 },
    secondaryColor: { r: 255, g: 255, b: 255, a: 255 },
  });
  vi.clearAllMocks();
});

describe("palette.deleteActiveSwatch", () => {
  it("no-ops when primary is not in the active palette", () => {
    usePaletteStore.setState({
      palettes: [{ id: "a", name: "P", scope: "global", colors: ["#FFFFFF"] }],
      activePaletteId: "a",
    });
    const ran = commandRegistry.executeCommand("palette.deleteActiveSwatch");
    expect(ran).toBe(false);
    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  it("invokes remove_color_from_active_palette_at with the matching index", async () => {
    usePaletteStore.setState({
      palettes: [{ id: "a", name: "P", scope: "global", colors: ["#123456", "#000000"] }],
      activePaletteId: "a",
    });
    mockedInvoke.mockResolvedValueOnce({} as never);

    const ran = commandRegistry.executeCommand("palette.deleteActiveSwatch");

    expect(ran).toBe(true);
    expect(mockedInvoke).toHaveBeenCalledWith("remove_color_from_active_palette_at", {
      index: 1,
    });
  });
});

describe("palette.exitPipette", () => {
  it("no-ops when pipette is not active", () => {
    const ran = commandRegistry.executeCommand("palette.exitPipette");
    expect(ran).toBe(false);
  });

  it("clears pipetteActive", () => {
    usePaletteStore.setState({ pipetteActive: true });
    const ran = commandRegistry.executeCommand("palette.exitPipette");
    expect(ran).toBe(true);
    expect(usePaletteStore.getState().pipetteActive).toBe(false);
  });
});
