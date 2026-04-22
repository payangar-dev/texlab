# Phase 0 — Research: Palette Panel

All `NEEDS CLARIFICATION` items from the spec have been resolved either during
the clarification session (see spec §Clarifications) or here below. This file
records the technical decisions that the plan relies on.

---

## 1. Storage layout: where do palette files live?

**Decision**

- **Global scope**: `<app_data_dir>/palettes/*.texpal`
- **Project scope**: `<project_root>/palettes/*.texpal`
- **Active-palette memory**: `<app_data_dir>/palette-state.json`

**Rationale**

- The spec's Assumptions section proposes `~/.texlab/palettes/` but explicitly
  defers the final path to the plan and asks that it align with existing
  conventions. The codebase already uses Tauri's `app.path().app_data_dir()`
  for `workspace.json` (see `src-tauri/src/commands/layout_commands.rs`), and
  Tauri v2 recommends `app_data_dir()` over ad-hoc home-directory paths for
  cross-platform consistency (Windows `%APPDATA%\com.texlab.TexLab`, macOS
  `~/Library/Application Support/com.texlab.TexLab`, Linux
  `~/.local/share/com.texlab.TexLab`).
- Project-scope placement mirrors the CLAUDE.md convention (`<project>/…`)
  and keeps palettes portable: a project copied to another machine brings its
  palettes with it.
- A dedicated `palette-state.json` beside `workspace.json` avoids coupling
  palette-active memory to either the workspace layout or any project file.
  Keyed JSON: `{ "global": "<paletteId>", "projects": { "<absolute-path>":
  "<paletteId>" } }`.

**Alternatives considered**

- `~/.texlab/palettes/` (verbatim from the issue). Rejected: not a canonical
  Tauri location; harder to unify with existing workspace persistence.
- Storing active-palette memory inside `workspace.json`. Rejected: conflates
  concerns and complicates partial resets.
- Storing per-project memory inside the project directory itself. Rejected:
  we don't yet have a project-management feature, and adding another
  per-project sidecar file when a single keyed map in app-data suffices is
  unnecessary complexity (Principle VI).

---

## 2. `.texpal` file format

**Decision**

```jsonc
{
  "version": 1,
  "name": "Nether Tones",
  "colors": ["#3A1D1D", "#5E2B20", "#8A4A2E"]
}
```

Validation rules (enforced in infrastructure, never in domain):

- `version === 1` — anything else is rejected as "unsupported palette
  version".
- `name`: string, 1–64 chars, trimmed non-empty. Whitespace-only rejected.
- `colors`: array of unique 7-char strings matching `/^#[0-9A-Fa-f]{6}$/`.
  Duplicates in a file are silently deduplicated at import time (mirrors the
  FR-011 no-duplicate invariant), which is logged but not a parse error.
- Unknown top-level keys are ignored (forward-compatible).

**Rationale**

- JSON is already the project's serialization format of record (workspace
  layout, `project.texlab.json`). No new dependency needed beyond `serde_json`
  (transitively available via `serde`).
- The issue, the clarifications, and the spec's Assumptions all converged on
  hex-only, opaque-RGB, ordered list. Alpha and other formats are explicit
  v1 non-goals.
- A `version` field lets us evolve the schema (e.g., add palette metadata)
  without breaking parsers. Keeping it on the file, not on the domain type,
  respects Principle II (Domain Purity).

**Alternatives considered**

- GPL / ASE / PAL formats. Rejected by the spec (v1 scope).
- TOML. Rejected: no existing TOML parser in-tree; JSON is sufficient and
  easier to hand-edit.
- Embedding palette data inside an existing project/workspace file. Rejected:
  violates the export/import story (FR-019, FR-020) which requires
  self-contained shareable files.

---

## 3. Color model

**Decision** — Palette colors are stored and transported as `#RRGGBB`
strings. In-memory domain uses the existing `domain::Color` value object
(already RGBA u8). The palette module normalizes alpha to `255` on read and
drops alpha on write.

**Rationale** — The spec's assumptions section fixes opaque RGB for v1. Reusing
`Color` avoids a parallel color type inside `domain/palette.rs` and keeps the
pipette path trivial (the eyedropper already returns `domain::Color`).

**Alternatives considered** — Store `Color` directly (with alpha) in the
palette. Rejected: diverges from the v1 "opaque RGB only" contract and would
confuse import/export semantics.

---

## 4. Name validation

