# Quickstart — Visual tokens in TexLab

Short walkthrough for a contributor (human or AI) working on the TexLab frontend after feature `039-theme-tokens-migration` ships.

## The rule, in one sentence

`src/styles/theme.ts` is the only place in the frontend where visual literals (colours, font sizes, spacing, sizing, icon sizes, radii, shadows) live. Every other file under `src/**` reads tokens from it.

## "I need a colour / size / radius in my component"

1. Open `src/styles/theme.ts`.
2. Find the matching scale (`colors`, `fontSizes`, `fontWeights`, `spacing`, `sizing`, `iconSizes`, `radii`, `shadows`).
3. Pick the token that matches your intent. Example:

```tsx
import { colors, spacing, radii, iconSizes } from "../../styles/theme";

<button
  style={{
    background: colors.inputField,
    padding: spacing.sm,
    borderRadius: radii.md,
  }}
>
  <Plus size={iconSizes.sm} color={colors.textSecondary} />
</button>
```

## "The token I need doesn't exist"

**Extend the theme first, then consume it.** Hardcoding in a component will fail the Biome lint check.

Example — a new `spacing.5xl = 40`:

```diff
export const spacing = {
   xs: 2,
   sm: 4,
   md: 6,
   lg: 8,
   xl: 12,
   '2xl': 16,
   '3xl': 24,
   '4xl': 32,
+  '5xl': 40,
} as const;
```

Rules of extension:
- Additive only. Do not rename existing tokens in the same PR as your feature work.
- Keep the scale's intent focused. If your new value is a "shadow" token, it belongs in `shadows`, not in `colors`.
- If you're adding a new colour, prefer a semantic name (`popoverBorder`) over a visual one (`grey700`).

## "My mockup says 10 px but that feels small"

It is. The shipped floor is:

- 11 px for text (`fontSizes.xs`)
- 12 px for clickable icons (`iconSizes.sm`)

Mockups drive **structure** — what goes next to what, hierarchy, composition. They are **not authoritative for raw pixel values**. If a mockup shows a 10 px label, ship 11 px.

Re-tuning the floor is a one-line change in `theme.ts`; no component needs to be edited.

## "How is this enforced?"

A Biome GritQL plugin (`biome-plugins/no-style-literals.grit`) flags:

- Hex literals in style contexts (`color: "#fff"`, `style={{ background: "#252525" }}`, `<Icon color="#abc" />`).
- Magic pixel numbers in style contexts (`fontSize: 12`, `padding: 8`, `borderRadius: 4`, `<Icon size={12} />`).

Exempt:
- `src/styles/theme.ts` (the source).
- `src/utils/color.ts` and `src/utils/colorHex.ts` (user colour data).
- Test files (`*.test.ts*`, `*.spec.*`).
- Structural values (`0`, `1px` borders, `"100%"`, `"auto"`, `"transparent"`, `"currentColor"`).

Violations fail:
- In the editor via the Biome LSP (instant red underline).
- In CI via `npm run check` in the `Frontend` job.

## "I'm touching CSS, not TSX"

`.css` files (currently `src/index.css` and `src/styles/dockview-overrides.css`) MUST NOT contain hand-authored token literals. They reference CSS custom properties (`var(--app-background)`, `var(--dv-tab-font-size)`) which the TS applier `src/styles/applyThemeToRoot.ts` writes onto `:root` at startup. If you need a new CSS variable, add it to the applier, source its value from `theme.ts`, and reference it from the `.css` file.

## "I'm writing a hex value because it comes from the user"

That's fine — user-generated colour data (picked pixel, saved swatch, imported palette) is explicitly exempt from the rule. It lives in Zustand stores and travels through `src/utils/color.ts` / `colorHex.ts`, both of which the plugin skips.

Do **not** manually route user colours through `theme.ts`. The theme is for design choices, not user data.

## Reference

- Full principle: `.specify/memory/constitution.md` → **VIII. Theme-First, Mockups Second**.
- Theme module: `src/styles/theme.ts`.
- Enforcement: `biome-plugins/no-style-literals.grit`, surfaced by `npm run check`.
- Dockview / app-level CSS variables: `src/styles/applyThemeToRoot.ts`.
- Contributor note: `CLAUDE.md` → **Visual tokens** subsection.
