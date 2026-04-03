import { useEffect } from "react";
import { getContext, initContext } from "./context";
import { keybindingRegistry, normalizeKeyEvent } from "./keybindingRegistry";

export function useCommandDispatcher(): void {
  useEffect(() => {
    const cleanupContext = initContext();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const key = normalizeKeyEvent(e);
      if (!key) return;

      const context = getContext();
      const match = keybindingRegistry.findMatch(key, "keydown", context);
      if (!match) return;

      if (match.command.precondition && !match.command.precondition()) return;

      e.preventDefault();
      try {
        match.command.execute();
      } catch (err) {
        console.error(`[CommandDispatcher] Command "${match.command.id}" threw:`, err);
      }
    };

    // Keyup does NOT check preconditions: once a key-held action started (e.g.
    // space-to-pan), its release handler must always fire to clean up state,
    // regardless of whether context changed while the key was held.
    const onKeyUp = (e: KeyboardEvent) => {
      const key = normalizeKeyEvent(e);
      if (!key) return;

      const context = getContext();
      const match = keybindingRegistry.findMatch(key, "keyup", context);
      if (!match) return;

      try {
        match.command.execute();
      } catch (err) {
        console.error(
          `[CommandDispatcher] Command "${match.command.id}" threw on keyup:`,
          err,
        );
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      cleanupContext();
    };
  }, []);
}
