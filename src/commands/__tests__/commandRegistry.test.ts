import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandRegistry } from "../commandRegistry";

describe("CommandRegistry", () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  it("registers and retrieves a command", () => {
    const cmd = {
      id: "test.cmd",
      label: "Test",
      category: "tools" as const,
      execute: vi.fn(),
    };
    registry.registerCommand(cmd);
    expect(registry.getCommand("test.cmd")).toBe(cmd);
  });

  it("throws on duplicate registration", () => {
    const cmd = {
      id: "test.cmd",
      label: "Test",
      category: "tools" as const,
      execute: vi.fn(),
    };
    registry.registerCommand(cmd);
    expect(() => registry.registerCommand(cmd)).toThrow(
      'Command "test.cmd" is already registered',
    );
  });

  it("returns undefined for unknown command", () => {
    expect(registry.getCommand("unknown")).toBeUndefined();
  });

  it("executeCommand calls execute and returns true", () => {
    const execute = vi.fn();
    registry.registerCommand({
      id: "test.exec",
      label: "Exec",
      category: "edit",
      execute,
    });
    expect(registry.executeCommand("test.exec")).toBe(true);
    expect(execute).toHaveBeenCalledOnce();
  });

  it("executeCommand checks precondition before calling execute", () => {
    const execute = vi.fn();
    const precondition = vi.fn(() => true);
    registry.registerCommand({
      id: "test.pre",
      label: "Pre",
      category: "edit",
      execute,
      precondition,
    });
    registry.executeCommand("test.pre");
    expect(precondition).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
  });

  it("executeCommand returns false when precondition fails", () => {
    const execute = vi.fn();
    registry.registerCommand({
      id: "test.fail",
      label: "Fail",
      category: "edit",
      execute,
      precondition: () => false,
    });
    expect(registry.executeCommand("test.fail")).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it("executeCommand returns false for unregistered command", () => {
    expect(registry.executeCommand("nope")).toBe(false);
  });

  it("getAllCommands returns commands sorted by category then label", () => {
    registry.registerCommand({
      id: "view.zoom",
      label: "Zoom",
      category: "view",
      execute: vi.fn(),
    });
    registry.registerCommand({
      id: "edit.undo",
      label: "Undo",
      category: "edit",
      execute: vi.fn(),
    });
    registry.registerCommand({
      id: "edit.redo",
      label: "Redo",
      category: "edit",
      execute: vi.fn(),
    });

    const all = registry.getAllCommands();
    expect(all.map((c) => c.id)).toEqual(["edit.redo", "edit.undo", "view.zoom"]);
  });

  it("getCommandsByCategory returns filtered commands sorted by label", () => {
    registry.registerCommand({
      id: "tools.brush",
      label: "Brush",
      category: "tools",
      execute: vi.fn(),
    });
    registry.registerCommand({
      id: "tools.eraser",
      label: "Eraser",
      category: "tools",
      execute: vi.fn(),
    });
    registry.registerCommand({
      id: "edit.undo",
      label: "Undo",
      category: "edit",
      execute: vi.fn(),
    });

    const tools = registry.getCommandsByCategory("tools");
    expect(tools.map((c) => c.id)).toEqual(["tools.brush", "tools.eraser"]);
  });

  it("getCommandsByCategory returns empty array for unused category", () => {
    expect(registry.getCommandsByCategory("layers")).toEqual([]);
  });

  it("getCategories returns categories with at least one command", () => {
    registry.registerCommand({
      id: "tools.brush",
      label: "Brush",
      category: "tools",
      execute: vi.fn(),
    });
    registry.registerCommand({
      id: "edit.undo",
      label: "Undo",
      category: "edit",
      execute: vi.fn(),
    });
    registry.registerCommand({
      id: "view.zoom",
      label: "Zoom",
      category: "view",
      execute: vi.fn(),
    });

    expect(registry.getCategories()).toEqual(["edit", "tools", "view"]);
  });

  it("getCategories returns empty array when no commands registered", () => {
    expect(registry.getCategories()).toEqual([]);
  });
});
