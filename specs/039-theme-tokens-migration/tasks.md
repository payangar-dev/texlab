---
description: "Task list for feature 039-theme-tokens-migration"
---

# Tasks: Design System Alignment — Theme Tokens Across All Frontend Components

**Input**: Design documents in `/specs/039-theme-tokens-migration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Two small test files are included in the foundational phase because they guard user-facing invariants (legibility floor SC-007, applier wiring) that component tests alone cannot assert. No TDD-style tests for story implementation tasks.

**Organization**: Tasks are grouped by user story. US1 is the MVP (visible payoff). US2 codifies the policy. US3 validates ergonomic outcomes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks in the same phase)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths

## Path Conventions

This project is a Tauri desktop app. Frontend paths are rooted at `src/`. No `src-tauri/` files are touched. Biome plugin files are at the repo root under `biome-plugins/`. Specs live under `specs/039-theme-tokens-migration/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the small amount of net-new scaffolding the feature needs.

- [X] T001 Create `biome-plugins/` directory at repo root so `biome.json` can reference the plugin file

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Grow `src/styles/theme.ts` into the full 9-scale structure and stand up the TS applier + Biome plugin that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete. US1 needs the expanded scales to migrate to; the plugin is what prevents regression during migration.

- [X] T002 Expand `src/styles/theme.ts` to the 9 scales documented in `specs/039-theme-tokens-migration/data-model.md` (`colors`, `fonts`, `fontSizes`, `fontWeights`, `spacing`, `sizing`, `iconSizes`, `radii`, `shadows`) — add new `colors` tokens (`white`, `overlayHover08`, `overlayHover12`, `accentTranslucent15`, `swatchOutlineInset`, `transparent`, `canvasCheckerA`, `canvasCheckerB`), add a JSDoc `/** ... */` intent block above each exported scale, preserve every pre-existing token value unchanged
- [X] T003 [P] Add unit test `src/styles/theme.test.ts` asserting SC-007 floors (`Math.min(...Object.values(fontSizes)) === 11`, `Math.min(...Object.values(iconSizes)) === 12`) and that each scale object is non-empty
- [X] T004 Create `src/styles/applyThemeToRoot.ts` implementing `applyThemeToRoot(root?: HTMLElement): void` per `specs/039-theme-tokens-migration/contracts/dockview-tokens.md` (sets every `--dv-*` and `--app-*` CSS custom property listed in the contract, sourcing values from `theme.ts`)
- [X] T005 [P] Add unit test `src/styles/applyThemeToRoot.test.ts` (Vitest + jsdom): create a detached element, call `applyThemeToRoot(el)`, assert each custom property in the contract table resolves via `el.style.getPropertyValue(name)` to the expected value computed from `theme.ts`
- [X] T006 Wire `applyThemeToRoot()` into `src/main.tsx` — call it once before `createRoot(...)`; leave the existing `initEditorListener()` call in place
- [X] T007 Create `src/styles/dockview-overrides.css` containing ONLY the selector-based dockview rules (`.dv-tabs-and-actions-container`, `.dv-tabs-container`, `.dv-tab:focus-within::after`, `.dv-default-tab`, `.dv-sash`, `.dv-sash:not(.disabled):hover`) currently in `src/styles/dockview-theme.css`, referencing values exclusively via `var(--dv-*)` / `var(--app-*)` — no hand-authored hex or pixel literals
- [X] T008 Update `src/index.css` to reference `var(--app-background)`, `var(--app-text-primary)`, `var(--app-font-ui)` for `html, body, #root` styling, and add the two imports `@import "dockview/dist/styles/dockview.css";` and `@import "./styles/dockview-overrides.css";` (replacing the former `@import "./styles/dockview-theme.css";`)
- [X] T009 Delete `src/styles/dockview-theme.css`
- [X] T010 Author `biome-plugins/no-style-literals.grit` per `specs/039-theme-tokens-migration/contracts/biome-plugin.md` — Rule A (hex literal in style context), Rule B (magic pixel number in style context), Rule B' (numeric `size={N}` on lucide icon), all exemptions (`src/styles/theme.ts`, `src/styles/applyThemeToRoot.ts`, `src/utils/color.ts`, `src/utils/colorHex.ts`, `*.test.*`, `*.spec.*`, CSS keywords)
- [X] T011 Register the plugin in `biome.json` by adding `"plugins": ["./biome-plugins/no-style-literals.grit"]` at the top level

**Checkpoint**: App boots with the new token pipeline; visual appearance identical to before; `npm test` green for the two new test files; `npm run check` may report diagnostics in un-migrated components — that is expected and drives US1.

---

## Phase 3: User Story 1 — Visually coherent app across all panels (Priority: P1) 🎯 MVP