**Decision** — `PaletteName` is a newtype over `String` with a private
constructor. Rules:

- Trimmed length ∈ [1, 64] Unicode scalar values.
- No leading/trailing whitespace after normalization.
- NFC normalization applied before uniqueness comparison (so "é" encoded two
  ways is detected as a collision).
- Case-sensitive uniqueness per scope (matches filesystem behavior on macOS
  case-preserving volumes and Linux case-sensitive volumes; Windows NTFS is
  case-insensitive so we additionally lower-case for collision detection on
  Windows — see §5).

**Rationale** — Principle II: invariants enforced at construction make
invalid palette names unrepresentable. 64 chars is the assumption baked into
the spec for dropdown readability. NFC prevents Unicode look-alikes.

**Alternatives considered** — Case-insensitive uniqueness everywhere.
Rejected: surprises Linux/macOS users whose FS allows "Blues" and "blues" to
coexist. Kept case-sensitive by default and only collapsed on Windows where
the filesystem forces the issue.

---

## 5. File naming strategy

**Decision** — One `.texpal` file per palette. File basename is derived from
the palette name with the following transform:

1. NFC-normalize the name.
2. Replace each char in `< > : " / \ | ? * \0` and ASCII controls with `_`.
3. Trim trailing dots and spaces (Windows restriction).
4. Append `.texpal`.

If the transformed basename collides with an existing file (possible on
case-insensitive filesystems, or when two distinct Unicode names normalize to
the same basename), append `-<8 hex chars>` derived from a UUIDv4 at create
time and persist the mapping through a `"id"` field stored inside the file.

**Rationale** — Humans look at palette files in Finder/Explorer; a readable
basename beats a UUID. But we still need a stable identifier to survive
rename and uniqueness clashes — storing the UUID *inside* the file keeps the
basename cosmetic.

**Alternatives considered**

- Use pure UUID filenames. Rejected: opaque; makes manual inspection painful.
- Maintain a separate index file. Rejected: extra IO failure surface and
  violates Principle VI; the file itself can be the source of truth.

---

## 6. Active-palette restore (FR-023a)

**Decision** — On startup:

1. Load `palette-state.json` → `{ global: Option<paletteId>, projects: Map<path, paletteId> }`.
2. When no project is open, pick `global` → if missing/stale, fallback
   order: first palette in global scope, alphabetical by name.
3. When a project is open, pick `projects[<project_abs_path>]` → if
   missing/stale, fallback order: first palette in project scope
   alphabetical, then first palette in global scope alphabetical.
4. Update the stored memory whenever the user explicitly switches palette.

**Rationale** — Direct implementation of FR-023a. Fallback order in step 3
matches the "project palettes first, then global, alphabetical within each
scope" wording in the requirement.

**Alternatives considered** — Remembering the last N palettes and offering a
recents list. Deferred: not requested for v1 and adds UI surface.

---

## 7. Delete key semantics (FR-012)

**Decision** — The `Delete` key is registered as the keybinding for a new
command `palette.deleteActiveSwatch`. The command handler checks the active
palette for a swatch whose RGB equals the current primary color
(`toolStore.activeColor`); if found, it removes it and emits `state-changed`.
If no match, the handler is a no-op (explicit early-return, no error).

**Rationale** — The clarifications rule out a separate selected-swatch state.
Tying Delete to "the swatch matching the primary" gives a deterministic,
documentable mapping. Using the existing keybinding registry (see
`src/commands/keybindingRegistry.ts`) keeps the shortcut discoverable and
overridable.

**Alternatives considered** — Scope the binding to only fire when the
palette panel is focused. Considered and deferred: the existing keybinding
system is global, and a "scoped-when-focused" facility would require
invasive changes. If future conflicts arise (e.g., Delete on a selection),
we will reintroduce focus scoping. For v1, Delete consistently targets the
primary-bound swatch.

---

## 8. Pipette mode: state & integration with the canvas

**Decision** — Add `paletteStore.pipetteActive: boolean`. When `true`:

- The canvas input pipeline (see `CanvasViewport.tsx`) consults the flag
  *before* forwarding the press to the current tool. If active, the press
  reads the composite pixel at the clicked coordinate and calls
  `addColorToActivePalette`. No draw call is issued.
- A visible pill-shaped "Pipette active" indicator is shown in the panel
  header; the pipette button toggles to its "active" styling.
- Exits: (a) `Escape` (global keybinding `palette.exitPipette` only active
  when pipette is on), (b) clicking the panel's pipette button again, (c)
  switching to any tool via `toolStore.setActiveToolType`.

