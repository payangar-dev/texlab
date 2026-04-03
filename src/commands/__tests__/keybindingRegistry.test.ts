import { beforeEach, describe, expect, it, vi } from "vitest";
import { commandRegistry as singletonCommandRegistry } from "../commandRegistry";
import { KeybindingRegistry } from "../keybindingRegistry";

describe("KeybindingRegistry", () => {
  let kbRegistry: KeybindingRegistry;

  beforeEach(() => {
    kbRegistry = new KeybindingRegistry();
  });

  it("getKeybindingsForCommand returns matching bindings", () => {
    kbRegistry.registerKeybinding({ key: "Mod+z", commandId: "edit.undo" });
    kbRegistry.registerKeybinding({ key: "Mod+Shift+z", commandId: "edit.redo" });
    kbRegistry.registerKeybinding({ key: "Mod+y", commandId: "edit.redo" });

    expect(kbRegistry.getKeybindingsForCommand("edit.redo")).toHaveLength(2);
    expect(kbRegistry.getKeybindingsForCommand("edit.undo")).toHaveLength(1);
    expect(kbRegistry.getKeybindingsForCommand("unknown")).toHaveLength(0);
  });

  it("getAllKeybindings returns all registered bindings", () => {
    kbRegistry.registerKeybinding({ key: "a", commandId: "cmd.a" });
    kbRegistry.registerKeybinding({ key: "b", commandId: "cmd.b" });

    expect(kbRegistry.getAllKeybindings()).toHaveLength(2);
  });

  it("getAllKeybindings returns a copy, not the internal array", () => {
    kbRegistry.registerKeybinding({ key: "a", commandId: "cmd.a" });
    const all = kbRegistry.getAllKeybindings();
    all.push({ key: "fake", commandId: "fake" });
    expect(kbRegistry.getAllKeybindings()).toHaveLength(1);
  });
});

describe("KeybindingRegistry conflict detection", () => {
  it("warns on duplicate key+trigger+when registration", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const kbRegistry = new KeybindingRegistry();

    kbRegistry.registerKeybinding({ key: "Mod+s", commandId: "conflict.a" });
    kbRegistry.registerKeybinding({ key: "Mod+s", commandId: "conflict.b" });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Conflict"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("unreachable"));
    warnSpy.mockRestore();
  });

  it("does not warn when same key has different when clauses", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const kbRegistry = new KeybindingRegistry();

    kbRegistry.registerKeybinding({
      key: "Mod+d",
      commandId: "cmd.c",
      when: "inputFocused",
    });
    kbRegistry.registerKeybinding({
      key: "Mod+d",
      commandId: "cmd.d",
      when: "!inputFocused",
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("does not warn when same key has different triggers", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const kbRegistry = new KeybindingRegistry();

    kbRegistry.registerKeybinding({
      key: "Space",
      commandId: "cmd.down",
      trigger: "keydown",
    });
    kbRegistry.registerKeybinding({
      key: "Space",
      commandId: "cmd.up",
      trigger: "keyup",
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("KeybindingRegistry.findMatch (integration with singleton)", () => {
  // These tests use the real singleton commandRegistry because findMatch
  // internally calls commandRegistry.getCommand(). Each test registers
  // unique command IDs to avoid cross-test pollution.
  let kbRegistry: KeybindingRegistry;
  let idCounter = 0;

  function uniqueId(prefix: string): string {
    return `${prefix}.${++idCounter}`;
  }

  beforeEach(() => {
    kbRegistry = new KeybindingRegistry();
  });

  it("finds match when key, trigger, and context all match", () => {
    const id = uniqueId("int.match");
    singletonCommandRegistry.registerCommand({
      id,
      label: "Match",
      category: "tools",
      execute: vi.fn(),
    });
    kbRegistry.registerKeybinding({ key: "Mod+z", commandId: id });

    const ctx = new Map([
      ["inputFocused", false],
      ["dialogOpen", false],
    ]);
    const match = kbRegistry.findMatch("Mod+z", "keydown", ctx);
    expect(match).toBeDefined();
    expect(match!.command.id).toBe(id);
  });

  it("returns undefined when context fails default when clause", () => {
    const id = uniqueId("int.suppress");
    singletonCommandRegistry.registerCommand({
      id,
      label: "Suppress",
      category: "tools",
      execute: vi.fn(),
    });
    kbRegistry.registerKeybinding({ key: "b", commandId: id });

    const ctx = new Map([
      ["inputFocused", true],
      ["dialogOpen", false],
    ]);
    expect(kbRegistry.findMatch("b", "keydown", ctx)).toBeUndefined();
  });

  it("when: null bypasses context suppression", () => {
    const id = uniqueId("int.bypass");
    singletonCommandRegistry.registerCommand({
      id,
      label: "Bypass",
      category: "view",
      execute: vi.fn(),
    });
    kbRegistry.registerKeybinding({ key: "Mod+=", commandId: id, when: null });

    const ctx = new Map([
      ["inputFocused", true],
      ["dialogOpen", true],
    ]);
    const match = kbRegistry.findMatch("Mod+=", "keydown", ctx);
    expect(match).toBeDefined();
  });

  it("respects trigger type — keyup binding does not match keydown", () => {
    const id = uniqueId("int.keyup");
    singletonCommandRegistry.registerCommand({
      id,
      label: "KeyUp",
      category: "view",
      execute: vi.fn(),
    });
    kbRegistry.registerKeybinding({
      key: "Space",
      commandId: id,
      trigger: "keyup",
      when: null,
    });

    const ctx = new Map<string, boolean>();
    expect(kbRegistry.findMatch("Space", "keydown", ctx)).toBeUndefined();
  });

  it("keyup binding matches on keyup trigger", () => {
    const id = uniqueId("int.keyup2");
    singletonCommandRegistry.registerCommand({
      id,
      label: "KeyUp2",
      category: "view",
      execute: vi.fn(),
    });
    kbRegistry.registerKeybinding({
      key: "Space",
      commandId: id,
      trigger: "keyup",
      when: null,
    });

    const ctx = new Map<string, boolean>();
    const match = kbRegistry.findMatch("Space", "keyup", ctx);
    expect(match).toBeDefined();
    expect(match!.command.id).toBe(id);
  });

  it("warns when keybinding references unknown command", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    kbRegistry.registerKeybinding({ key: "q", commandId: "nonexistent.cmd", when: null });

    const ctx = new Map<string, boolean>();
    const match = kbRegistry.findMatch("q", "keydown", ctx);
    expect(match).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("unknown command"));
    warnSpy.mockRestore();
  });
});
