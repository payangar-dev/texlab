# Phase 1 — Data Model

Feature: `039-theme-tokens-migration`

This feature does not introduce domain entities or persisted data. "Data" here means the shape of `src/styles/theme.ts` and the relationships between its exported scales — the only code surface contributors touch to add or change visual tokens.

Every scale exported from `theme.ts` is a frozen `const` object (`as const`) so TypeScript preserves literal types at the use-site. Consumers read `theme.scale.tokenName` (not a magic number). The Biome plugin (see `contracts/biome-plugin.md`) ensures no consumer substitutes a literal.

---

## Entity: `colors` — named colour tokens

A map from semantic name to a valid CSS colour string. Every value is either:
- A hex literal (`#RRGGBB` or `#RRGGBBAA`), OR
- An `rgba(...)` / `rgb(...)` string (for translucent tokens), OR
- A CSS keyword accepted as a colour (`"transparent"`, `"currentColor"`).

**Invariants**:
- Names describe intent (surface, text role, state), not raw colour (no `grey900`, `blue500`).
- Shipped values are unchanged from the current `theme.ts` during this migration. New entries added by this feature are explicitly flagged below as new.

**Scale content (post-migration)**:

| Token | Intent | Status |
|---|---|---|
| `shellBackground` | App shell (behind all panels) | existing |
| `panelBody` | Default panel body background | existing |
| `panelHeader` | Panel title bar / tab bar background | existing |
| `canvasBackground` | Canvas viewport behind the texture | existing |
| `titleBar` | App-level title bar background | existing |
| `statusBar` | App-level status bar background | existing |
| `separator` | Hairline separators between controls | existing |
| `inputField` | Input / button neutral background | existing |
| `selectedItem` | Selected row / tab background | existing |
| `accent` | Accent colour (focus, active tool, selection ring) | existing |
| `textPrimary` | Default body text colour | existing |
| `textTitle` | Panel title and heading text colour | existing |
| `textSecondary` | Secondary label / inactive tab text | existing |
| `textMuted` | Muted helper text and disabled labels | existing |
| `textDim` | Lowest-prominence text | existing |
| `iconDefault` | Icon baseline colour (matches muted text) | existing |
| `closeHover` | Close-button hover background (red) | existing |
| `white` | Pure white — used on-accent buttons, pipette icon contrast | **new** (replaces inline `"#FFFFFF"` literals) |
| `overlayHover08` | `rgba(255,255,255,0.08)` — dockview icon-hover | **new** |
| `overlayHover12` | `rgba(255,255,255,0.12)` — dockview sash hover | **new** |
| `accentTranslucent15` | `rgba(74,159,216,0.15)` — drag-over fill | **new** |
| `swatchOutlineInset` | `rgba(0,0,0,0.35)` — inset border inside swatches | **new** (extracted from `SwatchGrid.tsx`) |
| `transparent` | `"transparent"` CSS keyword, exposed as a constant for ergonomic consumption | **new** |

**Relationships**:
- The applier (`contracts/dockview-tokens.md`) reads most of these tokens and writes them as CSS custom properties on `:root`.
- User-generated colours (picked pixel, saved swatches, imported palette entries) are **not** represented here — they live in domain state.

**State transitions**: none. This is a static table.

---

## Entity: `fonts` — font-family stacks

| Token | Value | Intent |
|---|---|---|
| `ui` | `Inter, system-ui, -apple-system, sans-serif` | Default UI text |
| `mono` | `'Geist Mono', monospace` | Tabular data (hex input, file paths) |

Unchanged by this feature.

---

## Entity: `fontSizes` — text sizes in px

| Token | Value (px) | Intent |
|---|---|---|
| `xs` | 11 | Smallest legible size — the shipped floor (SC-007) |
| `sm` | 12 | Tab labels, captions |
| `md` | 13 | Default body text |
| `lg` | 14 | Headings and emphasized values |

**Invariants**:
- The smallest entry **is** the legibility floor (no separate `min` constant). Raising or lowering the floor is a one-line edit to `xs`.
- Values are unitless numbers (not `"11px"`) to compose naturally with `React.CSSProperties` and with arithmetic.

---

## Entity: `fontWeights` — named font weights

| Token | Value | Intent |
|---|---|---|
| `regular` | 400 | Default |
| `medium` | 500 | Emphasised labels |
| `semibold` | 600 | Panel titles, headers |
| `bold` | 700 | Reserved (not currently used; added for completeness) |

**New** scale. Replaces inline `fontWeight: 600` uses.

---

## Entity: `spacing` — gap / padding / margin steps in px

