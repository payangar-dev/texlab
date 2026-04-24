# Feature Specification: Design System Alignment — Theme Tokens Across All Frontend Components

**Feature Branch**: `039-theme-tokens-migration`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub issue #39 — "Design system alignment: enforce theme tokens across all frontend components"

## Clarifications

### Session 2026-04-23

- Q: Is the "zero hex / zero magic number" rule scoped to `src/components/**` only, or to the whole frontend? → A: Whole frontend — applies to every TS/TSX file under `src/**` (components, hooks, store, api, styles, shell, root entry points). Only `src/styles/theme.ts` is allowed to hold visual literals.
- Q: How is the "zero hex / zero magic number" rule automatically enforced? → A: Custom Biome lint rule via a GritQL plugin that flags hex literals and magic pixel numbers in style contexts outside `src/styles/theme.ts`. Feedback surfaces both in the editor (Biome) and in CI (Biome check fails the build). Written convention in the constitution / `CLAUDE.md` complements it but is not the enforcement mechanism.
- Q: What is the minimum legibility threshold for text and icons in the shipped UI? → A: Initial floor is **11 px for text** and **12 px for clickable icons**, implemented as the smallest value of the `fontSizes` and `iconSizes` scales respectively in `theme.ts`. No separate "minimum" constant is introduced — the floor *is* the smallest scale value, so adjusting it later is a one-line edit in `theme.ts`. The spec commits to *having* a floor held in the theme; exact values are expected to be tuned pragmatically based on real in-app usage.
- Q: How is `src/styles/dockview-theme.css` kept aligned with the theme? → A: Delete the static `.css` file. A small TS module run at app startup reads tokens from `theme.ts` and sets the corresponding dockview CSS custom properties (`--dv-*`) on `:root`. The theme is the only source; the dockview overrides are derived from it by construction and are therefore covered by the same Biome GritQL enforcement as the rest of the frontend.
- Q: Does this feature enforce a specific accessibility contrast target (WCAG) for theme colours? → A: No — not in the scope of #39. WCAG AA is documented in the constitution as the project's aspirational contrast target for text, but tuning current text colours (`textMuted`, `textDim`, borderline `textSecondary`) to meet it is deferred to a separate follow-up issue. This feature does not change shipped colour values; it only normalises how they are consumed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visually coherent app across all panels (Priority: P1)

A Minecraft resource pack creator opens TexLab and works across several panels in the same session (Sources, Layers, Color, Palette, Canvas, Model Preview, title/status bars, dialogs). Buttons, icons, labels, paddings, and corner radii look consistent from one panel to the next — no panel feels "off by a pixel or two" compared to its neighbours. Text is legible everywhere; no panel shows a font smaller than what is readable in a real working session.

**Why this priority**: This is the user-visible payoff of the whole feature. Until the existing panels share one visual vocabulary, the app looks unfinished, and every new panel added (compare view, context menus, polish phase) will inherit or aggravate the drift. Without P1, nothing else in this spec delivers visible value.

**Independent Test**: A reviewer can open each panel side by side and confirm that: (a) button heights, icon sizes, and label font sizes match within each category, (b) equivalent actions (e.g. "add", "delete", "rename" buttons) render identically across panels, (c) no text in the shipped UI is smaller than the minimum readable size defined for the product.

**Acceptance Scenarios**:

1. **Given** the app is opened with all panels visible, **When** the user compares any two "action button" controls (e.g. the "+" in Layers vs the "+" in Palette), **Then** they share the same height, icon size, padding, and font metrics.
2. **Given** the Sources, Layers, Color, Palette, Canvas, Model Preview, title bar, and status bar are all visible, **When** a reviewer inspects any label, caption, or value text, **Then** the font size is one of a small, predictable set of values defined in the shared theme, with no one-off sizes.
3. **Given** any shipped dialog or popover (e.g. palette save dialog), **When** it is displayed, **Then** its spacing, button sizing, and typography match the rest of the app.
4. **Given** the user interacts with a clickable icon anywhere in the UI, **When** they look at it next to any other clickable icon in another panel, **Then** the icon size belongs to the same small predictable scale (no 10 vs 12 vs 13 drift).

---

### User Story 2 - Theme is the single source of truth going forward (Priority: P2)

