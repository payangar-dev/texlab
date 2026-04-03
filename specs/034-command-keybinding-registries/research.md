# Research: Command & Keybinding Registries

**Feature**: 034-command-keybinding-registries
**Date**: 2026-04-03

## R1 — Key Event Normalization

### Decision
Use `e.key` for character-based shortcuts (letters, symbols) and `e.code` for positional keys (Space). This matches the current codebase approach.

### Canonical Format
`Mod+Shift+Z` — PascalCase modifiers in fixed order `Mod > Alt > Shift > Key`.

- `Mod` = Ctrl on Windows/Linux, Cmd on macOS (resolved at dispatch time via `e.ctrlKey || e.metaKey`)
- Single-character keys stored lowercase: `Mod+z`, `b`, `x`
- Special keys use their `e.code` label: `Space`, `Delete`, `BracketLeft`, `BracketRight`
- Modifier-only events (pressing just Ctrl) are ignored

### Shift + Symbol Key Handling
When Shift is held, `e.key` changes for symbol keys (`=` → `+`, `[` → `{`). To normalize:
- For symbol keys affected by Shift, use an `e.code → base key` map: `Equal → =`, `Minus → -`, `BracketLeft → [`, `BracketRight → ]`
- A keybinding registered as `Mod+=` matches both `Ctrl+=` and `Ctrl+Shift+=` (since `+` is Shift+=)
- This avoids ambiguity and matches user expectations

### Rationale
- `e.key` is layout-aware (AZERTY users press the correct character, not position)
- `e.code` is layout-independent, correct for Space/Delete where physical position matters
- VS Code uses `e.code` + native keymap modules, but that's heavyweight overkill for our ~25 shortcuts
- The existing code already uses this mixed approach, minimizing migration risk

### Alternatives Considered
- **`e.code` only**: Would break for non-QWERTY layouts (B key is in a different position on AZERTY)
- **Mousetrap/tinykeys library**: Added dependency for ~50 lines of normalization logic — not justified per Simplicity principle
- **Full `e.code` + keymap resolution** (VS Code approach): Requires native module, far too complex for our needs

## R2 — When Clause / Context System

### Decision
Simple conjunction-based `when` clauses with boolean context keys. Format: `!inputFocused && !dialogOpen`. No `||`, no comparisons, no expressions.

### Context Keys (initial set)

| Key | Type | Description | How Maintained |
|-----|------|-------------|----------------|
| `inputFocused` | boolean | INPUT, TEXTAREA, or contentEditable is focused | `focusin`/`focusout` event listeners |
| `dialogOpen` | boolean | A modal dialog is currently open | React state / DOM `dialog[open]` check |

Future (NOT implemented now):
- `activePanel.layers`, `activePanel.canvas` — derived from dockview `api.onDidActivePanelChange`
- `hasActiveTexture`, `hasSelection` — derived from Zustand stores

### Context Storage
A plain `Map<string, boolean>` singleton outside React. Not a Zustand store — this is ephemeral UI-only state that doesn't need subscription-based reactivity.

### Evaluation
Lazy per-keypress evaluation against the pre-built context map:
```
clause.split("&&").every(token => {
  const t = token.trim();
  const negated = t.startsWith("!");
  const key = negated ? t.slice(1) : t;
  return negated ? !ctx.get(key) : Boolean(ctx.get(key));
});
```

### Default Behavior
If a keybinding has no `when` clause, it defaults to `!inputFocused && !dialogOpen` — matching current suppression behavior. Keybindings that need to fire in input contexts set `when: undefined` explicitly (opt-in, not the default).

### Rationale
- VS Code's full expression language (`||`, `==`, `!=`, `=~`, `in`) serves its extension ecosystem — overkill for a single app
- Conjunction-only covers all current and foreseeable use cases
- Eager context maintenance (via event listeners) is simpler and faster than DOM queries on every keystroke
- Plain Map singleton avoids React re-renders for state that only the dispatcher reads

### Alternatives Considered
- **Full expression parser**: Complexity not justified for ~2 context keys
- **Zustand store for context**: Would cause unnecessary re-renders in subscribed components
- **Lazy DOM queries on every keypress**: Slower and more fragile, especially for `dialog[open]` detection

## R3 — Hold-to-Activate Commands (Space-to-Pan)

### Decision
Model as two separate commands: `view.panStart` (fires on keydown) and `view.panEnd` (fires on keyup). The keybinding registry supports a `trigger` field: `"keydown"` (default) or `"keyup"`.

### State Management
The `spaceHeldRef` (currently a React ref shared between hooks) becomes internal state within the pan commands:
- `view.panStart.execute()` → sets a module-level flag or context key `panHeld = true`
- `view.panEnd.execute()` → sets `panHeld = false`
- `useViewportControls` reads this state to determine cursor and pan behavior

### Repeat Key Handling
The dispatcher ignores `e.repeat === true` by default. Space held down fires continuous keydown events — only the first matters. No command needs repeat behavior in the current scope.

### Rationale
- Two commands keeps the interface uniform: every command has exactly one `execute()`
- An `onRelease` callback on commands would couple them to keyboard semantics, breaking the abstraction if pan is later triggered from a toolbar button
- VS Code and Blender both model hold-to-activate as paired events, not special command types

### Alternatives Considered
- **Single command with `onRelease` callback**: Couples command to keyboard lifecycle, less composable
- **Context key approach** (space-held as context): Would work but adds indirection for a simple boolean flag
- **Separate "pan mode" toggle**: More complex, doesn't match the "hold to temporarily pan" UX

## R4 — Conflict Detection

### Decision
At registration time, when adding a keybinding:
1. Check if another keybinding with the same normalized key combination exists
2. If both have identical or both have no `when` clause → conflict (console warning)
3. If they have different `when` clauses → no conflict (same key is valid in different contexts)

### Rationale
- Simple enough for ~30 keybindings
- Catches real bugs (two commands claiming the same shortcut)
- Doesn't false-positive on intentional context-based overloading
- Console warning (not error) — doesn't break the app, just alerts developers

### Alternatives Considered
- **Runtime error on conflict**: Too disruptive for development
- **Deep `when` clause overlap analysis**: Would need to evaluate if contexts can co-occur — over-engineering for the current scale

## R5 — Dispatcher Architecture

### Decision
A single `useCommandDispatcher()` hook mounted once in `AppShell`. It:
1. Registers one `window.addEventListener("keydown", ...)` and one `window.addEventListener("keyup", ...)`
2. On keydown: normalizes event → checks repeat → evaluates context → looks up keybinding → checks precondition → executes command
3. On keyup: same pipeline but only matches keybindings with `trigger: "keyup"`
4. Calls `e.preventDefault()` if a command was matched and executed

### Why AppShell, Not CanvasViewport
The current `useKeyboardShortcuts` is mounted in CanvasViewport, but all its shortcuts are global (window-level). Moving to AppShell is more semantically correct — the dispatcher is app-level infrastructure, not canvas-specific.

### `requestRedraw` Integration
Zoom commands currently call `requestRedraw()` after mutating viewport state. In the new system, commands that affect rendering will either:
- Call `requestRedraw` themselves (passed during command registration)
- Or trigger a Zustand state change that the canvas already subscribes to

The simplest approach: pass `requestRedraw` as a dependency during command initialization. This mirrors the current pattern without adding complexity.

### `finalizeActiveStroke` Integration
Tool-switching commands call `finalizeActiveStroke()` before changing tools. This is preserved: the tool command definitions import and call `finalizeActiveStroke` from CanvasViewport, same as the current code.
