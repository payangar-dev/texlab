# Contract: `src/styles/applyThemeToRoot.ts`

Replaces `src/styles/dockview-theme.css` as the source of dockview and app-level CSS custom properties. Called once at app startup.

## File location

`src/styles/applyThemeToRoot.ts` — colocated with the theme module and the remaining structural dockview CSS.

## Signature

```ts
export function applyThemeToRoot(root?: HTMLElement): void;
```

- `root` — defaults to `document.documentElement`. Injected for unit testing.
- Returns `void`. Side effect is assigning CSS custom properties via `root.style.setProperty(name, value)`.

## Call site

`src/main.tsx`, before the React root renders:

```ts
import { applyThemeToRoot } from "./styles/applyThemeToRoot";
applyThemeToRoot();
```

The existing `initEditorListener()` call remains in place; ordering between the two does not matter (neither reads the other's output).

## Properties it sets

All values read from `theme.ts`. Order of assignment is stable (alphabetical by variable name) for deterministic tests.

### Dockview variables (replace `src/styles/dockview-theme.css`)

| CSS custom property | Value expression |
|---|---|
| `--dv-active-sash-color` | `colors.transparent` |
| `--dv-activegroup-hiddenpanel-tab-background-color` | `colors.panelBody` |
| `--dv-activegroup-hiddenpanel-tab-color` | `colors.textMuted` |
| `--dv-activegroup-visiblepanel-tab-background-color` | `colors.panelHeader` |
| `--dv-activegroup-visiblepanel-tab-color` | `colors.textTitle` |
| `--dv-background-color` | `colors.shellBackground` |
| `--dv-border-radius` | `` `${radii.none}px` `` |
| `--dv-drag-over-background-color` | `colors.accentTranslucent15` |
| `--dv-drag-over-border-color` | `colors.accent` |
| `--dv-font-family` | `fonts.ui` |
| `--dv-group-view-background-color` | `colors.panelBody` |
| `--dv-icon-hover-background-color` | `colors.overlayHover08` |
| `--dv-inactivegroup-hiddenpanel-tab-background-color` | `colors.panelBody` |
| `--dv-inactivegroup-hiddenpanel-tab-color` | `colors.textMuted` |
| `--dv-inactivegroup-visiblepanel-tab-background-color` | `colors.panelHeader` |
| `--dv-inactivegroup-visiblepanel-tab-color` | `colors.textSecondary` |
| `--dv-paneview-active-outline-color` | `colors.transparent` |
| `--dv-paneview-header-border-color` | `colors.transparent` |
| `--dv-sash-color` | `colors.transparent` |
| `--dv-sash-hover-background-color` | `colors.overlayHover12` |
| `--dv-separator-border` | `colors.transparent` |
| `--dv-tab-divider-color` | `colors.transparent` |
| `--dv-tab-font-size` | `` `${fontSizes.sm}px` `` |
| `--dv-tab-font-weight` | `String(fontWeights.semibold)` |
| `--dv-tab-margin` | `"0"` |
| `--dv-tab-padding` | `` `0 ${spacing.lg}px` `` |
| `--dv-tabs-and-actions-container-background-color` | `colors.panelHeader` |
| `--dv-tabs-and-actions-container-font-size` | `` `${fontSizes.sm}px` `` |
| `--dv-tabs-and-actions-container-height` | `` `${sizing.tabBarHeight}px` `` |
| `--dv-tabs-container-scrollbar-color` | `colors.separator` |

### App-level variables (replace literals in `src/index.css`)

| CSS custom property | Value expression |
|---|---|
| `--app-background` | `colors.shellBackground` |
| `--app-text-primary` | `colors.textTitle` |
| `--app-font-ui` | `fonts.ui` |

`src/index.css` references these with `var(--app-...)`.

## Structural CSS that remains (not replaced by this module)

`src/styles/dockview-overrides.css` keeps selector-based rules that cannot be expressed as custom properties alone: `.dv-tabs-and-actions-container { height: var(--dv-tabs-and-actions-container-height); }`, `.dv-default-tab { font-family: var(--dv-font-family); ... }`, `.dv-sash:hover { background-color: var(--dv-sash-hover-background-color); }`. These files contain only selectors and `var(...)` — no hand-authored literals, satisfying FR-013.

## Unit test (`src/styles/applyThemeToRoot.test.ts`)

A Vitest + jsdom test that:

1. Creates a detached `HTMLElement` (`document.createElement("div")`).
2. Calls `applyThemeToRoot(el)`.
3. Asserts that each custom property listed above returns the expected value via `el.style.getPropertyValue(name)`.

The test imports tokens from `theme.ts` to compute expected values, so editing a token value in `theme.ts` does not force a test rewrite — only the wiring (which token feeds which variable) is asserted.

## Invariants

1. Every `--dv-*` variable previously set by `dockview-theme.css` is set by this applier (no dropped dockview overrides).
2. The applier is idempotent: calling it twice on the same element produces the same state.
3. No hand-authored hex or pixel literal appears in the applier source; every value comes from `theme.ts`. The Biome plugin scope includes this file.
4. Exempt values in this file: the strings `"0"` (for `--dv-tab-margin`) and keyword colour constants routed through `colors.transparent` (already a theme token).
