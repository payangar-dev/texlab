# Phase 1 — Data Model: Palette Panel

All types below are defined in `src-tauri/src/domain/`. None of them derive
`Serialize`/`Deserialize`; IPC transport uses dedicated DTOs declared in
`commands/dto.rs`, and file persistence uses codec types declared in
`infrastructure/palette_file.rs`.

---

## Domain entities

### `PaletteName` (value object)

**Module**: `domain/palette.rs`

```rust
pub struct PaletteName(String); // private field
```

| Invariant | Source |
|-----------|--------|
| Trimmed length ∈ [1, 64] Unicode scalar values | FR-006, Assumptions §Name length |
| NFC-normalized at construction | Research §4 |
| Neither empty nor whitespace-only | FR-006 |

**Constructor**: `PaletteName::new(raw: &str) -> Result<Self, DomainError>`.
Returns `DomainError::InvalidInput { reason }` on any violation.

**Equality**: `PartialEq`, `Eq`, `Hash` on the normalized string (used for
in-memory dedupe in `PaletteStore` implementations).

---

### `Color` (value object — reused)

**Module**: `domain/color.rs` (unchanged)

Palette swatches reuse `domain::Color`. The palette layer always constructs
colors with `a = 255` (opaque) and asserts this invariant when the color
originates from the canvas composite (Research §3).

---

### `PaletteId` (value object)

**Module**: `domain/palette.rs`

```rust
pub struct PaletteId(u128); // UUIDv4 packed as u128
```

- Opaque, collision-resistant identifier persisted inside each `.texpal` file.
- Used as the key for active-palette memory (`palette-state.json`).
- Survives rename — the user-visible name can change freely; the id is stable.
- Formatting for IPC: zero-padded 32-char hex string (same convention as
  `LayerId`, see `commands/dto.rs::parse_layer_id`).

---

### `PaletteScope` (enum)

**Module**: `domain/palette.rs`

```rust
pub enum PaletteScope {
    Global,
    Project,
}
```

- `Project` is only usable when `AppState.current_project_path` is `Some(_)`.
- Carries no data: the scope-to-directory resolution happens in
  `PaletteService`, not in the domain type.

---

### `Swatch` (value object)

**Module**: `domain/palette.rs`

```rust
pub struct Swatch { color: Color }
```

- Newtype around `Color`. Exists as a named concept to mirror the spec
  (§Key Entities) and leave room for future per-swatch metadata (name,
  tags) without churning callers.
- **Equality** on `color`. Used by `Palette::add_color` to reject silent
  duplicates (FR-011).

---

### `Palette` (entity)

**Module**: `domain/palette.rs`

```rust
pub struct Palette {
    id: PaletteId,
    name: PaletteName,
    scope: PaletteScope,
    colors: Vec<Color>, // ordered, no opaque-duplicates
}
```

| Invariant | Source |
|-----------|--------|
| `colors` preserves insertion order | FR-003 |
| `colors` contains no two equal `Color` values (opaque RGB comparison) | FR-011 |
| `scope` is fixed for the lifetime of the entity | Clarification 2026-04-22 Q7 |

**Operations**

| Method | Returns | Notes |
|--------|---------|-------|
| `Palette::new(id, name, scope)` | `Self` | Empty color list. Pure. |
| `add_color(&mut self, color: Color) -> AddColorOutcome` | `Added { index }` \| `AlreadyPresent { index }` | Never appends a duplicate (FR-011). Forces `a=255`. |
| `remove_color_at(&mut self, index: usize) -> Result<Color, DomainError>` | removed color | Used by `Delete`-key flow after caller resolves the primary match. |
| `remove_color(&mut self, color: Color) -> Result<usize, DomainError>` | removed index | Convenience for "remove the swatch equal to primary". |
| `rename(&mut self, new_name: PaletteName)` | `()` | Name uniqueness enforced by `PaletteService`, not here. |
| `colors(&self) -> &[Color]` | slice | Read-only accessor. |
| `len(&self)`, `is_empty(&self)` | as named | |

**Scope transition**: not supported (Clarification Q7 — no cross-scope
operations in v1). Export + re-import is the only transfer path.

---

### `AddColorOutcome` (enum)

**Module**: `domain/palette.rs`

```rust
pub enum AddColorOutcome {
    Added { index: usize },
    AlreadyPresent { index: usize },
}
```

Drives the "highlight existing swatch" behavior in FR-011. The use case
returns this to the command, which puts it on the DTO so the frontend can
scroll the grid and pulse the existing swatch.

---

## Port (domain trait)

### `PaletteStore`

**Module**: `domain/ports.rs`

