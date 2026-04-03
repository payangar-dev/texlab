import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandRegistry } from "../commandRegistry";
import { KeybindingRegistry, normalizeKeyEvent } from "../keybindingRegistry";

/**
 * Integration test for the dispatcher pipeline logic.
 * We test the keydown/keyup pipeline manually (without React hooks)
 * to validate: normalize → context → findMatch → precondition → execute.
 */
describe("Dispatcher pipeline", () => {
  let cmdRegistry: CommandRegistry;
  let kbRegistry: KeybindingRegistry;
  beforeEach(() => {
    cmdRegistry = new CommandRegistry();
    kbRegistry = new KeybindingRegistry();
  });

  // Simulates the keydown pipeline from dispatcher.ts
  function dispatchKeyDown(e: KeyboardEvent): boolean {
    if (e.repeat) return false;

    const key = normalizeKeyEvent(e);
    if (!key) return false;

    // We replicate the findMatch pipeline using our local registries
    // (the real findMatch reads from the singleton commandRegistry).
    for (const binding of kbRegistry.getAllKeybindings()) {
      if (binding.key !== key) continue;
      if ((binding.trigger ?? "keydown") !== "keydown") continue;

      const cmd = cmdRegistry.getCommand(binding.commandId);
      if (!cmd) continue;
      if (cmd.precondition && !cmd.precondition()) return false;

      e.preventDefault();
      cmd.execute();
      return true;
    }
    return false;
  }

  it("dispatches a simple key to the matching command", () => {
    const execute = vi.fn();
    cmdRegistry.registerCommand({ id: "test.b", label: "B", category: "tools", execute });
    kbRegistry.registerKeybinding({ key: "b", commandId: "test.b", when: null });

    const event = new KeyboardEvent("keydown", { key: "b", bubbles: true });
    const preventDefault = vi.spyOn(event, "preventDefault");

    const handled = dispatchKeyDown(event);
    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalled();
  });

  it("skips repeated key events", () => {
    const execute = vi.fn();
    cmdRegistry.registerCommand({
      id: "test.rep",
      label: "Rep",
      category: "tools",
      execute,
    });
    kbRegistry.registerKeybinding({ key: "b", commandId: "test.rep", when: null });

    const event = new KeyboardEvent("keydown", { key: "b", repeat: true, bubbles: true });
    expect(dispatchKeyDown(event)).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it("skips modifier-only key events", () => {
    const execute = vi.fn();
    cmdRegistry.registerCommand({
      id: "test.mod",
      label: "Mod",
      category: "tools",
      execute,
    });
    kbRegistry.registerKeybinding({ key: "Control", commandId: "test.mod", when: null });

    const event = new KeyboardEvent("keydown", { key: "Control", bubbles: true });
    expect(dispatchKeyDown(event)).toBe(false);
  });

  it("respects precondition: does not execute when precondition fails", () => {
    const execute = vi.fn();
    cmdRegistry.registerCommand({
      id: "test.pre",
      label: "Pre",
      category: "layers",
      execute,
      precondition: () => false,
    });
    kbRegistry.registerKeybinding({ key: "Delete", commandId: "test.pre", when: null });

    const event = new KeyboardEvent("keydown", { key: "Delete", bubbles: true });
    expect(dispatchKeyDown(event)).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it("does not preventDefault when no match found", () => {
    const event = new KeyboardEvent("keydown", { key: "q", bubbles: true });
    const preventDefault = vi.spyOn(event, "preventDefault");

    expect(dispatchKeyDown(event)).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