**Goal**: Every shipped panel, dialog, and chrome surface consumes tokens from `src/styles/theme.ts` exclusively. Equivalent affordances across panels resolve to identical token values. The app looks visually coherent; the user-visible payoff of the whole feature is delivered.

**Independent Test**: Open the app; compare any two equivalent affordances across panels (e.g. the `+` button in Layers vs the `+` button in Palette); confirm identical height, icon size, padding, and font metrics. Confirm no text ships below 11 px and no clickable icon ships below 12 px. Run `npm run check` and observe zero plugin diagnostics in `src/**` outside `src/styles/theme.ts`.

### Implementation for User Story 1

All migration tasks replace inline hex and magic-number literals with the corresponding theme tokens. Keep pre-migration behaviour byte-for-byte — shipped colour values do NOT change. Import tokens from `src/styles/theme` (relative paths vary by depth).

- [X] T012 [P] [US1] Migrate `src/components/panels/PanelHeader.tsx` to theme tokens (`colors.panelHeader`, `colors.textTitle`, `colors.iconDefault`, `spacing.md`, `spacing.lg`, `sizing.tabBarHeight`, `fontSizes.sm`, `iconSizes.sm`, `fontWeights.semibold`, `fonts.ui`)
- [X] T013 [P] [US1] Migrate `src/components/shell/AppShell.tsx` style literals to theme tokens
- [X] T014 [P] [US1] Migrate `src/components/shell/TitleBar.tsx` style literals to theme tokens
- [X] T015 [P] [US1] Migrate `src/components/shell/ToolsSidebar.tsx` to theme tokens — replace `width: 48`, `padding: "8px 4px"`, `gap: 4`, `36×36` tool button, separator `width: 28 / height: 1`, `"#FFFFFF"` on active, icon `size={18}` with `sizing.toolSidebarWidth`, `spacing.*`, `sizing.button.xl`, `colors.white`, `iconSizes.lg`
- [X] T016 [P] [US1] Migrate `src/components/shell/ToolOptionsBar.tsx` style literals to theme tokens
- [X] T017 [P] [US1] Migrate `src/components/shell/DockLayout.tsx` style literals to theme tokens
- [X] T018 [P] [US1] Migrate `src/components/canvas/CanvasViewport.tsx` to theme tokens AND move `CHECKERBOARD_COLOR_A`/`CHECKERBOARD_COLOR_B` out of `src/components/canvas/constants.ts` into `colors.canvasCheckerA` / `colors.canvasCheckerB` in `src/styles/theme.ts`; update `constants.ts` and `useCanvasRenderer.ts` to consume from theme. Leave non-visual constants (`ZOOM_LEVELS`, `GRID_THRESHOLD`, `GRID_MAX_OPACITY`, `FIT_PADDING`) in place — they are not style tokens
- [X] T019 [P] [US1] Migrate `src/components/color/ColorSlots.tsx`, `HsvGradient.tsx`, `HexInput.tsx` to theme tokens
- [X] T020 [P] [US1] Migrate `src/components/layers/LayersPanel.tsx`, `LayerRow.tsx`, `BlendModeSelect.tsx` to theme tokens (row heights → `sizing.rowHeight`, paddings → `spacing.*`, font sizes → `fontSizes.*`, colours → `colors.*`)
- [X] T021 [P] [US1] Migrate `src/components/palette/SwatchGrid.tsx` to theme tokens — replace `"0 0 0 2px #FFFFFF"` with `colors.white` and the ring composition, `rgba(0,0,0,0.35)` inset → `shadows.swatchInsetBorder`, swatch cell `minmax(16px, ...)` → `sizing` token or `spacing['2xl']` as appropriate
- [X] T022 [P] [US1] Migrate `src/components/palette/PaletteActionBar.tsx` and `src/components/palette/PaletteDropdown.tsx` to theme tokens — replace `ICON_SIZE = 12` with `iconSizes.sm`, `22×20` buttons with `sizing.button.*`, `"#FFFFFF"` with `colors.white`, and `"4"/"2"` gaps/margins with `spacing.*`
- [X] T023 [P] [US1] Migrate `src/components/palette/NewPaletteDialog.tsx`, `RenamePaletteDialog.tsx`, `ImportScopeDialog.tsx`, `ImportConflictDialog.tsx` to theme tokens
- [X] T024 [P] [US1] Migrate `src/components/status-bar/StatusBar.tsx` to theme tokens
- [X] T025 [P] [US1] Migrate the six panel wrappers under `src/components/panels/` (`CanvasViewportPanel.tsx`, `ColorPanel.tsx`, `LayersPanel.tsx`, `ModelPreviewPanel.tsx`, `PalettePanel.tsx`, `SourcesPanel.tsx`) to theme tokens
- [X] T026 [P] [US1] Audit `src/utils/toast.ts`, `src/hooks/**`, `src/store/**`, `src/api/**` for style literals and migrate any that exist; `src/utils/color.ts` and `src/utils/colorHex.ts` are exempt (user-data paths)
- [X] T027 [US1] Run `npm run check && npm run typecheck && npm test && npm run build`; resolve any remaining plugin diagnostics by migrating the offending literal to a theme token (or extending the theme); end with zero diagnostics. Validates SC-001, SC-002, SC-003, SC-004
- [X] T028 [US1] Boot the app with `npm run tauri dev` and visually verify each panel listed in FR-006 (Sources, Layers, Color, Palette, Canvas, Model Preview, title bar, status bar, dialogs) — confirm pre-migration appearance is preserved, action buttons and icons look uniform across panels, and no text/icon is smaller than 11/12 px. Validates US1 independent test + SC-004, SC-007

