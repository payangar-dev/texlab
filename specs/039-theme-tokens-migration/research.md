# Phase 0 — Research

Feature: `039-theme-tokens-migration`
All entries below resolve items that would otherwise be "NEEDS CLARIFICATION" in the plan's Technical Context. Each entry follows the Decision / Rationale / Alternatives format.

---

## R1. Biome GritQL plugin for the zero-hex / zero-magic-number rule

**Decision**: Enforce the rule with a single Biome GritQL plugin file, `biome-plugins/no-style-literals.grit`, registered from `biome.json` via the top-level `"plugins": ["./biome-plugins/no-style-literals.grit"]` field. The plugin is scoped to JS/TS source (JSX/TSX included). File-level exemption of `src/styles/theme.ts` is expressed inside the GritQL predicates (check the source file path in the match and skip it), so valid code does not produce false positives.

**Rationale**:
- Spec clarification (session 2026-04-23, Q2) explicitly names a custom Biome GritQL plugin as the enforcement mechanism, with diagnostics surfacing both in the editor and in CI.
- Biome v2 supports linter plugins via GritQL, configured through the `"plugins"` array in `biome.json`. We are on Biome `^2.4.9`. Plugin files are referenced by relative path and match code patterns syntactically, registering custom diagnostics. This matches the spec's need for precise style-context matches with rich exemption handling.
- CI already runs `npm run check` (which runs `biome check src/`). Diagnostics raised by the plugin will fail that step without any CI pipeline change.
- The `.grit` plugin host has access to syntactic context, which lets us distinguish "literal in a `style={...}` object / `React.CSSProperties` typed constant" (to flag) from "literal in a `toHex` / `parseColor` utility" (not flag).

**What the plugin matches (two sibling rules in the same file)**:

1. **Hex colour literal** — any string literal whose value matches `^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`, when the literal appears as the value of a CSS-ish property name (`color`, `background`, `background-color`, `border`, `border-*`, `box-shadow`, `fill`, `stroke`, `caret-color`, `accent-color`, `outline`, `outline-color`, `text-shadow`) inside an object literal, OR as a direct value assigned to `style` in JSX.
2. **Magic pixel number** — any numeric literal appearing as the value of a CSS-ish property name drawn from: `fontSize`, `padding`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `margin`, `marginTop`, `marginRight`, `marginBottom`, `marginLeft`, `gap`, `rowGap`, `columnGap`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `top`, `right`, `bottom`, `left`, `borderRadius`, `lineHeight`. Allowed literal values: `0`, `1` (structural 1px borders only when adjacent to a border-* property), `100`, and strings `"100%"` / `"auto"`. A lucide icon's `size={N}` prop is treated as a CSS-ish numeric context (because icon sizes are a scale) and must come from `iconSizes`.

**Exemptions expressed in the plugin**:
- File path matches `src/styles/theme.ts` → skip.
- Parent AST node is a call to a utility in `src/utils/color.ts` / `src/utils/colorHex.ts` (colour parsing/formatting) → skip; these manipulate user data, not design tokens.
- The literal is the string `"transparent"` or `"currentColor"` → skip (keywords, not colour choices).
- Test files (`*.test.ts`, `*.test.tsx`, `*.spec.*`) → skip. The rule targets shipped UI, not test fixtures.

**Alternatives considered**:
- **Biome built-in rule `noColor`** — too narrow (no magic-number pixel rule, no fine-grained exemptions) and would not satisfy FR-004.
- **ESLint + custom rule** — would duplicate the lint stack (Biome is already in use for `check` and `format`) and introduce a second runtime.
- **Pure code review + written convention** — the spec Q2 explicitly rejects "written convention only" as the enforcement mechanism.
- **Stylelint** — would only cover `.css` files; after this migration `.css` files no longer hold design tokens, so Stylelint would lint an empty surface.

---

## R2. Replacing `src/styles/dockview-theme.css` with a TS applier