| Token | Value | Intent |
|---|---|---|
| `xs` | 2 | Smallest gap (separator halos, swatch ring thickness) |
| `sm` | 4 | Toolbar item gaps |
| `md` | 6 | Panel-internal breathing space |
| `lg` | 8 | Standard row padding |
| `xl` | 12 | Section-internal gaps |
| `2xl` | 16 | Swatch grid cell |
| `3xl` | 24 | Large section separators |
| `4xl` | 32 | Full-section insets |

**New** scale. Derived by audit of current pixel values across all components (`gap: 4`, `padding: "8px 4px"`, etc.).

---

## Entity: `sizing` — discrete component sizes in px

Grouped by role. Named nested objects keep the scale's top level small.

```ts
sizing = {
  tabBarHeight: 28,
  toolSidebarWidth: 48,
  rowHeight: 22,
  button: { xs: 20, sm: 22, md: 24, lg: 28, xl: 36 },
  input:  { sm: 22, md: 24, lg: 28 },
}
```

**Invariants**:
- Values correspond to what currently ships (inferred from `PanelHeader.tsx` 28, `PaletteActionBar.tsx` 22/20, `ToolsSidebar.tsx` 48/36).
- Nested groupings are stable: adding a new button size is `button.xxl`, not a new top-level constant.

**New** scale.

---

## Entity: `iconSizes` — icon sizes in px

| Token | Value (px) | Intent |
|---|---|---|
| `sm` | 12 | Smallest clickable icon — the shipped floor (SC-007) |
| `md` | 14 | Default icon |
| `lg` | 18 | Tools sidebar (large hit target) |
| `xl` | 24 | Reserved for headings / empty states |

**Invariants**:
- Smallest entry = floor = 12 px. Same rule as `fontSizes`.
- Values feed the `size` prop of lucide icons directly.

**New** scale.

---

## Entity: `radii` — corner radii in px

| Token | Value (px) | Intent |
|---|---|---|
| `none` | 0 | Sharp corners (dockview tabs) |
| `sm` | 2 | Inline emphasis |
| `md` | 4 | Buttons, inputs, swatches |
| `lg` | 6 | Tool buttons, larger cards |

**New** scale.

---

## Entity: `shadows` — composed shadow strings

| Token | Value | Intent |
|---|---|---|
| `swatchInsetBorder` | `"inset 0 0 0 1px rgba(0,0,0,0.35)"` | Inner hairline on swatches |

**New**, minimal scale. Added because `SwatchGrid.tsx` ships a non-zero shadow. Future tokens (`popoverElevation`, etc.) extend this scale additively.

---

## Relationships between entities

```
colors       ───▶ used by every component + applier
fonts        ───▶ used by typography-heavy components + applier
fontSizes    ───▶ used by typography-heavy components + applier
fontWeights  ───▶ used by PanelHeader, TitleBar, StatusBar, dialogs, buttons
spacing      ───▶ used by all layout-containing components
sizing       ───▶ used by fixed-chrome components (panel headers, tool sidebar, status bar, dialogs, action bars)
iconSizes    ───▶ used by any component rendering a lucide icon
radii        ───▶ used by buttons, inputs, swatches, popovers, tabs
shadows      ───▶ used by swatch grid; extended as more surfaces need named elevations
```

The applier (`contracts/dockview-tokens.md`) is the only consumer that writes tokens to the document. Every other consumer reads tokens into `React.CSSProperties` objects or icon `size={...}` props.

---

## Validation rules (drawn from FRs)

| Rule | Source | How enforced |
|---|---|---|
| Every scale named and documented in-source | FR-001, FR-011 | JSDoc comment above each scale's `export` |
| No scale rename on addition | FR-010 | Additive-only reviewer gate; no existing token key may be renamed in this feature |
| Floor for text = smallest `fontSizes` value | FR-009, SC-007 | Unit test `theme.test.ts`: `Math.min(...Object.values(fontSizes)) >= 11` (raising above 11 is allowed; dropping below is not) |
| Floor for clickable icon = smallest `iconSizes` value | FR-009, SC-007 | Unit test: `Math.min(...Object.values(iconSizes)) >= 12` (raising above 12 is allowed; dropping below is not) |
| Shipped colours unchanged by this feature | Assumption in spec, out-of-scope for WCAG tuning | Diff review: every **existing** colour token keeps its current value |

---

## Out of scope for this data model

- Runtime theme switching (single-theme assumption).
- Contrast tuning for WCAG AA (deferred follow-up).
- User-generated colour data (lives in Zustand stores / domain state, not in `theme.ts`).
