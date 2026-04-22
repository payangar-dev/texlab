# Contract — Tauri Commands (Palette Panel)

All commands below are registered in `tauri::generate_handler![]` and live in
`src-tauri/src/commands/palette_commands.rs`. They return
`Result<T, AppError>` where `AppError` serializes to a plain string (same
convention as existing commands — see `src-tauri/src/error.rs`).

Every command that mutates state emits the `state-changed` Tauri event after
a successful return so the frontend refetches via `paletteStore`.

---

## Types (DTOs)

See [data-model.md §IPC DTOs](../data-model.md#ipc-dtos) for the full Rust
shape. The TypeScript equivalents (in `src/api/commands.ts`) follow
camelCase because all Rust DTOs use `#[serde(rename_all = "camelCase")]`.

```ts
export type PaletteScopeDto = "global" | "project";

export interface PaletteDto {
  id: string;               // 32-char hex
  name: string;
  scope: PaletteScopeDto;
  colors: string[];         // "#RRGGBB"
}

export interface PaletteListDto {
  palettes: PaletteDto[];
  activePaletteId: string | null;
  canCreateProjectPalette: boolean;
}

export interface AddColorResultDto {
  added: boolean;           // false if FR-011 dedupe happened
  index: number;
  palette: PaletteDto;
}

export type ImportStrategyDto =
  | { action: "cancel" }
  | { action: "rename"; newName: string }
  | { action: "overwrite" };
```

---

## Command signatures

### `get_palettes`

```rust
#[tauri::command]
fn get_palettes(state: State<Mutex<AppState>>) -> Result<PaletteListDto, AppError>;
```

- Returns all palettes from both scopes in a single list. `canCreateProjectPalette` reflects `current_project_path.is_some()` (FR-022).
- Stable ordering: project palettes first (alphabetical by name), then global (alphabetical). Ties broken by `PaletteId` string order.
- Never mutates state. Does not emit `state-changed`.

### `create_palette`

```rust
#[tauri::command]
fn create_palette(
    app: AppHandle,
    state: State<Mutex<AppState>>,
    name: String,
    scope: String, // "global" | "project"
) -> Result<PaletteListDto, AppError>;
```

- Validates `name` via `PaletteName::new`. Errors → `AppError::Validation("invalid-palette-name:<reason>")`.
- Rejects duplicates per scope (FR-005) → `AppError::Validation("duplicate-palette-name")`.
- Sets the new palette as the active palette for the current context (matches US2 acceptance scenario 1).
- Emits `state-changed`. Returns the refreshed `PaletteListDto`.

### `rename_palette`

```rust
#[tauri::command]
fn rename_palette(
    app: AppHandle,
    state: State<Mutex<AppState>>,
    palette_id: String,
    new_name: String,
) -> Result<PaletteListDto, AppError>;
```

- Same validation as `create_palette` against the existing palette's scope.
- Unknown id → `AppError::Validation("palette-not-found")`.
- Emits `state-changed`.

### `delete_palette`

```rust
#[tauri::command]
fn delete_palette(
    app: AppHandle,
    state: State<Mutex<AppState>>,
    palette_id: String,
) -> Result<PaletteListDto, AppError>;
```

- Confirmation happens on the frontend; the command is destructive-on-call.
- If the deleted palette was active, the service immediately recomputes the
  active palette via the FR-023a fallback chain.
- Unknown id → `AppError::Validation("palette-not-found")`.
- Emits `state-changed`.

### `set_active_palette`

```rust
#[tauri::command]
fn set_active_palette(
    app: AppHandle,
    state: State<Mutex<AppState>>,
    palette_id: Option<String>,
) -> Result<PaletteListDto, AppError>;
```

- `palette_id: None` clears the active palette (used for empty-state flow).
- Updates `palette-state.json` (per-context memory, see FR-023a).
- Emits `state-changed`.

### `add_color_to_active_palette`

```rust
#[tauri::command]
fn add_color_to_active_palette(
    app: AppHandle,
    state: State<Mutex<AppState>>,
    color_hex: String, // "#RRGGBB" (accept uppercase or lowercase)
) -> Result<AddColorResultDto, AppError>;
```

- Parses the hex via a shared helper; rejects 3-digit / alpha / bad chars → `AppError::Validation("invalid-color-hex")`.
- When no active palette → `AppError::Validation("no-active-palette")`.
- Honors FR-011: if the color already exists, `added: false` and `index` is the existing position.
- Emits `state-changed` regardless (frontend uses `added` to pulse vs. animate-append).

### `remove_color_from_active_palette_at`

```rust
#[tauri::command]
fn remove_color_from_active_palette_at(
    app: AppHandle,
    state: State<Mutex<AppState>>,
    index: usize,
) -> Result<PaletteListDto, AppError>;
```

- Out-of-range `index` → `AppError::Validation("palette-index-out-of-range")`.
- Used by both the Delete-key flow (frontend resolves the index first) and any future right-click-remove UI.
- Emits `state-changed`.

### `export_palette`

```rust
#[tauri::command]
fn export_palette(
    app: AppHandle,
    state: State<Mutex<AppState>>,
    palette_id: String,
    destination_path: String, // full path including ".texpal"
) -> Result<(), AppError>;
```

- Overwrites the destination if it exists (user already confirmed via the native Save dialog).
- Writes UTF-8 JSON as defined in [`texpal-schema.json`](./texpal-schema.json).
- Unknown id → `AppError::Validation("palette-not-found")`.
- Does **not** emit `state-changed` (pure export, in-memory state unchanged).

### `import_palette`

```rust
#[tauri::command]
fn import_palette(
    app: AppHandle,
    state: State<Mutex<AppState>>,
    source_path: String,
    scope: String, // "global" | "project"
    strategy: Option<ImportStrategyDto>,
) -> Result<PaletteListDto, AppError>;
```

- Reads and validates the file via the `.texpal` codec.
- Malformed / wrong-version / invalid color → `AppError::Validation("invalid-palette-file:<reason>")` (FR-021).
- When the imported name collides with an existing palette in the destination scope and `strategy` is `None`:
  → returns `AppError::Validation("palette-name-collision:<existing-id>:<suggested-name>")`.
  The frontend decodes this, shows `ImportConflictDialog`, and re-invokes with the chosen strategy.
- Strategy behavior (FR-020a):
  - `cancel` → returns `Ok(PaletteListDto)` unchanged, no side effect.
  - `rename` with `newName` → import with the provided name after re-validating uniqueness; if `newName` also collides, returns the collision error again with the next suggestion.
  - `overwrite` → replace the existing palette's contents in-place (keep its `PaletteId` and filename so the file survives), regenerate swatches from the imported file.
- Emits `state-changed` on non-cancel success.

---

## Error catalogue

All errors are `AppError::Validation(String)` unless stated. The payload
string uses a stable `<kind>[:<argument>...]` format so the frontend can
pattern-match without regex gymnastics.

| Code | Meaning | Frontend behavior |
|------|---------|--------------------|
| `invalid-palette-name:<reason>` | `PaletteName::new` rejected the name | Inline form error; do not close dialog |
| `duplicate-palette-name` | Name already exists in destination scope | Inline form error |
| `palette-not-found` | Unknown `palette_id` | Toast + refetch |
| `no-active-palette` | `add_color_to_active_palette` with nothing active | Silent no-op (defensive; UI disables the action) |
| `no-project-open` | Project-scope operation with no project | Disabled UI + tooltip (FR-022) |
| `palette-index-out-of-range` | Bad index in remove | Refetch |
| `invalid-color-hex` | `#RRGGBB` parse failed | Toast (shouldn't fire in normal use) |
| `invalid-palette-file:<reason>` | `.texpal` parse failed | Toast + log (FR-021, SC-007) |
| `palette-name-collision:<id>:<suggested-name>` | Import collision awaiting strategy | Open `ImportConflictDialog` |
| `io-error:<reason>` | Filesystem call failed | Toast with the reason; state unchanged |

Generic `AppError::Internal(…)` is reserved for conditions the service
considers bugs (e.g., lock poisoned). The frontend treats it as a toast +
console log.

---

## Registration

In `src-tauri/src/lib.rs`, append to `tauri::generate_handler![]`:

```
commands::get_palettes,
commands::create_palette,
commands::rename_palette,
commands::delete_palette,
commands::set_active_palette,
commands::add_color_to_active_palette,
commands::remove_color_from_active_palette_at,
commands::export_palette,
commands::import_palette,
```

No new capability is required — `dialog:default` and `core:path:default`
are already granted in `src-tauri/capabilities/default.json`.

---

## Frontend API shape (`src/api/commands.ts`)

```ts
export function getPalettes(): Promise<PaletteListDto>;
export function createPalette(name: string, scope: PaletteScopeDto): Promise<PaletteListDto>;
export function renamePalette(paletteId: string, newName: string): Promise<PaletteListDto>;
export function deletePalette(paletteId: string): Promise<PaletteListDto>;
export function setActivePalette(paletteId: string | null): Promise<PaletteListDto>;
export function addColorToActivePalette(colorHex: string): Promise<AddColorResultDto>;
export function removeColorFromActivePaletteAt(index: number): Promise<PaletteListDto>;
export function exportPalette(paletteId: string, destinationPath: string): Promise<void>;
export function importPalette(
  sourcePath: string,
  scope: PaletteScopeDto,
  strategy?: ImportStrategyDto,
): Promise<PaletteListDto>;
```

Each wrapper uses `invoke()` with the Rust argument names in camelCase (e.g.
`invoke("create_palette", { name, scope })`) to match the existing pattern
in `commands.ts`.