**Rationale** — Treating palette-pipette as a *mode flag*, not a `Tool`
implementation, is deliberately simple (Principle VI). It preserves the
active drawing tool so the user returns to their brush after exiting pipette
without extra bookkeeping. The sample is a canvas composite (matching FR-010
wording "clicks a canvas pixel") — not the active layer only, to avoid
surprises on transparent pixels.

**Alternatives considered**

- A real `PalettePipetteTool` registered in `toolStore`. Rejected: would
  clobber the user's active tool selection and duplicate the color-picker
  logic already in `domain/tools/color_picker.rs`.
- Sample active layer. Rejected: spec says "clicks a canvas pixel", i.e. the
  visible composite.

---

## 9. Import conflict resolution (FR-020a)

**Decision** — Implemented in two pieces:

1. **Rust**: `PaletteService::import_palette(source_path, scope, strategy)`
   where `strategy ∈ { Cancel, Rename(String), Overwrite }`. The command is
   invoked twice in the worst case: first without a strategy → returns an
   `Err(AppError::Validation("palette-name-collision:<existing-id>:<suggested-name>"))`
   which the frontend decodes; second with the user's chosen strategy.
2. **Frontend**: `ImportConflictDialog.tsx` catches the validation error,
   renders the three-action dialog (default: *Rename*, editable suggestion),
   and re-issues the command with the selected strategy.

The suggested name is `"<name> (2)"`, incrementing until unique (up to 999).

**Rationale** — Avoids a dialog-on-backend pattern (which would couple
use_cases to UI). The error-then-retry handshake is explicit and testable.

**Alternatives considered** — Always auto-rename. Rejected: clarifications
require user consent (*Cancel* must be possible).

---

## 10. Project-scope availability (FR-022)

**Decision** — `AppState` gains `current_project_path: Option<PathBuf>`,
initialized to `None`. All project-scope palette commands early-return
`Err(AppError::Validation("no-project-open"))` when it is `None`. The
frontend maps this error to a disabled state with tooltip.

A follow-up (unrelated to this feature) will wire actual project-open/close
flows to this field.

**Rationale** — Keeps the contract complete per spec while honoring Principle
VI: we do not invent a project-management subsystem here. The stub is a
single `Option<PathBuf>` field; the next feature to introduce projects will
populate it without surgery.

**Alternatives considered** — Defer the entire project-scope implementation
until projects exist. Rejected: would leave FR-004/FR-017/FR-023a half-done
and regress when projects land.

---

## 11. Testing strategy

**Decision**

- **Domain tests** (`domain/palette.rs`): construction validation
  (empty/whitespace/too-long names), `add_color` deduplication, `rename`,
  ordering, scope immutability.
- **Use-case tests** (`use_cases/palette_service.rs`): an in-memory
  `PaletteStore` double covers CRUD, active-palette restore/fallback logic,
  import-collision error paths, export round-trip.
- **Infrastructure tests** (`infrastructure/palette_file.rs`,
  `palette_store_fs.rs`, `palette_state_io.rs`): temp-dir based, assert
  round-trip, malformed handling, and filename transform edge cases using
  the three fixtures (`palette_valid.texpal`, `palette_malformed.texpal`,
  `palette_wrong_version.texpal`).
- **Frontend store tests** (`paletteStore.test.ts`): mock `invoke()`, cover
  active switch, pipette toggle transitions, conflict-error decoding.
- **Frontend component tests**: dropdown renders scope indicators; swatch
  grid left/right click fires correct store action; conflict dialog returns
  the chosen strategy.

**Rationale** — Direct implementation of Principle IV; mirrors the existing
test layout for layers (see `src-tauri/src/domain/layer.rs` and
`src/components/layers/LayersPanel.test.tsx`).

---

## 12. Dependencies added

**None.** All required crates (`serde`, `serde_json` via `serde`, `uuid`,
`thiserror`) and npm packages (`@tauri-apps/plugin-dialog`, `lucide-react`,
`zustand`) already exist in the project. `serde_json` is available
transitively through `tauri`; we will add it explicitly to `Cargo.toml` for
clarity when implementation starts.

**Rationale** — Principle VI: no new dependencies mean no new maintenance
surface.

---

## 13. Open items (none)

All spec clarifications were resolved in the 2026-04-22 session and the
decisions above. No `NEEDS CLARIFICATION` markers remain.