```rust
pub trait PaletteStore {
    fn list(&self) -> Result<Vec<Palette>, DomainError>;
    fn read(&self, id: PaletteId) -> Result<Palette, DomainError>;
    fn write(&self, palette: &Palette) -> Result<(), DomainError>;
    fn delete(&self, id: PaletteId) -> Result<(), DomainError>;
}
```

- Object-safe (`Box<dyn PaletteStore + Send + Sync>` in `PaletteService`).
- Rename is *not* a method: `PaletteService` implements rename as
  `read → write → (optional delete of old file)`. Keeping the port minimal
  keeps adapter code trivial (Principle VI).
- Two instances live in `PaletteService`: one bound to the global directory,
  one constructed on demand when a project is open and bound to
  `<project>/palettes/`.

---

## Use-case state

### `PaletteService`

**Module**: `use_cases/palette_service.rs`

```rust
pub struct PaletteService {
    global: Box<dyn PaletteStore + Send + Sync>,
    project: Option<Box<dyn PaletteStore + Send + Sync>>, // set when a project opens
    active: ActiveMemory,
}

struct ActiveMemory {
    global: Option<PaletteId>,
    projects: HashMap<PathBuf, PaletteId>,
}
```

**Responsibilities**

- CRUD across scopes.
- Uniqueness enforcement (FR-005) by listing the target scope before each
  `write` that changes a name or introduces a new palette.
- Active-palette restore (FR-023a) using `ActiveMemory`.
- Export (copy + re-serialize) and import (parse + conflict handshake).

**Why it lives in `use_cases/`**

It orchestrates multiple ports, enforces cross-cutting invariants that are
*not* per-palette (uniqueness, active state), and is the integration point
where Tauri commands and MCP tool handlers meet (Principle III).

---

## Persistence — `.texpal` file

**Module**: `infrastructure/palette_file.rs`

```rust
#[derive(serde::Serialize, serde::Deserialize)]
struct TexpalFile {
    version: u32,       // must be 1
    id: String,         // PaletteId hex
    name: String,
    colors: Vec<String>, // "#RRGGBB"
}
```

- Lives in infrastructure — never touched by `domain/` or `use_cases/`.
- Encoder writes with `serde_json::to_string_pretty` so files remain
  hand-inspectable.
- Decoder rejects: missing fields, `version != 1`, invalid hex, duplicate
  colors (dedupe + warn log, not fail), overlong names.

---

## Persistence — `palette-state.json`

**Module**: `infrastructure/palette_state_io.rs`

```jsonc
{
  "version": 1,
  "global": "2f0c…b9",
  "projects": {
    "C:/path/to/project": "7aa1…03"
  }
}
```

- Written atomically (write to `.tmp` then rename).
- Missing file is treated as empty memory; a corrupt file is reported via a
  warning and discarded (feature still works, user just loses
  last-active-palette restore).

---

## IPC DTOs

**Module**: `commands/dto.rs` (appended)

```rust
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaletteDto {
    pub id: String,            // PaletteId hex
    pub name: String,
    pub scope: String,         // "global" | "project"
    pub colors: Vec<String>,   // "#RRGGBB"
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaletteListDto {
    pub palettes: Vec<PaletteDto>,
    pub active_palette_id: Option<String>,
    pub can_create_project_palette: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddColorResultDto {
    pub added: bool,           // false when FR-011 "already present"
    pub index: usize,
    pub palette: PaletteDto,   // post-mutation snapshot
}
```

- Scope is transported as a lowercase string to match the `BlendMode`
  precedent in `dto.rs`.
- Colors are transported as hex strings (not `ColorDto`) to match the
  file format — frontend parses them once when rendering swatches.

---

## State diagram — Active palette

```
                  (app start / project open)
                            │
                 read palette-state.json
                            │
               ┌────────────┴────────────┐
               │                         │
      project in context?              no project
               │                         │
         ┌─────┴─────┐              pick global memory
         │           │                   │
      memory?     yes/no             exists?
         │           │                   │
    pick it      fallback 1: first   yes → use    no → fallback: first
                 project alphabetical       global alphabetical
                 → fallback 2: first
                 global alphabetical
                 → none → empty state
```

On every `PaletteService::set_active(id)`:

- If no project open: update `ActiveMemory.global`.
- If project open: update `ActiveMemory.projects[<project_path>]`.
- Flush `palette-state.json`.

---

## Relationships

- `Palette` 1 ↔ N `Swatch` (via `colors: Vec<Color>` — Swatch is a logical
  framing; we do not instantiate it per color).
- `PaletteScope` partitions the palette set; uniqueness is per-scope
  (FR-005).
- `PaletteService` owns all palette state — AppState holds it directly,
  there is no parallel in-memory cache.
- `paletteStore` (frontend) mirrors `PaletteListDto` and never writes
  anything the backend did not return (Principle III).
