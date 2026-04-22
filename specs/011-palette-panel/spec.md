# Feature Specification: Palette Panel (create, load, save, switch, scopes)

**Feature Branch**: `011-palette-panel`
**Created**: 2026-04-12
**Status**: Draft
**Input**: GitHub issue #11 — "Palette panel (create, load, save, switch, scopes)"

## Clarifications

### Session 2026-04-22

- Q: Comment un swatch devient-il la cible de la touche Delete, puisque le clic gauche/droit est déjà pris par primary/secondary ? → A: Le swatch actuellement lié au **primary** est la cible de Delete. Pas d'état « sélection » séparé.
- Q: Que se passe-t-il à l'import si le nom de la palette existe déjà dans le scope de destination ? → A: Dialogue de conflit avec 3 actions (*Annuler* / *Renommer avec suffixe auto* / *Écraser*). *Renommer* est l'action par défaut.
- Q: La pipette du panel Palette est-elle persistante ou one-shot ? → A: **Mode persistant**. Activation via le bouton pipette du panel ; chaque clic canvas ajoute un swatch à la palette active. Sortie via Échap, reclic sur le bouton pipette, ou sélection d'un autre outil. Un indicateur visuel signale l'état actif.
- Q: Comment la palette active est-elle restaurée entre sessions et entre projets ? → A: **Mémorisation par contexte** : (a) la dernière palette active globale et (b) la dernière palette active pour **chaque projet** sont retenues séparément. À l'ouverture, la palette active est restaurée selon le contexte ; si l'entrée mémorisée a disparu, fallback à la première palette disponible.
- Q: Quelle est l'extension du fichier d'export/import de palette ? → A: Extension propriétaire **`.texpal`** (contenu JSON). Le file picker filtre par défaut sur `.texpal`. Import multi-format laissé hors scope v1.
- Q: Quelles actions sur les swatches existants sont supportées en v1, au-delà d'ajouter/supprimer ? → A: **Aucune**. Pas de réordonnancement (drag-and-drop) ni d'édition en place de la couleur d'un swatch en v1. Pour modifier une couleur, l'utilisateur supprime puis ré-ajoute (la position en fin de liste est acceptée comme coût). Ces capacités sont renvoyées à une v2.
- Q: Un utilisateur peut-il déplacer ou dupliquer une palette entre scopes (global ↔ projet) via l'UI ? → A: **Aucune opération cross-scope native en v1**. Le transfert entre scopes passe par le workflow export (`.texpal`) puis import dans le scope cible (FR-019/FR-020/FR-020a). Pas d'action « Déplacer » ni « Dupliquer vers l'autre scope » dans le panel.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Use an existing palette to paint (Priority: P1)

As a resource pack creator working on a themed texture set, I want to open a panel that shows a curated set of colors so I can click them to paint consistently across my textures without re-picking hex codes.

**Why this priority**: This is the core value of a palette panel — accelerating color selection and ensuring visual consistency. Without it, creators waste time re-entering hex values and drift off-theme. Every other capability (creating, saving, sharing palettes) is worthless if the user cannot first *use* a palette to paint.

**Independent Test**: Open the panel, select any non-empty palette from the dropdown, left-click a swatch, and verify the primary color updates. Right-click another swatch and verify the secondary color updates. Paint on the canvas and confirm the chosen colors are applied.

**Acceptance Scenarios**:

1. **Given** the Palette panel is visible and at least one palette exists, **When** the user opens the palette dropdown and selects a palette, **Then** the swatch grid shows all colors of that palette in the order they were saved.
2. **Given** a palette is active with at least one swatch, **When** the user left-clicks a swatch, **Then** the primary color of the editor becomes that swatch's color and the swatch is visually marked as the active primary.
3. **Given** a palette is active with at least one swatch, **When** the user right-clicks a swatch, **Then** the secondary color of the editor becomes that swatch's color and the swatch is visually marked as the active secondary.
4. **Given** the user has selected a primary color from a palette, **When** they draw on the canvas, **Then** the pixels are painted with exactly that color.

---

### User Story 2 - Build a palette by capturing colors from my work (Priority: P2)

As a creator iterating on a new texture set, I want to create a new named palette and progressively add colors to it — either from the canvas (pipette on existing pixels) or from the current primary color — so I can lock in my evolving theme as I go.

