# Implementation Plan: Design System Alignment — Theme Tokens Across All Frontend Components

**Branch**: `039-theme-tokens-migration` | **Date**: 2026-04-23 | **Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from `/specs/039-theme-tokens-migration/spec.md`

## Summary

Normalise how visual values are consumed across the entire TexLab frontend. Grow `src/styles/theme.ts` into a small set of documented, named scales (colours, font sizes, font weights, spacing, sizing, icon sizes, radii — plus shadows if any shipped surface uses one). Migrate every TS/TSX file under `src/**` (panels, shell, dialogs, canvas, status bar, title bar, model preview) so that colour, size, padding, margin, gap, font, radius and icon-size values come from the theme, with a narrow exemption for structural literals (`0`, `1px`, `100%`, `auto`) and for user-generated colour data.

Replace the hand-authored `src/styles/dockview-theme.css` with a TS module that writes every `--dv-*` variable onto `:root` at app startup, sourcing values from `theme.ts`. Do the same for the design-token literals currently embedded in `src/index.css`, leaving `.css` files free of any hand-authored token values.

Enforce the rule at the linting layer with a Biome GritQL plugin that flags hex literals and magic pixel numbers in style contexts outside `src/styles/theme.ts`. Codify the "theme-first, mockups second" principle in the project constitution and reference it from `CLAUDE.md`.

Shipped colour values are not changing. WCAG AA is recorded in the constitution as an aspirational contrast target; meeting it is deferred to a follow-up.

## Technical Context

**Language/Version**: TypeScript ^5.7 (frontend). No Rust backend changes in this feature.
**Primary Dependencies**: React ^19.2, dockview ^5.2, Biome ^2.4.9 (linter + GritQL plugin host), Vite ^6.0, Vitest ^4.1.
**Storage**: N/A — purely an in-source code change (plus a TS module that writes CSS custom properties on `:root` at runtime).
**Testing**: Vitest + Testing Library (already installed). Unit tests for the dockview-token applier. Regression coverage relies on existing panel/component tests remaining green after the migration.
**Target Platform**: Tauri v2 desktop (Windows, macOS, Linux). Feature is frontend-only.
**Project Type**: Desktop app — only `src/**` (frontend) is in scope.
**Performance Goals**: App startup unaffected — the token applier is an O(number-of-dockview-variables) assignment on `:root` run once at boot. Zero runtime cost during interaction.
**Constraints**:
- Single-theme (dark). No runtime theme switching, no multi-theme API surface.
- No token-build pipeline (no Style Dictionary, no CSS-in-JS library). Plain TS constants remain the storage format.
- Zero hex literals and zero magic pixel numbers in `src/**` TS/TSX outside `src/styles/theme.ts`, enforced locally (editor) and in CI (build fails).
- Exempt paths: `src/styles/theme.ts` itself (the single source), `src/styles/applyThemeToRoot.ts` (composes `px`-suffixed strings from theme tokens to write CSS custom properties on `:root`), the user-generated colour data paths (picked pixel colour, saved swatches, imported palette entries), and the structural literals `0`, `1px`, `100%`, `auto`.
- Additive extensions only: growing a scale MUST NOT force renames across consumers.
- Floor for legibility: smallest `fontSizes` value = 11 px, smallest `iconSizes` value = 12 px. The floor is the smallest entry — no separate "minimum" constant.
- Shipped colour values must not change (contrast tuning is a separate issue).
**Scale/Scope**:
- ~24 frontend TS/TSX files currently use hex literals; many more use magic pixel numbers in inline styles.
- 7 panels to migrate (Sources, Layers, Color, Palette, Canvas, Model Preview, plus title bar / status bar / dialogs / tool bar).
- `src/styles/dockview-theme.css` (~88 lines) ported to a TS module.
- `src/index.css` loses its hand-authored token literals; `body`/`html` tokens are driven from CSS custom properties set at startup.
- Biome config gains one GritQL plugin (hex + magic-number in style contexts) with scoped exemptions.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Clean Architecture | ✅ Pass | Frontend-only feature; no `src-tauri/` changes; no layer boundaries touched. |
| II. Domain Purity | ✅ Pass | No domain types touched. No new serialization derives. |
| III. Dual-Access State | ✅ Pass | Visual tokens are not state; the `Mutex<AppState>` and MCP surface are unaffected. |
| IV. Test-First for Domain | ✅ Pass (adapted) | No new domain/use-case logic. The only net-new testable unit is the dockview-token applier (pure function: theme → CSS custom-property map); it gets a unit test. Existing component tests are expected to remain green — any failure signals a behavioural regression, not a token drift. |
| V. Progressive Processing | ✅ Pass | No source-conversion path affected. |
| VI. Simplicity | ✅ Pass | Feature reduces complexity by removing per-component literals. The spec and issue explicitly forbid a design-token build pipeline — plain TS constants remain the storage format. One Biome GritQL plugin is the only net-new piece of machinery. |
| VII. Component-Based UI | ✅ Pass | Panel structure, docking, and layout persistence unchanged. Only internal styling values are normalised. |