A contributor (human or AI agent) adds a new component or panel to TexLab. They need to know where visual values come from, and are stopped from reintroducing hardcoded numbers or colours. The project's written rules make it clear that the central theme module is the only acceptable source for colours, font sizes, spacing, sizing, icon sizes, and radii — and that mockups are a reference for structure and intent, not for exact pixel values.

**Why this priority**: Without a written, enforceable rule, today's cleanup will drift again within a few phases. This story protects the P1 investment. It is P2 because P1 already delivers visible value even before the rule is codified, but the rule must land within the same feature to prevent immediate regression.

**Independent Test**: A reviewer opens the project constitution and the root contributor guide (`CLAUDE.md`), and can find an explicit, self-contained principle named and explained: the theme is the single source of truth for visual tokens; mockups drive structure and hierarchy, not raw values; if a needed token is missing, the contributor extends the theme rather than hardcoding in a component.

**Acceptance Scenarios**:

1. **Given** the project constitution, **When** a reader looks for guidance on visual tokens, **Then** they find a dedicated principle stating "theme-first, mockups second" with a short rationale and the rule for handling missing tokens.
2. **Given** the contributor guide (`CLAUDE.md`), **When** a new contributor reads it before making frontend changes, **Then** they are pointed to the principle and understand that mockup pixel values are a reference, not a target.
3. **Given** a contributor is tempted to hardcode a value that does not exist in the theme, **When** they consult the documented rule, **Then** the correct action (extend the theme, then consume it) is unambiguous.

---

### User Story 3 - Consuming the theme is the obvious path for contributors (Priority: P3)

A contributor needs a value that is not yet in the theme (for example, a shadow for a new floating panel, or a new spacing step). They can extend the theme in one place, give the new token a meaningful name, and consume it from their component — no component-level magic numbers, no raw hex strings. The theme module is organised into named scales (colours, font sizes, font weights, spacing, sizing, icon sizes, radii, shadows where relevant) so they know where new tokens belong.

**Why this priority**: Enables P2 to hold up in practice. If extending the theme is awkward, contributors will work around it. P3 because US1 + US2 already deliver the user-facing and policy value; this story only refines the developer ergonomics that keep the system healthy over time.

**Independent Test**: A reviewer inspects the theme module and can (a) name each scale present, (b) find a short comment on each scale explaining its intent, (c) add a plausible new token to any scale without inventing a new file or module.

**Acceptance Scenarios**:

1. **Given** the theme module, **When** a contributor opens it, **Then** they see named scales for colours, font sizes, font weights, spacing, sizing, icon sizes, and radii (plus shadows where the product uses any), each with a short description of intent.
2. **Given** a new component needs a value outside existing scales, **When** the contributor extends the theme, **Then** the change is additive (no rename cascade across the codebase) and the new token is immediately consumable from any component.
3. **Given** a reviewer opens any frontend TS/TSX file under `src/**` (outside `src/styles/theme.ts`), **When** they search for raw hex colour literals or numeric pixel values in styles, **Then** they find none except the narrow set of unavoidable structural exceptions documented by the project rule (e.g. `1px` border widths, `0` offsets).

---

### Edge Cases

