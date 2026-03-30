import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { loadLayout, resetLayout, saveLayout } from "./layoutStore";

const mockedInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveLayout", () => {
  it("serializes layout with version and calls save command", async () => {
    mockedInvoke.mockResolvedValueOnce(undefined);

    const mockApi = {
      toJSON: () => ({ grid: {}, panels: {}, activeGroup: "g1" }),
    } as never;

    await saveLayout(mockApi);

    expect(mockedInvoke).toHaveBeenCalledWith("save_workspace_layout", {
      layoutJson: expect.stringContaining('"version":1'),
    });

    const savedJson = JSON.parse(
      (mockedInvoke.mock.calls[0][1] as Record<string, string>).layoutJson,
    );
    expect(savedJson.version).toBe(1);
    expect(savedJson.dockview).toEqual({ grid: {}, panels: {}, activeGroup: "g1" });
  });

  it("propagates errors from invoke", async () => {
    mockedInvoke.mockRejectedValueOnce(new Error("disk full"));

    const mockApi = { toJSON: () => ({}) } as never;

    await expect(saveLayout(mockApi)).rejects.toThrow("disk full");
  });
});

describe("loadLayout", () => {
  it("returns parsed dockview layout when valid", async () => {
    const workspace = {
      version: 1,
      dockview: { grid: {}, panels: {}, activeGroup: "g1" },
    };
    mockedInvoke.mockResolvedValueOnce(JSON.stringify(workspace));

    const result = await loadLayout();

    expect(mockedInvoke).toHaveBeenCalledWith("load_workspace_layout");
    expect(result).toEqual(workspace.dockview);
  });

  it("returns null when no saved data", async () => {
    mockedInvoke.mockResolvedValueOnce(null);

    const result = await loadLayout();
    expect(result).toBeNull();
  });

  it("returns null on invalid JSON", async () => {
    mockedInvoke.mockResolvedValueOnce("{broken json!!!");

    const result = await loadLayout();
    expect(result).toBeNull();
  });

  it("returns null on incompatible version", async () => {
    const workspace = { version: 999, dockview: {} };
    mockedInvoke.mockResolvedValueOnce(JSON.stringify(workspace));

    const result = await loadLayout();
    expect(result).toBeNull();
  });

  it("returns null when dockview field is missing", async () => {
    const workspace = { version: 1 };
    mockedInvoke.mockResolvedValueOnce(JSON.stringify(workspace));

    const result = await loadLayout();
    expect(result).toBeNull();
  });
});

describe("resetLayout", () => {
  it("saves version 0 sentinel to invalidate layout", async () => {
    mockedInvoke.mockResolvedValueOnce(undefined);

    await resetLayout();

    expect(mockedInvoke).toHaveBeenCalledWith("save_workspace_layout", {
      layoutJson: JSON.stringify({ version: 0 }),
    });
  });

  it("reset then load returns null (round-trip)", async () => {
    // Simulate reset writing version 0
    mockedInvoke.mockResolvedValueOnce(undefined);
    await resetLayout();

    // Simulate load reading what reset wrote
    const resetSentinel = (mockedInvoke.mock.calls[0][1] as Record<string, string>)
      .layoutJson;
    mockedInvoke.mockResolvedValueOnce(resetSentinel);

    const result = await loadLayout();
    expect(result).toBeNull();
  });
});

describe("round-trip", () => {
  it("saveLayout output is correctly consumed by loadLayout", async () => {
    const dockviewData = { grid: { root: {} }, panels: { p1: {} }, activeGroup: "g1" };
    const mockApi = { toJSON: () => dockviewData } as never;

    mockedInvoke.mockResolvedValueOnce(undefined);
    await saveLayout(mockApi);

    const savedJson = (mockedInvoke.mock.calls[0][1] as Record<string, string>)
      .layoutJson;
    mockedInvoke.mockResolvedValueOnce(savedJson);

    const loaded = await loadLayout();
    expect(loaded).toEqual(dockviewData);
  });
});