**Checkpoint**: US1 complete — MVP ready. The app is visually coherent, plugin holds the line, and no shipped text/icon is below the legibility floor.

---

## Phase 4: User Story 2 — Theme is the single source of truth going forward (Priority: P2)

**Goal**: Codify the "theme-first, mockups second" rule in project documentation so future contributors and AI agents follow it by default.

**Independent Test**: Open `.specify/memory/constitution.md` — find principle VIII, named and self-contained. Open `CLAUDE.md` — find the "Visual tokens" subsection pointing at the principle. A new reader can answer SC-006's three questions (where do values live, what role do mockups play, what if a token is missing) using only these two documents.

### Implementation for User Story 2

- [X] T029 [US2] Add principle **VIII. Theme-First, Mockups Second** to `.specify/memory/constitution.md` (text per `specs/039-theme-tokens-migration/research.md` §R7) — include rule for missing tokens (extend-first-consume-second), structural exceptions (`0`, `1px`, `100%`, `auto`), user-generated-colour exemption, legibility-floor rule, WCAG AA aspirational note. Update the Sync Impact Report at file top. Bump version `1.0.0` → `1.1.0` and update **Last Amended** date to `2026-04-23`. Satisfies FR-007, SC-005
- [X] T030 [US2] Add **Visual tokens** subsection to `CLAUDE.md` under the **Architecture** section with three lines (theme is sole source / mockups are structural references / extend-first-then-consume) and a cross-reference to principle VIII. Satisfies FR-008, SC-005, SC-006

**Checkpoint**: US2 complete — the written rule holds the US1 investment.

---

## Phase 5: User Story 3 — Consuming the theme is the obvious path for contributors (Priority: P3)

**Goal**: Validate that the theme module's structure makes extending it trivial and self-explanatory.

**Independent Test**: A reviewer opens `src/styles/theme.ts` and can (a) name each scale present, (b) find a short JSDoc comment on each scale describing its intent, (c) add a plausible new token to any scale without inventing a new file, without renaming existing tokens, and without modifying any consumer. SC-008 demonstrated by reverting the sample addition.

### Implementation for User Story 3

- [X] T031 [US3] Re-review each scale's JSDoc intent block in `src/styles/theme.ts`; ensure each answers "when do I reach for this scale?" in one or two sentences; tighten wording where generic. Satisfies FR-011, US3 independent test (a)/(b)
- [X] T032 [US3] SC-008 demonstration: on a scratch throwaway commit, add a plausible token to an existing scale (e.g. `spacing['5xl']: 40` or `radii.xl: 8`), run `npm run check && npm run typecheck && npm test && npm run build`; confirm no consumer required changes and all commands pass. Revert the scratch commit before merging. Record the result in the PR description

**Checkpoint**: US3 complete — theme module is demonstrably self-documenting and additive.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation passes and cross-cutting verifications not tied to a single story.

- [X] T033 [P] SC-009 negative test: on a scratch throwaway commit, reintroduce a hex literal (e.g. `background: "#abcdef"`) inside any migrated component under `src/components/**`; run `npm run check`; confirm the Biome plugin emits exactly one diagnostic with the expected message; revert. Also push the scratch commit to a throwaway branch to confirm CI's `Frontend` job fails on the same diagnostic. Record the result in the PR description
- [X] T034 Run `/speckit.analyze` to validate spec ↔ plan ↔ tasks consistency (non-destructive; resolve any flagged drift)
- [X] T035 Walkthrough `specs/039-theme-tokens-migration/quickstart.md` as if a new contributor: confirm the three SC-006 questions are answerable from only `CLAUDE.md` + constitution; update phrasing in either document if any question remains ambiguous
- [X] T036 [P] Run `npm run check:fix` (defined in `package.json` as `biome check --write src/`) to apply final formatting adjustments across migrated files

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 Setup**: no dependencies
- **Phase 2 Foundational**: depends on Phase 1
- **Phase 3 US1 (P1)**: depends on Phase 2 (needs expanded theme scales + applier + plugin); internal tasks T012–T026 can run in parallel, T027 depends on all of them, T028 depends on T027
- **Phase 4 US2 (P2)**: depends on Phase 2 at minimum; safe to parallelise with Phase 3 since US2 only touches docs (no code overlap)
- **Phase 5 US3 (P3)**: depends on T002 (needs the 9-scale shape present); T031 can run in parallel with US1/US2; T032 should run after US1 completes (to exercise the real migrated consumers)
- **Phase 6 Polish**: depends on Phase 3 (T027, T028) for T033; T034/T035/T036 can run any time after US1 & US2 close

