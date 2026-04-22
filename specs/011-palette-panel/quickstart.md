# Quickstart — Palette Panel (Manual Verification)

This file lists the manual-verification passes to run once the feature is
implemented. Each scenario maps directly to a user story or an edge case from
the spec. Automated coverage is described in
[research.md §11](./research.md#11-testing-strategy).

Before starting:

```bash
pnpm tauri dev   # (or npm run tauri dev) — launch the app
```

Ensure the Palette panel is visible (dockview → default layout puts it under
Color; drag it into view if minimized).

---

## US1 — Use an existing palette to paint (P1)

**Setup**: Seed one palette named "Smoke Test" with at least 3 colors,
either via the "New Palette" button + manual pipette OR by placing a
`.texpal` fixture in `<app_data_dir>/palettes/` before launch.

1. Open the palette dropdown → "Smoke Test" is listed, with a global-scope
   icon beside it.
2. Select "Smoke Test" → the swatch grid fills with all three colors in the
   saved order (FR-003).
3. Left-click the second swatch → the primary color slot in the Color panel
   updates to that color; the swatch shows the primary-active ring (FR-013,
   FR-015).
4. Right-click the third swatch → the secondary color slot updates; the
   swatch shows the secondary-active ring (FR-014, FR-015).
5. Draw a stroke on the canvas → pixels use the primary color exactly
   (byte-for-byte match — verify via pipette tool).

**Pass criteria**: SC-001 (under 5 s from open to first paint) holds on a
warm launch.

---

## US2 — Build a palette by capturing colors (P2)

1. Click **New Palette** in the panel header.
2. Enter the name `Nether`, leave scope as **Global**, confirm → a new empty
   palette becomes active; the empty state greets you with "Add colors".
3. Click the panel's **Pipette** button → the button highlights, the panel
   header shows a "Pipette active" indicator (FR-010).
4. Click a pixel on the canvas → a new swatch appears in the grid, matching
   the clicked pixel's composite color.
5. Click the same pixel again → no second swatch appears; the existing one
   briefly pulses (FR-011).
6. Set the primary color to something not yet in the palette (Color panel
   HSV gradient) and click **Add Primary** → the swatch is appended.
7. Press `Esc` → the pipette indicator disappears; the previously active
   tool (brush) is restored.
8. Left-click any swatch to make it the primary; press `Delete` → the
   swatch is removed (FR-012). Press `Delete` again while the primary no
   longer matches any swatch → no-op, no error in console.

**Pass criteria**: SC-002 (under 15 s from new-palette click to first
swatch) holds.

---

## US3 — Scope routing (P2)

**Pre-requisite**: A project is currently open via whatever
not-yet-implemented UI exists (for the duration of this feature, this means
manually setting `AppState.current_project_path` via a dev utility or a
future project command).

1. Create a palette `Proj Tones` → choose **Project** as scope → it appears
   with a project-scope icon (FR-018).
2. Create a palette `Signature` → **Global** scope → global-scope icon.
3. Close the project (or clear `current_project_path`).
4. Reopen the dropdown → only `Signature` is listed; the **New Palette**
   dialog's "Project" option is disabled with tooltip explaining why
   (FR-022, Edge case "No project open").
5. Reopen the project → `Proj Tones` reappears in the dropdown alongside
   `Signature`; the scope icons still distinguish them (FR-017, FR-018).
6. Open a different project → `Proj Tones` is not listed (SC-008 visual
   distinction test is useful here).

**Pass criteria**: SC-004 (100 % project palette survival) and SC-005 (100 %
global survival across restart).

---

## US4 — Export/import round trip (P3)

1. With `Signature` active, click **Save** in the panel header → native
   Save dialog opens, filtered to `*.texpal`, default name `Signature.texpal`.
2. Save to Desktop → file appears; open it in a text editor and verify the
   JSON matches [`contracts/texpal-schema.json`](./contracts/texpal-schema.json).
3. Delete `Signature` from the panel (confirm dialog → OK) — it disappears
   from the dropdown and another palette becomes active.
4. Click **Load** in the panel header → pick `Signature.texpal` from
   Desktop → the import dialog asks for destination scope; pick **Global**.
5. Dropdown now contains `Signature` again with the same colors in the same
   order (SC-006).
6. Click **Load** again on the same file → destination **Global** → the
   `ImportConflictDialog` appears with:
   - Default action pre-selected: **Rename**
   - Suggested name pre-filled: `Signature (2)` (editable)
   - Buttons: Cancel / Rename / Overwrite
7. Test each action:
   - **Cancel** → no change to the dropdown.
   - **Rename** with `Signature backup` → a new palette `Signature backup`
     appears alongside `Signature`.
   - **Overwrite** → `Signature`'s colors become whatever the file contains
     (visibly the same here); the existing id is preserved (verify by
     inspecting the file on disk still has the same `id`).

**Edge case — malformed file**

1. Copy `Signature.texpal` to `Signature-broken.texpal` and truncate the
   last `]`.
2. Attempt to load → a toast appears within ≤ 2 s reading
   "Invalid palette file" with a short reason (SC-007, FR-021).
3. Existing palettes in the dropdown are unchanged (verify by counting
   before/after).

---

## Cross-cutting checks

- **Restart the app** with `Signature` active (global). Relaunch → the
  dropdown pre-selects `Signature` (FR-023a global memory).
- **Switch projects** while `Proj Tones` is active in project A, then open
  project B where no palette was ever selected → a deterministic fallback
  palette is active (project-first alphabetical, then global alphabetical).
- **Dock/undock** the panel into a different group → state survives
  (Principle VII — layout persistence).

---

## Automated-test smoke (optional, runs in ≤ 20 s)

```bash
cd src-tauri && cargo test palette     # domain + use-case + infra
pnpm test                              # vitest: paletteStore + components
```

Both suites must pass before merging; CI will gate on them.