**Decision**: Add `src/styles/applyThemeToRoot.ts`, a pure TS module that exports a function `applyThemeToRoot(root: HTMLElement = document.documentElement): void`. The function reads tokens from `theme.ts` and calls `root.style.setProperty("--dv-...", value)` for each dockview custom property, plus the app-level `--app-*` custom properties consumed by `src/index.css` (see R4). It is called once from `src/main.tsx` before the React root renders. `src/styles/dockview-theme.css` is deleted; the `@import "dockview/dist/styles/dockview.css"` line currently in that file is moved to `src/index.css` (which still needs the base dockview styles).

**Rationale**:
- Spec clarification (session 2026-04-23, Q4) mandates this approach: "A small TS module run at app startup reads tokens from `theme.ts` and sets the corresponding dockview CSS custom properties (`--dv-*`) on `:root`."
- Applying variables on `:root` (`document.documentElement`) makes them cascade to dockview's `.dockview-theme-dark` class (which is what the app currently mounts). The existing theme class on the dockview mount point still engages dockview's base styles; our overrides become scoped to `:root` and shadow the defaults through normal CSS inheritance.
- A dedicated function (not a top-level side effect) is trivially testable in jsdom (Vitest already configured with `jsdom`).
- One place to maintain. Changing a dockview colour is a one-line edit in `theme.ts`; the applier picks it up on next boot.

**Full set of dockview variables to apply** (derived from the current `src/styles/dockview-theme.css`; the TS applier MUST cover exactly this set — no more, no less — so we preserve the current look byte-for-byte):

| Variable | Source in theme |
|---|---|
| `--dv-group-view-background-color` | `colors.panelBody` |
| `--dv-background-color` | `colors.shellBackground` |
| `--dv-tabs-and-actions-container-background-color` | `colors.panelHeader` |
| `--dv-tabs-and-actions-container-height` | `sizing.tabBarHeight` (28 px) |
| `--dv-tabs-and-actions-container-font-size` | `fontSizes.sm` (12 px) |
| `--dv-activegroup-visiblepanel-tab-background-color` | `colors.panelHeader` |
| `--dv-activegroup-hiddenpanel-tab-background-color` | `colors.panelBody` |
| `--dv-activegroup-visiblepanel-tab-color` | `colors.textTitle` |
| `--dv-activegroup-hiddenpanel-tab-color` | `colors.textMuted` |
| `--dv-inactivegroup-visiblepanel-tab-background-color` | `colors.panelHeader` |
| `--dv-inactivegroup-hiddenpanel-tab-background-color` | `colors.panelBody` |
| `--dv-inactivegroup-visiblepanel-tab-color` | `colors.textSecondary` |
| `--dv-inactivegroup-hiddenpanel-tab-color` | `colors.textMuted` |
| `--dv-tab-divider-color` | `"transparent"` (string literal — keyword, not a colour choice; exempted) |
| `--dv-separator-border` | `"transparent"` (keyword) |
| `--dv-paneview-header-border-color` | `"transparent"` (keyword) |
| `--dv-sash-color` | `"transparent"` (keyword) |
| `--dv-active-sash-color` | `"transparent"` (keyword) |
| `--dv-drag-over-background-color` | `colors.accentTranslucent15` (new token: rgba of `colors.accent` at 15% α) |
| `--dv-drag-over-border-color` | `colors.accent` |
| `--dv-tabs-container-scrollbar-color` | `colors.separator` |
| `--dv-paneview-active-outline-color` | `"transparent"` |
| `--dv-tab-font-size` | `fontSizes.sm` |
| `--dv-tab-margin` | `"0"` (structural) |
| `--dv-border-radius` | `radii.none` (new token, value `0`) |
| `--dv-icon-hover-background-color` | `colors.overlayHover08` (new token: rgba white at 8% α) |

**Remaining static `.dockview-theme-dark .dv-*` CSS rules** (tab bar height, focus-outline reset, default-tab font/padding, sash hover transition): these are structural CSS selectors, not variable assignments, and belong in a separate helper. We keep a minimal `src/styles/dockview-overrides.css` file containing ONLY these selector-based rules, and we drive every value they reference from CSS custom properties we set in the applier. Concretely:

- `--dv-tabs-and-actions-container-height` → used in `.dv-tabs-and-actions-container { height: var(--dv-tabs-and-actions-container-height); }` (we repurpose the existing variable).
- `.dv-default-tab` font-family/size/weight/padding → replaced by `var(--dv-font-family)`, `var(--dv-tab-font-size)` (exists), `var(--dv-tab-font-weight)` (new), `var(--dv-tab-padding)` (new).
- `.dv-sash:hover` background → `var(--dv-sash-hover-background-color)` (new).

