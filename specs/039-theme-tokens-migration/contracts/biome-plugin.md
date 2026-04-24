# Contract: `biome-plugins/no-style-literals.grit`

Custom Biome GritQL plugin that enforces the "theme-first" rule at the lint layer. Registered via `biome.json`:

```jsonc
{
  "plugins": ["./biome-plugins/no-style-literals.grit"]
}
```

CI already runs `npm run check` (`biome check src/`), which fails on any diagnostic the plugin raises. The same diagnostics surface in the editor (Biome LSP).

## Rule A — Hex colour literal in a style context

**Fires when**: a string literal whose text matches `^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$` appears as the **value of a CSS-ish property** inside:

- An object literal whose key is one of:
  `color`, `background`, `backgroundColor`, `border`, `borderTop`, `borderRight`, `borderBottom`, `borderLeft`, `borderColor`, `borderTopColor`, `borderRightColor`, `borderBottomColor`, `borderLeftColor`, `boxShadow`, `fill`, `stroke`, `caretColor`, `accentColor`, `outline`, `outlineColor`, `textShadow`.
- A JSX attribute named `color`, `fill`, or `stroke` (for icon props).
- A JSX attribute named `style` evaluated from an inline object (captured recursively).

**Diagnostic message**: `"Hex colour literals are not allowed in frontend components. Move this colour into src/styles/theme.ts and import it from there."`

## Rule B — Magic pixel number in a style context

**Fires when**: a `NumericLiteral` appears as the value of a CSS-ish property whose key is one of:
`fontSize`, `padding`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `margin`, `marginTop`, `marginRight`, `marginBottom`, `marginLeft`, `gap`, `rowGap`, `columnGap`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `top`, `right`, `bottom`, `left`, `borderRadius`, `lineHeight`, `fontWeight`.

Also fires for a `NumericLiteral` passed as the `size` prop to any `<Icon>` / `<LucideIcon>` component (matched syntactically as `size={N}` on a JSX element).

**Allowed literal values** (not flagged):
- `0`
- `1` when the sibling property is `border*` or `outline*` (hairline border).
- `100` when immediately followed by `%` in string form (captured as `"100%"` instead of a number — so this is already a string exemption, documented for completeness).

**Diagnostic message**: `"Magic pixel numbers are not allowed in frontend components. Use a named token from src/styles/theme.ts (spacing, sizing, iconSizes, radii, fontSizes, fontWeights)."`

## Exemptions (both rules)

A match is **not** reported when any of the following holds:

1. **Source file is `src/styles/theme.ts`** — the only allowed place for visual literals.
2. **Source file is `src/styles/applyThemeToRoot.ts`** — composes `px`-suffixed CSS custom property values from theme tokens; the string concatenation results may look like number-like patterns.
3. **Enclosing function call is a utility in `src/utils/color.ts` or `src/utils/colorHex.ts`** — user-data transformation, not design tokens.
4. **File path matches `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts`, or `**/*.spec.tsx`** — tests legitimately assert specific values; they are not the shipped UI.
5. **Literal is a CSS keyword colour** (`"transparent"`, `"currentColor"`) — not a colour choice.

All exemptions are expressed as predicates inside the `.grit` patterns, not as `// biome-ignore` comments in source, so valid code stays comment-free (FR-012).

## Pseudo-code skeleton

`.grit` plugin text (illustrative — the actual file is authored during implementation and is a single source of truth):

```gritql
language js;

// Rule A: hex literal in style context
// Matches either an object-literal property or a JSX style-prop
or {
    `{ $prop: $value }` as $match where {
        $prop <: or { `color` `background` `backgroundColor` `border` `borderColor` `boxShadow` `fill` `stroke` `caretColor` `accentColor` `outline` `outlineColor` `textShadow` `borderTopColor` `borderRightColor` `borderBottomColor` `borderLeftColor` `borderTop` `borderRight` `borderBottom` `borderLeft` },
        $value <: r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$",
        not $filename <: or { r".*/styles/theme\.ts$" r".*/styles/applyThemeToRoot\.ts$" r".*/utils/color(Hex)?\.ts$" r".*\.test\.(ts|tsx)$" r".*\.spec\.(ts|tsx)$" },
        register_diagnostic(
            span = $match,
            message = "Hex colour literals are not allowed in frontend components. Move this colour into src/styles/theme.ts and import it from there."
        )
    },
    // ... analogous for JSX attribute form: <Icon color="#fff" /> etc.
}

// Rule B: numeric literal in size/spacing style context
`{ $prop: $n }` as $match where {
    $prop <: or { `fontSize` `padding` `paddingTop` `paddingRight` `paddingBottom` `paddingLeft` `margin` `marginTop` `marginRight` `marginBottom` `marginLeft` `gap` `rowGap` `columnGap` `width` `minWidth` `maxWidth` `height` `minHeight` `maxHeight` `top` `right` `bottom` `left` `borderRadius` `lineHeight` `fontWeight` },
    $n <: r"^[0-9]+$",
    not $n <: `0`,
    // allowed 1px border
    not and { $n <: `1`, $prop <: or { `border` `borderTop` `borderRight` `borderBottom` `borderLeft` `outline` } },
    not $filename <: or { r".*/styles/theme\.ts$" r".*/styles/applyThemeToRoot\.ts$" r".*\.test\.(ts|tsx)$" r".*\.spec\.(ts|tsx)$" },
    register_diagnostic(
        span = $match,
        message = "Magic pixel numbers are not allowed in frontend components. Use a named token from src/styles/theme.ts (spacing, sizing, iconSizes, radii, fontSizes, fontWeights)."
    )
}

// Rule B'": icon size prop
`<$cmp size={$n}/>` as $match where {
    $n <: r"^[0-9]+$",
    not $n <: `0`,
    not $filename <: or { r".*/styles/theme\.ts$" r".*\.test\.(ts|tsx)$" r".*\.spec\.(ts|tsx)$" },
    register_diagnostic(
        span = $match,
        message = "Icon sizes must come from src/styles/theme.ts iconSizes scale."
    )
}
```

The final `.grit` syntax may differ (Biome's GritQL dialect pins specific predicate/matcher syntax for file-path access and JSX matching). The plugin is authored during implementation and validated by:

1. Running `npm run check` on the migrated codebase and observing **zero** diagnostics (correctness of exemptions).
2. Re-introducing a hex literal in a scratch commit in any `src/components/**` file and observing **one** diagnostic per reintroduced literal (SC-009).

## Verifying SC-009

As part of implementation completion, the author:
1. Temporarily edits one component to reintroduce `background: "#abcdef"`.
2. Runs `npm run check` locally — expects a plugin diagnostic.
3. Pushes the scratch commit to a throwaway branch; CI's `Frontend` job fails.
4. Reverts the scratch commit before merging.

## Out of scope for the plugin

- Per-property unit consistency checks (`padding` vs `paddingTop`).
- `rem` / `em` unit enforcement (the codebase is px-only by convention).
- Flagging valid `rgba(...)` calls — these are allowed only inside `theme.ts` (the exemption by file path covers it).
- Replacing violations automatically (no code-fix support in this iteration of the plugin).
