import { colors, fontSizes, fonts, fontWeights, radii, sizing, spacing } from "./theme";

/**
 * Dockview (`--dv-*`) CSS custom properties sourced from `theme.ts`. Applied
 * both on `:root` (for tests + fallback cascade) and on every live
 * `.dockview-theme-dark` element via `watchDockviewThemeRoots()` — dockview's
 * bundled stylesheet sets its own defaults on `.dockview-theme-dark`, which
 * win over `:root` by CSS specificity. Inline `style` on the element itself
 * beats both.
 */
export const DOCKVIEW_ENTRIES: ReadonlyArray<readonly [string, string]> = [
  ["--dv-active-sash-color", colors.transparent],
  ["--dv-activegroup-hiddenpanel-tab-background-color", colors.panelBody],
  ["--dv-activegroup-hiddenpanel-tab-color", colors.textMuted],
  ["--dv-activegroup-visiblepanel-tab-background-color", colors.panelHeader],
  ["--dv-activegroup-visiblepanel-tab-color", colors.textTitle],
  ["--dv-background-color", colors.shellBackground],
  ["--dv-border-radius", `${radii.none}px`],
  ["--dv-drag-over-background-color", colors.accentTranslucent15],
  ["--dv-drag-over-border-color", colors.accent],
  ["--dv-font-family", fonts.ui],
  ["--dv-group-view-background-color", colors.panelBody],
  ["--dv-icon-hover-background-color", colors.overlayHoverSubtle],
  ["--dv-inactivegroup-hiddenpanel-tab-background-color", colors.panelBody],
  ["--dv-inactivegroup-hiddenpanel-tab-color", colors.textMuted],
  ["--dv-inactivegroup-visiblepanel-tab-background-color", colors.panelHeader],
  ["--dv-inactivegroup-visiblepanel-tab-color", colors.textSecondary],
  ["--dv-paneview-active-outline-color", colors.transparent],
  ["--dv-paneview-header-border-color", colors.transparent],
  ["--dv-sash-color", colors.transparent],
  ["--dv-sash-hover-background-color", colors.overlayHoverStrong],
  ["--dv-separator-border", colors.transparent],
  ["--dv-tab-divider-color", colors.transparent],
  ["--dv-tab-font-size", `${fontSizes.sm}px`],
  ["--dv-tab-font-weight", String(fontWeights.semibold)],
  ["--dv-tab-margin", "0"],
  ["--dv-tab-padding", `0 ${spacing.lg}px`],
  ["--dv-tabs-and-actions-container-background-color", colors.panelHeader],
  ["--dv-tabs-and-actions-container-font-size", `${fontSizes.sm}px`],
  ["--dv-tabs-and-actions-container-height", `${sizing.tabBarHeight}px`],
  ["--dv-tabs-container-scrollbar-color", colors.separator],
];

export const APP_ENTRIES: ReadonlyArray<readonly [string, string]> = [
  ["--app-background", colors.shellBackground],
  ["--app-text-primary", colors.textTitle],
  ["--app-font-ui", fonts.ui],
];

function writeEntries(
  el: HTMLElement,
  entries: ReadonlyArray<readonly [string, string]>,
): void {
  for (const [name, value] of entries) {
    el.style.setProperty(name, value);
  }
}

/**
 * Writes every `--dv-*` and `--app-*` CSS custom property onto the given
 * element's inline style. Called once from `src/main.tsx` at startup with
 * the default `document.documentElement`, so the variables cascade to every
 * descendant (with the caveat that dockview's own stylesheet sets defaults
 * on `.dockview-theme-dark` — see `watchDockviewThemeRoots`).
 *
 * No-ops in non-DOM environments (SSR, Node unit tests that forget jsdom).
 *
 * @param root Defaults to `document.documentElement`. Pass an arbitrary
 *   `HTMLElement` for unit testing.
 */
export function applyThemeToRoot(root?: HTMLElement): void {
  if (typeof document === "undefined") return;
  const target = root ?? document.documentElement;
  writeEntries(target, DOCKVIEW_ENTRIES);
  writeEntries(target, APP_ENTRIES);
}

/**
 * Applies the `--dv-*` tokens directly on every `.dockview-theme-dark`
 * element currently in the DOM, and installs a `MutationObserver` so any
 * future `.dockview-theme-dark` element (e.g. floating groups added by
 * dockview at runtime) gets the same inline overrides. Inline style wins
 * over dockview's own class selector, keeping our theme authoritative.
 *
 * The observer is intentionally never disconnected: it lives for the
 * lifetime of the app window, which in Tauri is the lifetime of the
 * process. Returning `disconnect` is not exposed because there is exactly
 * one call site (`src/main.tsx` at boot). No-ops in non-DOM environments.
 */
export function watchDockviewThemeRoots(): void {
  if (typeof document === "undefined") return;

  const apply = (el: HTMLElement) => writeEntries(el, DOCKVIEW_ENTRIES);

  for (const el of document.querySelectorAll<HTMLElement>(".dockview-theme-dark")) {
    apply(el);
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.classList.contains("dockview-theme-dark")) apply(node);
        for (const nested of node.querySelectorAll<HTMLElement>(".dockview-theme-dark")) {
          apply(nested);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