**Why this priority**: Using palettes (P1) requires palettes to exist. This story delivers the authoring loop. It unlocks the creative workflow but depends on P1 existing, since the point of capturing colors is to later use them to paint.

**Independent Test**: Click the "new palette" action, provide a name, then add at least two colors to it (one via pipette from a canvas pixel, one from the current primary color), remove one of them, and verify the palette now contains the expected remaining color.

**Acceptance Scenarios**:

1. **Given** the panel is visible, **When** the user triggers the "new palette" action and enters a name, **Then** a new empty palette with that name is created and becomes the active palette.
2. **Given** an active palette and a texture open on the canvas, **When** the user activates the pipette action and clicks a canvas pixel, **Then** the color of that pixel is appended to the active palette as a new swatch.
3. **Given** an active palette with at least one swatch, **When** the user selects a swatch and presses the Delete key, **Then** the swatch is removed from the palette and the grid reflows.
4. **Given** the user attempts to create a palette with an empty name or a name already used in the current scope, **Then** the system prevents the creation and explains why.

---

### User Story 3 - Share palettes globally or keep them tied to a project (Priority: P2)

As a creator who works on multiple resource packs, I want some palettes to follow me across every project (e.g. "my signature skin tones") while others stay bound to a specific project (e.g. "Nether update mod tones"), and I want to see at a glance which scope a palette belongs to.

**Why this priority**: Scopes are what make the palette system useful beyond a single project. Without scoping, users either pollute every project with one-off palettes or lose reusable ones. It comes after P1/P2 because a single palette in a single scope is already useful; scoping is what makes the feature scale.

**Independent Test**: Create one palette scoped to the current project and one palette scoped globally. Close and reopen the project: the project palette is still listed. Open a different project: the global palette is listed but the first project palette is not.

**Acceptance Scenarios**:

1. **Given** the user creates a new palette, **When** the creation dialog is shown, **Then** the user can choose between "global" (user-scope) and "project" (current-project-scope).
2. **Given** palettes exist in both scopes, **When** the user opens the palette dropdown, **Then** each palette entry is visually tagged with a scope indicator (global vs. project icon).
3. **Given** a project-scoped palette exists, **When** the user closes and reopens that project, **Then** the palette is still available.
4. **Given** a global-scoped palette exists, **When** the user switches to a different project, **Then** the palette is still available.
5. **Given** a project-scoped palette exists, **When** the user opens a different project, **Then** that palette is NOT listed.

---

### User Story 4 - Save and load palettes as files (Priority: P3)

As a creator who wants to share palettes with teammates or reuse them across machines, I want to save a palette to a file and load a palette from a file so my color work is portable.

**Why this priority**: Portability is valuable but not required for the feature to deliver its core value. A user can be productive with only internally managed palettes (P1–P3). This story is explicitly called out in the issue and rounds out the feature for collaboration use cases.

**Independent Test**: Save an existing palette to a file, delete the palette from the active scope, load the file back, and verify the palette reappears with the same name and colors in the same order.

**Acceptance Scenarios**:

1. **Given** an active palette, **When** the user triggers the "save palette to file" action and picks a location, **Then** a file is written that contains the palette's name and the ordered list of its colors.
2. **Given** a palette file previously saved by the app, **When** the user triggers the "load palette from file" action and picks the file, **Then** a palette is imported into a chosen scope and becomes selectable in the dropdown.
3. **Given** a palette file that is malformed or unreadable, **When** the user tries to load it, **Then** the app shows a clear error message and does not corrupt any existing palette.

---

### Edge Cases