### Within each story

- No TDD ordering required (tests are unit-level guards in Phase 2, not per-component story tests).
- Migration tasks (T012–T026) are independent by file — hence `[P]`.
- Policy tasks (T029, T030) are independent by file — but bundled sequentially because T030 references principle VIII introduced in T029; run T029 first.

### Parallel opportunities

- Phase 2: T003 parallel to T002–T006 path? T003 depends on T002 (imports theme). T005 depends on T004. Run in sequence: (T002 → T003) and (T004 → T005) and (T006 → T007 → T008 → T009) and (T010 → T011); within Phase 2 there are multiple parallelisable small branches.
- Phase 3: T012–T026 all parallelisable — 15 parallel migration tasks.
- Phase 4: T029 then T030 (sequential).
- Phase 5: T031 parallel to anything after T002; T032 after Phase 3.
- Phase 6: T033, T034, T035, T036 largely independent.

---

## Parallel Example: User Story 1

```bash
# Launch all US1 migration tasks together (each touches different files):
Task: "T012 Migrate src/components/panels/PanelHeader.tsx"
Task: "T013 Migrate src/components/shell/AppShell.tsx"
Task: "T014 Migrate src/components/shell/TitleBar.tsx"
Task: "T015 Migrate src/components/shell/ToolsSidebar.tsx"
Task: "T016 Migrate src/components/shell/ToolOptionsBar.tsx"
Task: "T017 Migrate src/components/shell/DockLayout.tsx"
Task: "T018 Migrate src/components/canvas/CanvasViewport.tsx + canvas checkerboard tokens"
Task: "T019 Migrate src/components/color/*"
Task: "T020 Migrate src/components/layers/*"
Task: "T021 Migrate src/components/palette/SwatchGrid.tsx"
Task: "T022 Migrate src/components/palette/PaletteActionBar.tsx + PaletteDropdown.tsx"
Task: "T023 Migrate src/components/palette/*Dialog.tsx"
Task: "T024 Migrate src/components/status-bar/StatusBar.tsx"
Task: "T025 Migrate src/components/panels/*Panel.tsx wrappers"
Task: "T026 Audit + migrate src/utils/toast.ts + hooks/store/api"

# Then (sequential):
Task: "T027 Run full CI locally, zero diagnostics"
Task: "T028 Boot app + visual parity check"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup (T001)
2. Phase 2 Foundational (T002 – T011) — theme grown, applier running, plugin registered
3. Phase 3 US1 (T012 – T028) — all components migrated, CI green, visual parity confirmed
4. **STOP** and validate: the app is visually coherent, `npm run check` passes, no text below 11 px, no icon below 12 px
5. Ship as MVP if time-boxed; otherwise continue

### Incremental Delivery

1. Foundation ready → CI still sees diagnostics, but app boots identically
2. US1 (migration) → CI green, MVP demo-ready, visual parity
3. US2 (docs) → future contributors / AI agents follow the rule by default
4. US3 (ergonomics) → self-documentation validated
5. Polish → enforcement regression tested, quickstart walked through

### Solo-developer Strategy (this project)

US1 is the bulk of the work. Treat T012–T026 as a batch: migrate one component subdirectory at a time, run `npm run check` after each subdirectory to shrink the diagnostic count, commit per subdirectory with a conventional `refactor:` message referencing issue #39. After all subdirectories are clean, close US1 with T027 + T028, then move through US2/US3/Polish sequentially.

---

## Notes

- `[P]` tasks touch different files and have no dependency on any other incomplete task in the same phase.
- Shipped colour values MUST NOT change during this feature — contrast tuning is a separate follow-up. Any diff in rendered pixels (other than structural ones that cancel out) is a regression.
- The Biome plugin's first pass may reveal edge cases in the GritQL predicates (false positives/negatives). Tune the plugin in T010 if a migrated component still trips a valid construct; do NOT widen exemptions beyond the documented set (spec FR-012).
- Test files (`*.test.ts*`, `*.spec.*`) are exempt from the plugin. They may continue to assert specific colour and pixel values as part of component behaviour checks.
- `src/utils/color.ts` and `src/utils/colorHex.ts` are user-data paths and stay untouched.