All new variables are set by the TS applier from `theme.ts`. The resulting `.css` file contains zero hand-authored colour or pixel literals — only selectors and `var(...)` references.

**Alternatives considered**:
- **Keep the `.css` file, add generated comments pointing back to `theme.ts`** — rejected. FR-013 requires the CSS file to be removed as a hand-authored source of token values; a comment is not enforcement.
- **Inline `<style>` tag built from a template string** — more fragile (cache busting, HMR edge cases) and harder to unit-test than `setProperty` calls.
- **Generate the CSS at build time from `theme.ts`** — reintroduces a build step the spec/issue explicitly rule out.

---

## R3. Scales to add to `theme.ts`

**Decision**: `theme.ts` grows from 3 scales to **9 named scales** (8 categories from FR-001 + `shadows` confirmed below):

| Scale | Intent | Notes |
|---|---|---|
| `colors` | Named surfaces, text, accent, icon, and a small set of translucent/utility colours | Adds `white` (explicit), `overlayHover08` (rgba white 8%), `overlayHover12` (rgba white 12%), `accentTranslucent15` (rgba accent 15%), `swatchOutlineInset` (rgba 0,0,0,0.35), `transparent` keyword-as-constant, `canvasCheckerA` / `canvasCheckerB` (moved out of `canvas/constants.ts`). |
| `fonts` | Font-family stacks | Unchanged: `ui`, `mono`. |
| `fontSizes` | Text sizes in px | Floor = smallest entry = 11 px. Current: `xs` 11, `sm` 12, `md` 13, `lg` 14. |
| `fontWeights` | Named weights | New. `regular` 400, `medium` 500, `semibold` 600, `bold` 700. |
| `spacing` | Inside/outside gaps, paddings, margins in px | New. `xs` 2, `sm` 4, `md` 6, `lg` 8, `xl` 12, `2xl` 16, `3xl` 24, `4xl` 32. Values chosen to cover every literal currently appearing in `src/**`. |
| `sizing` | Discrete component sizes in px (grouped) | New. Top-level: `tabBarHeight` 28, `toolSidebarWidth` 48, `rowHeight` 22. Nested: `button: { xs 20, sm 22, md 24, lg 28, xl 36 }`, `input: { sm 22, md 24, lg 28 }`. Nested groupings keep the top level small and make additions additive (`button.xxl`, not a new top-level key). |
| `iconSizes` | Icon sizes in px | New. Floor = smallest entry = 12 px. Initial: `sm` 12, `md` 14, `lg` 18 (tools sidebar), `xl` 24. |
| `radii` | Corner radii in px | New. `none` 0, `sm` 2, `md` 4, `lg` 6. |
| `shadows` | Composed CSS box-shadow strings | New — confirmed below. Initial token: `swatchInsetBorder` (`"inset 0 0 0 1px rgba(0,0,0,0.35)"`, used by `SwatchGrid.tsx`). |

**Shadows scale — confirmation**: Survey result (grep for `boxShadow` and `shadow` in `src/**`):
- `SwatchGrid.tsx` uses `boxShadow` for selection rings and inset outlines. Ring composition is built from `colors.accent` and structural `1px` offsets; the inset outline is a fixed rgba at 35% α.
- No other `boxShadow` usage in shipped components.

**Decision for shadows**: `shadows` is added as a first-class scale with a single token `swatchInsetBorder` for the inset outline. Ring compositions remain at the call site because they depend on structural `1px` and on `colors.accent` (not a named shadow in the design sense). If a future surface introduces a proper "floating panel shadow", the scale is already named and ready.