- **Empty palette**: When the active palette has no swatches, the grid area shows an explanatory empty state and does not crash on delete/pipette actions.
- **No palette available in either scope**: The panel shows an empty state inviting the user to create a new palette; all swatch-dependent actions are disabled.
- **Deleting the active palette**: The next available palette (in the same scope, then the other) becomes active, or the empty state is shown if none remain.
- **No project open**: The user can still see and use global palettes. Creating a project-scoped palette is disabled with a tooltip explaining why.
- **Duplicate palette names within a scope**: Creation or rename is rejected with a clear message; names must be unique per scope.
- **Color already in palette**: Adding a color (via pipette or manual add) that already exists in the active palette is allowed but must not create a silent duplicate — the existing swatch is highlighted instead of appending.
- **Delete key while no swatch is bound to the primary color**: No-op; does not affect canvas or other panels.
- **Unicode and long palette names**: Names longer than a reasonable limit (see Assumptions) are truncated in the dropdown with an ellipsis and a full-name tooltip.
- **Concurrent edits to a project palette from outside the app**: On next project load the file state is the source of truth; stale in-memory state is discarded.
- **Import name collision in destination scope**: A conflict dialog is shown with *Cancel* / *Rename* / *Overwrite*; *Rename* is the default and suggests a unique name the user can edit before confirming. No silent import on collision.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a dockable Palette panel that can be shown, hidden, and arranged alongside other editor panels.
- **FR-002**: The panel MUST display a dropdown listing every palette currently available from both the global scope and the active project scope.
- **FR-003**: The panel MUST display the active palette as a grid of color swatches in the order the colors were added.
- **FR-004**: Users MUST be able to create a new palette, provide a name for it, and choose whether it is stored in the global scope or the current project scope.
- **FR-005**: The system MUST enforce unique palette names within each scope; creation or rename with a conflicting name MUST be rejected with a clear message.
- **FR-006**: The system MUST prevent the creation of a palette with an empty or whitespace-only name.
- **FR-007**: Users MUST be able to rename an existing palette without losing its colors.
- **FR-008**: Users MUST be able to delete a palette, and the system MUST ask for confirmation before deletion.
- **FR-009**: Users MUST be able to add a color to the active palette from the current primary color.
- **FR-010**: Users MUST be able to add a color to the active palette by activating a pipette action and clicking a canvas pixel. The pipette is a **persistent mode**: once activated from the panel's pipette button, each subsequent canvas click appends a swatch to the active palette until the user exits the mode. Exiting MUST be possible via (a) pressing Escape, (b) clicking the pipette button again, or (c) selecting another tool. The panel MUST display an unambiguous visual indicator while the pipette mode is active.
- **FR-011**: The system MUST avoid creating silent duplicates when the color being added already exists in the active palette; instead the existing swatch MUST be surfaced/highlighted.
- **FR-012**: Users MUST be able to remove the swatch currently bound to the primary color from the active palette by pressing the Delete key or triggering an equivalent UI action. There is no separate "selected swatch" state — Delete targets the primary-bound swatch. If no swatch is currently bound to the primary color, Delete is a no-op.
- **FR-013**: Left-clicking a swatch MUST set the editor's primary color to that swatch's color.
- **FR-014**: Right-clicking a swatch MUST set the editor's secondary color to that swatch's color.
- **FR-015**: The active primary and secondary swatches MUST be visually distinguishable in the grid at all times.
- **FR-016**: The system MUST persist global-scope palettes such that they are available across all projects and across app restarts.
- **FR-017**: The system MUST persist project-scope palettes such that they are available only when the owning project is open and survive project close/reopen.
- **FR-018**: The panel MUST show a scope indicator on each palette entry that unambiguously distinguishes global palettes from project-scoped palettes.
- **FR-019**: Users MUST be able to export (save) any palette to a shareable file. Exported files MUST use the `.texpal` extension. The file picker MUST default to filtering on `*.texpal`.
- **FR-020**: Users MUST be able to import (load) a palette from a file and choose the destination scope (global or current project). The import file picker MUST default to filtering on `*.texpal`.
- **FR-020a**: When an imported palette's name collides with an existing palette in the destination scope, the system MUST present a conflict dialog offering three actions: *Cancel* (abort the import, no changes), *Rename* (import with an auto-suggested unique suffix, e.g. `MyPalette (2)`, editable by the user before confirming), and *Overwrite* (replace the existing palette's contents and keep its name). *Rename* MUST be the default action.
- **FR-021**: The system MUST detect and reject malformed palette files with a clear error message and without altering any existing palette.
- **FR-022**: When no project is open, the panel MUST still allow the user to see and use global palettes; project-scope operations MUST be disabled with an explanation.
- **FR-023**: Deleting the currently active palette MUST automatically select another available palette, or show an empty state if none remain.
- **FR-023a**: The system MUST persist the last active palette **per context**: one remembered value for the global scope (used when no project is open) and one remembered value **per project**. On app start or project open, the active palette MUST be restored from the matching context. If the remembered palette no longer exists (deleted, renamed, or file removed), the system MUST fall back to the first available palette in a deterministic order (project palettes first, then global, alphabetical within each scope).
- **FR-024**: All palette-panel actions listed by the issue (new palette, save, load, pipette) MUST be accessible via visible UI controls at the top of the panel body (a header-style action bar rendered *inside* the panel content, not in the dockview tab header — constitution Principle VII reserves the tab header for the grip icon and title only).