- **Unavoidable structural pixels**: `1px` border widths, `0` offsets, and full-bleed `100%` / `auto` are not tokens and must remain allowed. The rule explicitly permits these.
- **Mockup values that are too small to ship**: When a mockup specifies a font or icon size that is below the product's legibility threshold, the shipped value follows the theme's minimum, not the mockup. The mockup drives structure (what goes next to what, hierarchy), not raw pixels.
- **Third-party component CSS**: Styles shipped by third-party libraries themselves are out of scope (TexLab does not edit their source). TexLab's own overrides of those libraries — including the dockview CSS custom property overrides currently in `src/styles/dockview-theme.css` — are in scope and MUST be driven from `theme.ts`. The dockview overrides specifically MUST be replaced by TS-side assignment of CSS custom properties on `:root` so they become covered by the same enforcement as the rest of the frontend.
- **Dynamic / user-chosen colours** (a user-picked pixel colour, a swatch value the user just saved, an imported palette entry): these are data, not visual tokens, and are exempt from the rule — they originate from user input, not design choices.
- **Missing token collision**: Two contributors might extend the theme with different names for what turns out to be the same concept. The rule nudges toward reuse-first, and the theme's structure makes lookups easy before additions.
- **Drift reintroduced by future features**: A later panel author copy-pastes a one-off size. The written rule and the visible structure of the theme should make this cost more than just consuming the token.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The shared theme module MUST expose named, documented scales covering colours, font sizes, font weights, spacing, sizing (button and input heights), icon sizes, and radii. Shadows MUST be added as a named scale if any shipped UI uses any non-zero shadow.
- **FR-002**: Every styling value used by any frontend TS/TSX file under `src/**` (components, hooks, store, api, styles, shell, and root entry points) MUST be read from the shared theme module, with the exception of explicitly allowed structural values (`0`, `1px` borders, `100%` / `auto` sizing, and other clearly non-design values documented by the project rule). `src/styles/theme.ts` itself is the one location allowed to declare visual literals.
- **FR-003**: No frontend TS/TSX file under `src/**` (outside `src/styles/theme.ts`) MUST contain a raw hex colour literal in its inline or module styles. All colours consumed in frontend code MUST come from the theme, except where the colour is user-generated data (pixel colour, saved swatch, imported palette) rather than a design choice.
- **FR-004**: No frontend TS/TSX file under `src/**` (outside `src/styles/theme.ts`) MUST contain magic pixel numbers for font sizes, paddings, margins, gaps, icon sizes, button/input heights, or corner radii. Each of these MUST come from the corresponding named theme scale.
- **FR-005**: Equivalent UI affordances (action buttons, icon buttons, labels, captions, values) MUST resolve to the same theme tokens across all panels, so a user cannot perceive per-panel drift in button height, icon size, label font size, or padding.
- **FR-006**: The existing panels and shared UI surfaces MUST all be migrated to consume the theme exclusively. The scope covers at least: Sources panel; Layers panel (including layer rows, blend-mode selector, header controls); Color panel (HSV gradient, colour slots, hex input); Palette panel (dropdown, swatch grid, action bar, its dialogs); Canvas surface and its tool bar; Model Preview panel; title bar; status bar; shared dialogs and popovers.
- **FR-007**: The project constitution MUST include an explicit principle stating that the theme module is the single source of truth for visual tokens and that design mockups are a reference for structure and intent, not for raw pixel values. The principle MUST describe the rule for handling a missing token (extend the theme first, then consume it). The principle MUST also record WCAG AA as the project's aspirational contrast target for text, noting that this target is not gated by this feature.
- **FR-008**: The root contributor guide (`CLAUDE.md`) MUST carry a short note pointing to that principle so new contributors and AI agents follow it by default on frontend work.
- **FR-009**: The chosen token values MUST prioritise legibility and consistency over 1:1 fidelity to the mockups. Font sizes and icon sizes used in the shipped UI MUST respect a minimum readability threshold, materialised as the smallest value of the `fontSizes` and `iconSizes` scales in `theme.ts` (initial floor: 11 px for text, 12 px for clickable icons). The floor MUST be held in one place so it can be re-tuned by editing a single value in `theme.ts`, without touching any component. Mockups that show smaller values MUST be ignored in favour of this floor.
- **FR-010**: The theme extension process MUST be additive for existing tokens: introducing new scales or new tokens MUST NOT force renames of existing consumers, so migration and future extension are low-risk.
- **FR-011**: Each named scale in the theme module MUST carry a short in-source description of its intent, so a contributor can tell at a glance where a new token belongs without reading component code.
- **FR-012**: The rules stated in FR-002, FR-003, and FR-004 MUST be enforced automatically at the linting layer, not only at code review. Violations MUST surface both in the contributor's editor (as a lint diagnostic) and in CI (as a failing build check). Exemptions (`src/styles/theme.ts` itself; the TS theme applier at `src/styles/applyThemeToRoot.ts`, which legitimately composes `px`-suffixed strings from theme tokens to feed CSS custom properties; user-generated colour data paths; and the documented structural values) MUST be expressible in the enforcement configuration so that valid code does not produce false positives.
- **FR-013**: Dockview CSS custom property overrides (currently in `src/styles/dockview-theme.css`) MUST be removed as a hand-authored static file and replaced by a TS module that assigns each `--dv-*` property on the document root at app startup, sourcing every value from `theme.ts`. The same TS module MUST also assign the app-level custom properties (`--app-*`) that replace the hand-authored colour and typography literals currently embedded in `src/styles/index.css` (or any other repository `.css` file). After this change, no `.css` file in the repository MUST contain hand-authored design-token values — in particular, neither `src/index.css` nor any dockview overrides file.