**Rationale**:
- Each scale maps 1:1 to a concept already used throughout the codebase (see Phase 0 audit: `gap: 4`, `height: 28`, `padding: "0 8px"`, `borderRadius: 4`, `<Icon size={12} />`). Naming them centralises intent; widening them later is additive.
- Keeping the names orthogonal to components means a future compare-view panel can reuse `sizing.rowHeight` without knowing about Layers panel internals.
- `fontWeights` and `radii` are currently inlined (`fontWeight: 600`, `borderRadius: 4`). Adding them to the theme closes the "magic number" surface area.
- 9 scales is the minimum that covers FR-001 ("colours, font sizes, font weights, spacing, sizing, icon sizes, radii" + shadows since a shipped surface uses one) without introducing speculative categories.

**Alternatives considered**:
- **Token "semantic" layer** (e.g., `buttonPrimaryBackground` aliasing `colors.accent`) — rejected as premature. The spec forbids over-engineering; current usage does not need an alias layer.
- **CSS custom properties as the canonical storage** — rejected. Plain TS constants keep type safety and autocomplete, and the TS surface can still feed CSS variables for the narrow dockview case.
- **One flat object `tokens`** — rejected. Named scales preserve discoverability; FR-001 and FR-011 explicitly require named, documented scales.

---

## R4. `src/index.css` migration

**Decision**: `src/index.css` keeps its CSS reset and imports (dockview base styles, dockview overrides). The hand-authored token literals currently inside it (`background: #1e1e1e`, `color: #ccc`, `font-family: Inter, ...`) become `var(--app-background)`, `var(--app-text-primary)`, `var(--app-font-ui)`. The TS applier `applyThemeToRoot` (defined in R2) assigns these app-level variables alongside the `--dv-*` ones. No `.css` file in the repo ends up with a hand-authored colour or pixel literal.

**Rationale**:
- Edge case in spec ("Third-party component CSS"): TexLab's own overrides of third-party libraries MUST be driven from `theme.ts`. The overrides in `index.css` are TexLab's own, so they fall under this rule.
- FR-013: "no `.css` file in the repository MUST contain hand-authored design-token values."
- Structural rules that can't be expressed as variables (`box-sizing: border-box`, `html, body, #root { height: 100% }`) stay in `index.css` — they are structural, not tokens.

**Alternatives considered**:
- **Leave `index.css` literals alone** — directly violates FR-013.
- **Eliminate `index.css` entirely and move everything to TS-injected `<style>` tag** — churn without benefit; structural CSS is fine in `.css`.

---

## R5. Test strategy for the migration

**Decision**:
- **Unit test** `src/styles/applyThemeToRoot.test.ts` (Vitest + jsdom): applier sets the expected `--dv-*` / `--app-*` custom properties on the element passed to it. Fixture: a `document.createElement("div")`. Assertion: `.style.getPropertyValue(...)` matches the expected string produced from `theme.ts`.
- **Regression coverage via existing component tests**: `LayersPanel.test.tsx`, `LayerRow.test.tsx`, `BlendModeSelect.test.tsx`, `StatusBar.test.tsx`, `SwatchGrid.test.tsx`, `PaletteActionBar.test.tsx`, `PaletteDropdown.test.tsx`, `NewPaletteDialog.test.tsx`, `ImportConflictDialog.test.tsx` remain green. Since these tests assert structure and behaviour (not exact pixel values), they act as a behavioural diff against the migration.
- **Biome plugin self-check**: CI runs `npm run check` (existing). A dedicated scratch file is NOT needed in the repo; SC-009 is verified once during implementation by deliberately reintroducing a hex literal in a branch and observing CI failure.
- **Contract test (optional at plan stage, specified in /speckit.tasks)**: a small `theme.test.ts` that asserts each scale contains at least one entry and that `fontSizes`' smallest value is 11 and `iconSizes`' smallest value is 12 (SC-007).

**Rationale**:
- The migration is value-for-value (shipped colours unchanged). Behavioural tests catch only regressions in structure/handlers, which is the right granularity for a token refactor.
- Adding visual-regression snapshots would be speculative effort for this feature; the existing suite plus the Biome lint barrier are enough to hold the invariants.

**Alternatives considered**:
- **Playwright visual regression** — out of scope. No Playwright setup exists; adding one for a token migration is disproportionate.
- **Per-component "uses theme" assertions** — redundant with the Biome plugin (which already fails the build on any hex / magic pixel number in scope).

---

## R6. Allowed structural exceptions — canonical list

**Decision**: The Biome plugin considers these values non-tokens and does not flag them:

| Value | Context | Reason |
|---|---|---|
| `0` | any | Zero offset / zero gap / zero radius — not a design choice. |
| `1` | immediately adjacent to `border*` or `outline*` property | 1 px hairline border is a structural necessity. |
| `100` | followed by `%` (string `"100%"`) | Full-bleed sizing. |
| `"auto"` | `width`/`height`/`margin` properties | Layout keyword. |
| `"transparent"` / `"currentColor"` | any colour context | CSS keywords, not colour values. |
| `"#FFFFFF"` / `#FFF` in `src/styles/theme.ts` only | — | Theme is the single allowed source. |
| Any literal inside `src/utils/color.ts` or `src/utils/colorHex.ts` | — | User-data transformation path (picked/saved/imported colours). |
| Any literal inside `*.test.ts` / `*.test.tsx` / `*.spec.*` | — | Test fixtures. |

**Rationale**: Matches spec Edge Cases and the "User-generated colour" Key Entity. Documented in `CLAUDE.md` so contributors can reason about it without reading plugin source.

**Alternatives considered**:
- **No exemptions, suppress with `// biome-ignore`** — rejected. Suppression comments would scatter across user-data paths and become the dominant noise; a file-path exemption is cleaner and matches the "valid code does not produce false positives" requirement (FR-012).

---

## R7. Constitutional principle text

**Decision**: Add a new principle **VIII. Theme-First, Mockups Second** to `.specify/memory/constitution.md`, ratified as version `1.1.0` (MINOR: new principle). Principle text covers:
- Theme module (`src/styles/theme.ts`) is the single source of truth for visual tokens.
- Mockups drive structure, composition, and hierarchy — not raw pixel values.
- If a needed token is missing, extend the theme first, then consume it.
- Structural exceptions (`0`, `1px`, `100%`, `auto`) and user-generated colour data are exempt.
- Legibility floor lives in the smallest entry of `fontSizes` / `iconSizes`.
- WCAG AA is the project's aspirational contrast target for text, documented here for future tuning but not gated by this principle.

Include a Sync Impact Report at the top of the constitution (version bump, added principles, templates affected).

**Rationale**: FR-007 requires an explicit principle; SC-005 requires a dedicated, self-contained section. Versioning to 1.1.0 matches the constitution's own governance rules (MINOR = new principle).

**Alternatives considered**:
- **Extend principle VI. Simplicity** — rejected. Simplicity is about "no premature abstractions"; this rule is about "single source of truth for visual values", which is distinct and deserves its own named principle per SC-005.

---

## R8. `CLAUDE.md` note

**Decision**: Add a short subsection under **Architecture** → after the "Key rules" block — titled **Visual tokens** — with three lines:
1. The theme module `src/styles/theme.ts` is the only place visual literals live.
2. Design mockups (in `ui-design/`) are a reference for structure, not raw pixel values.
3. If a needed token is missing, extend the theme; do not hardcode.

Point to principle VIII for the full rule.

**Rationale**: FR-008 + SC-005. A new contributor reading only `CLAUDE.md` and the constitution can answer the three questions in SC-006.

---

## Summary table

| Unknown | Resolved in | Decision |
|---|---|---|
| Enforcement mechanism | R1 | Single GritQL plugin, two sibling rules (hex, magic-number), exemptions by file path + parent call |
| Dockview CSS removal | R2 | TS applier writes `--dv-*` on `:root`, structural selector-only CSS kept |
| Theme scales | R3 | 9 named scales (shadows confirmed: `SwatchGrid.tsx` ships a non-zero shadow) |
| `index.css` tokens | R4 | Migrated to `--app-*` custom properties set by the same TS applier |
| Test strategy | R5 | Vitest unit for applier + theme scales, behavioural regression via existing suite |
| Structural exceptions | R6 | `0`, `1px`, `100%`, `auto`, `transparent`, `currentColor`, user-data colour paths, test files |
| Constitution principle | R7 | New principle VIII, version bump 1.0.0 → 1.1.0 |
| `CLAUDE.md` note | R8 | Short "Visual tokens" subsection pointing at principle VIII |

All Technical Context unknowns are now resolved. Proceeding to Phase 1.
