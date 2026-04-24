# Contract: `src/styles/theme.ts`

Interface consumers rely on. Any change that breaks this contract is a breaking change to the whole frontend.

## File location

`src/styles/theme.ts` — single file, no sub-modules, no barrel re-exports.

## Exports

Each scale is exported as a named `const` and frozen with `as const` so TypeScript infers literal types. No default export.

```ts
export const colors = { ... } as const;
export const fonts = { ... } as const;
export const fontSizes = { ... } as const;
export const fontWeights = { ... } as const;
export const spacing = { ... } as const;
export const sizing = { ... } as const;
export const iconSizes = { ... } as const;
export const radii = { ... } as const;
export const shadows = { ... } as const;
```

Types: derived by consumers when needed with `typeof colors[keyof typeof colors]`, etc. **No** companion `export type` aliases — added only when a consumer needs them, to avoid speculative abstractions (Simplicity).

## Value shapes

| Scale | Value type |
|---|---|
| `colors` | `string` — hex, `rgba()`, or CSS keyword |
| `fonts` | `string` — CSS font-family stack |
| `fontSizes` | `number` — px as unitless number |
| `fontWeights` | `number` — CSS `font-weight` numeric value |
| `spacing` | `number` — px |
| `sizing` | `number` or nested `{ [key]: number }` for grouped (e.g. button sizes) |
| `iconSizes` | `number` — px, feeds `<LucideIcon size={...} />` |
| `radii` | `number` — px |
| `shadows` | `string` — full CSS `box-shadow` value |

## Invariants (plan/spec-derived)

1. **Single source**. Outside this file, no TS/TSX under `src/**` MUST contain a hex literal or magic pixel number in a style context (enforced by Biome plugin; see `biome-plugin.md`).
2. **Floor legibility** (SC-007): initial floor is 11 px for text / 12 px for icons. Pragmatic re-tuning above the floor is allowed (spec.md Q&A: "exact values are expected to be tuned pragmatically"). The test enforces the `≥ floor` direction, not equality — raising the smallest entry is intentional; dropping below 11/12 is not.
   - `Math.min(...Object.values(fontSizes)) >= 11`
   - `Math.min(...Object.values(iconSizes)) >= 12`
3. **Additive growth** (FR-010): adding a new token to an existing scale MUST NOT require renaming existing tokens. Removing a token is a breaking change.
4. **Scale documentation** (FR-011): every exported scale MUST carry a JSDoc block above its `export` describing intent in one or two sentences.
5. **Unchanged shipped colours** (assumption): every `colors.*` token whose name existed before this feature MUST keep its pre-migration value.

## Conventions enforced by review (not by tool)

- Token names describe intent (`panelHeader`), not visual value (`grey800`).
- Nested objects in `sizing` group related variants (`button.sm`, `button.md`) so the top level stays small.
- Rgba tokens are named by intent, not by literal alpha value. Use semantic variants (`overlayHoverSubtle` / `overlayHover` / `overlayHoverStrong`) rather than encoding the α as a numeric suffix.

## Consumer expectations

A consumer MAY:
- Read any token into an inline `React.CSSProperties` object.
- Pass an `iconSizes.*` or `sizing.*` number directly to a component prop (`<Icon size={iconSizes.sm} />`, `style={{ height: sizing.tabBarHeight }}`).
- Compose tokens (`gap: spacing.sm`, `borderRadius: radii.md`).

A consumer MUST NOT:
- Mutate any imported object (`as const` + ES module immutability make this a type error and a no-op respectively).
- Introduce an ad-hoc fallback (`colors.accent ?? "#4A9FD8"`) — the token is the source of truth.

## Back-compat

No consumer outside `src/styles/` imports from `theme.ts` today that would be broken by adding new scales. Existing imports (`colors`, `fonts`, `fontSizes`) keep their names.

## Out of scope

- Exporting CSS custom property names (e.g. `--color-accent`). The applier (see `dockview-tokens.md`) is the single place that bridges TS tokens to CSS custom properties.
- Runtime mutation APIs (`setTheme`, `overrideToken`). Single-theme assumption.