**Result**: All gates pass. No entries in Complexity Tracking.

**Re-check after Phase 1** (post-design): Gates still pass. The theme module gains named scales; the dockview applier is one small pure TS module; the Biome plugin is one `.grit` file registered in `biome.json`. None of these introduce new abstractions beyond what the spec mandates (Simplicity ✅).

## Project Structure

### Documentation (this feature)

```text
specs/039-theme-tokens-migration/
├── plan.md                              # This file
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output (theme module scales)
├── quickstart.md                        # Phase 1 output (contributor walkthrough)
└── contracts/                           # Phase 1 output
    ├── theme-module.md                  # Shape of src/styles/theme.ts
    ├── dockview-tokens.md               # TS module that writes --dv-* on :root
    └── biome-plugin.md                  # GritQL plugin enforcement rules
```

No `tasks.md` at this stage (created later by `/speckit.tasks`).

### Source Code (repository root)

```text
src/
├── styles/
│   ├── theme.ts                         # SOLE source of visual literals (expanded)
│   ├── applyThemeToRoot.ts              # NEW — writes --dv-* and --app-* on :root from theme
│   ├── applyThemeToRoot.test.ts         # NEW — unit test for the applier
│   ├── dockview-overrides.css           # NEW — selector-only dockview rules, no literals
│   └── dockview-theme.css               # DELETED — replaced by TS applier
├── index.css                            # Migrated: body/html use CSS custom props
├── main.tsx                             # Calls applyThemeToRoot() at startup
├── components/                          # All panels migrated to theme tokens only
│   ├── shell/        (AppShell, TitleBar, ToolsSidebar, ToolOptionsBar, DockLayout)
│   ├── canvas/       (CanvasViewport + constants.ts)
│   ├── panels/       (PanelHeader + CanvasViewportPanel, ColorPanel, LayersPanel,
│   │                  ModelPreviewPanel, PalettePanel, SourcesPanel)
│   ├── color/        (ColorSlots, HexInput, HsvGradient)
│   ├── layers/       (LayersPanel, LayerRow, BlendModeSelect)
│   ├── palette/      (PaletteDropdown, SwatchGrid, PaletteActionBar,
│   │                  NewPaletteDialog, RenamePaletteDialog, ImportScopeDialog,
│   │                  ImportConflictDialog)
│   └── status-bar/   (StatusBar)
├── hooks/, store/, api/, utils/         # Scanned and migrated if they contain style literals
└── App.tsx, main.tsx                    # Scanned; styling literals (if any) migrated

biome.json                               # + "plugins": ["./biome-plugins/no-style-literals.grit"]
biome-plugins/
└── no-style-literals.grit               # NEW — GritQL rule: hex + pixel literals in style contexts

.specify/memory/constitution.md          # Adds principle "Theme-First, Mockups Second" + WCAG AA note
CLAUDE.md                                # Short note pointing contributors to the principle
```

**Structure Decision**: This is the **TexLab frontend-only** structure defined in `CLAUDE.md`. No backend / `src-tauri/` files are touched. The single new piece of infrastructure is `biome-plugins/no-style-literals.grit` referenced from the existing `biome.json`. Everything else is an in-place migration of files that already exist under `src/`. Tests colocate with the module they test (`applyThemeToRoot.test.ts` next to `applyThemeToRoot.ts`), matching the existing convention in `src/components/canvas/math.test.ts`, `src/components/layers/LayerRow.test.tsx`, etc.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

_No violations. This section intentionally left empty._
