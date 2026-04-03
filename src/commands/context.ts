/** Known context keys used in `when` clause evaluation. */
export type ContextKey = "inputFocused" | "dialogOpen";

const contextMap = new Map<string, boolean>();

function isInputElement(el: Element): boolean {
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  return el instanceof HTMLElement && el.isContentEditable;
}

export function initContext(): () => void {
  const onFocusIn = (e: FocusEvent) => {
    const target = e.target as Element | null;
    if (target && isInputElement(target)) {
      contextMap.set("inputFocused", true);
    }
  };

  const onFocusOut = (e: FocusEvent) => {
    const related = e.relatedTarget as Element | null;
    if (related && isInputElement(related)) return;
    contextMap.set("inputFocused", false);
  };

  window.addEventListener("focusin", onFocusIn);
  window.addEventListener("focusout", onFocusOut);

  return () => {
    window.removeEventListener("focusin", onFocusIn);
    window.removeEventListener("focusout", onFocusOut);
    contextMap.clear();
  };
}

export function getContext(): Map<string, boolean> {
  contextMap.set("dialogOpen", document.querySelector("dialog[open]") !== null);
  return contextMap;
}

/**
 * Evaluate a `when` clause against the current context map.
 *
 * Supports conjunction (`&&`) and negation (`!`). No `||` or parentheses.
 * Examples: `"!inputFocused && !dialogOpen"`, `"inputFocused"`, `"!dialogOpen"`.
 *
 * Returns `true` if `when` is `null` (always match — used by keybindings that
 * bypass context suppression).
 */
export function evaluateWhen(
  when: string | null,
  context: Map<string, boolean>,
): boolean {
  if (when === null) return true;

  return when.split("&&").every((token) => {
    const t = token.trim();
    if (t === "") return true;
    const negated = t.startsWith("!");
    const key = negated ? t.slice(1) : t;
    return negated ? !context.get(key) : Boolean(context.get(key));
  });
}