### Key Entities *(include if feature involves data)*

- **Visual token**: A named, reusable value (colour, size, spacing step, radius, etc.) used by components to render the UI. Lives only in the shared theme module. Never a magic number inside a component.
- **Token scale**: A named group of related visual tokens (e.g. font sizes, spacing, icon sizes). Exposes a small, predictable set of values. Has a documented intent.
- **Structural exception**: A non-design numeric value used in styles that is allowed to remain inline because it does not encode a design choice (e.g. `1px` borders, `0` offsets, `100%` / `auto` sizing).
- **User-generated colour**: A colour that originates from user data (a picked pixel, a saved swatch, an imported palette). Not a visual token and not subject to the theme rule.
- **Design mockup (Pencil reference)**: An external design file describing panel structure, composition, and hierarchy. Authoritative for layout and intent, not authoritative for raw pixel values.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero hex colour literals remain in any frontend TS/TSX file under `src/**` except `src/styles/theme.ts` and user-generated colour data paths explicitly documented as exempt.
- **SC-002**: Zero magic pixel numbers (font sizes, paddings, margins, gaps, icon sizes, button/input heights, radii) remain in any frontend TS/TSX file under `src/**` except `src/styles/theme.ts`, and excluding the documented structural exceptions (`0`, `1px`, `100%`, `auto`).
- **SC-003**: Every panel listed in FR-006 is migrated — verified by a file-level check that each component in those directories consumes the theme module for every styling value in scope.
- **SC-004**: The perceived drift between equivalent UI affordances across panels drops to zero: pick any two equivalent affordances (e.g. two icon-only action buttons in different panels), and they resolve to identical token values.
- **SC-005**: The project constitution contains a dedicated principle (or a dedicated extension of an existing principle) named for this rule, written in one self-contained section and referenced from `CLAUDE.md`.
- **SC-006**: A new contributor reading only the constitution and `CLAUDE.md` — without looking at any component code — can correctly answer: (a) where do visual values live, (b) what role do the mockups play, (c) what do I do if I need a token that does not exist yet.
- **SC-007**: All shipped text in the UI renders at or above the smallest value of the `fontSizes` scale in `theme.ts` (initial floor 11 px); all clickable icons render at or above the smallest value of the `iconSizes` scale (initial floor 12 px). Re-tuning either floor is a one-line change in `theme.ts` that propagates to every consumer with no other edits.
- **SC-008**: Adding a new token to the theme is a one-file change — no component rewrite, no cross-module cascade — demonstrated by a sample addition during or after the migration.
- **SC-009**: Introducing a new hex colour literal or magic pixel number in any frontend TS/TSX file outside `src/styles/theme.ts` (and outside the documented exemptions) causes the linter to report a violation locally and fails the CI check — verified by deliberately adding such a literal in a scratch commit and observing a failure.

## Assumptions

- The app remains single-theme (dark) for the foreseeable future; the theme module does not need to support multiple themes or runtime theme switching.
- No styling framework or design-token build pipeline is introduced; plain in-source constants continue to be the storage format for tokens, as stated in the issue's non-goals.
- Panel composition and layout are not changing: the visual structure of each existing panel remains mockup-driven. Only token-level values are normalised.
- The full set of panels in scope is the currently shipped set listed in FR-006; panels from later phases (compare view, context menus) are out of scope for this feature but will inherit the rule once it is documented.
- Third-party library internals (dockview, any picker or popover from external packages) are out of scope; only TexLab's own wrapper/custom styles around them are migrated.
- User-facing legibility minimums (e.g. no text below a chosen threshold) will be decided as part of this feature when the scales are finalised; the exact numbers are an implementation detail to be set during the planning phase, not in this spec.
- The constitutional principle will be written so it applies to all frontend token categories currently in scope and any future ones added to the theme module.
- This feature does not modify shipped colour values, so text contrast against panel backgrounds remains as it is today. Raising contrast to fully meet WCAG AA (currently failed by `textMuted` ≈ 2.6:1 and `textDim` ≈ 2.0:1 on `panelBody`) is treated as a separate follow-up and will be tracked outside #39.