### Key Entities *(include if feature involves data)*

- **Palette**: A named, ordered collection of colors owned by a scope. Attributes: name (unique per scope), scope (global or project), ordered list of colors.
- **Swatch**: A single color entry inside a palette. Attribute: a color value. A swatch belongs to exactly one palette.
- **Scope**: A storage context that owns a set of palettes. Two scopes exist: the global/user scope (shared across every project) and the project scope (tied to the currently open project).
- **Active Palette**: The single palette whose swatches are currently shown in the grid and targeted by add/remove actions. At most one active palette per panel.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A creator can open the panel, select an existing palette, and set a primary color from it in under 5 seconds, without using the keyboard.
- **SC-002**: A creator can create a new named palette from scratch and add their first color to it in under 15 seconds.
- **SC-003**: Switching the active palette from one to another feels instantaneous on a palette of up to 256 swatches (no perceptible delay in user testing).
- **SC-004**: 100% of project-scoped palettes are still present after closing and reopening the project.
- **SC-005**: 100% of global-scoped palettes are still present after switching between projects and after restarting the app.
- **SC-006**: A palette exported to a file by one user and imported by another user reproduces the exact same ordered list of colors and the same name.
- **SC-007**: When loading a malformed palette file, the user sees an explanation within 2 seconds and zero existing palettes are modified.
- **SC-008**: In user testing, at least 9 out of 10 first-time users correctly identify which palettes are global vs. project-scoped without reading documentation, based solely on the scope indicator.

## Assumptions

- **Color model**: Palette colors are opaque RGB values expressed as 6-digit hexadecimal strings (e.g. `#A3B5C7`). Alpha is out of scope for v1 since the feature targets flat color selection for pixel art.
- **Palette file format**: Palette files use the `.texpal` extension and contain JSON with at minimum a palette name and an ordered list of hex colors, as the issue specifies. The exact schema (versioning, optional metadata) is an implementation detail to be finalized in `/speckit.plan`. Import of third-party formats (GPL, ASE, PAL) remains out of scope for v1.
- **Storage locations**: Global palettes live under the user's TexLab home directory (the issue suggests `~/.texlab/palettes/`). Project palettes live under the current project directory (the issue suggests `<project>/palettes/`). Exact paths will be confirmed in the plan and must align with existing project-structure conventions.
- **Name length**: Palette names are limited to a reasonable display length (assumed 64 characters) to keep the dropdown readable.
- **Palette size**: The panel is designed to remain responsive for palettes up to ~256 swatches, which covers realistic Minecraft resource-pack use cases.
- **Primary/secondary color integration**: The primary and secondary colors manipulated by this feature are the same ones exposed by the existing Color panel (issue #9). This feature reads and writes those values, it does not define a separate color state.
- **Panel hosting**: The panel is embedded in the existing dockable panel system (issue #7). This feature assumes the dock system provides show/hide/arrange capabilities and does not redefine them.
- **Pipette scope**: The pipette described here adds a color to the active palette by sampling a canvas pixel. It does not replace any future general-purpose eyedropper tool and is limited to the palette authoring flow.
- **Dependencies**: Depends on #7 (dockable panel system) and #9 (Color panel) being in place before this feature can be fully delivered.
- **Out of scope for v1**: Gradient palettes, palette folders/categories, cloud sync, palette import from external formats (GPL, ASE, PAL), color harmonies, searching within a palette, **reordering swatches within a palette (drag-and-drop)**, **editing the color of an existing swatch in place**, and **cross-scope operations on palettes** (no native "move to other scope" or "duplicate to other scope" actions — transfer between global and project scopes is achieved via the existing export/import workflow).
