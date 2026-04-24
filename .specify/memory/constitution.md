<!--
  Sync Impact Report
  Version change: 1.0.0 → 1.1.0
  Added principles: VIII. Theme-First, Mockups Second
  Modified sections: none (purely additive)
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ compatible (no changes needed)
    - .specify/templates/spec-template.md ✅ compatible (no changes needed)
    - .specify/templates/tasks-template.md ✅ compatible (no changes needed)
  Follow-up TODOs: WCAG AA contrast tuning tracked as a separate follow-up
  (aspirational in principle VIII; not gated by this amendment).
-->

# TexLab Constitution

## Core Principles

### I. Clean Architecture (NON-NEGOTIABLE)

The codebase follows strict layered architecture with inward-pointing
dependencies. Every layer boundary is crossed via an abstract interface (trait).

- **Domain** (`src-tauri/src/domain/`): pure business logic. MUST NOT import
  from any other layer, framework, or external crate. Only standard library.
- **Use Cases** (`src-tauri/src/use_cases/`): orchestration logic. MUST only
  import from `domain/`.
- **Infrastructure** (`src-tauri/src/infrastructure/`): I/O adapters (PNG,
  ZIP, JSON parsers, MCP server). Implements traits defined in `domain/`.
- **Commands** (`src-tauri/src/commands/`): thin Tauri command wrappers. Lock
  state, delegate to use cases, return DTOs. No business logic here.
- **Frontend** (`src/`): React UI. Communicates with Rust exclusively via
  Tauri IPC (`invoke`, events, channels).

Import violations MUST be caught during code review. If a `use` statement in
`domain/` or `use_cases/` references `tauri`, `serde`, `image`, or any
infrastructure crate, the code MUST be refactored.

### II. Domain Purity

Domain types (`PixelBuffer`, `Layer`, `LayerStack`, `Color`, `BlendMode`,
`Tool`) MUST have zero external dependencies.

- Value objects (`Color`, `Dimensions`) MUST validate invariants at
  construction. An invalid value MUST NOT be representable.
- Serialization derives (`Serialize`, `Deserialize`) MUST NOT appear on
  domain types. Separate DTO types in `commands/` handle IPC serialization.
- Traits (ports) for I/O operations (`ImageReader`, `ImageWriter`,
  `PackScanner`) are defined in `domain/` and implemented in
  `infrastructure/`.

### III. Dual-Access State

Application state MUST be accessible from both the Tauri frontend (via IPC
commands) and the MCP server (via direct Rust calls). A single
`Mutex<AppState>` in the Rust backend is the source of truth.

- Tauri commands and MCP tool handlers MUST reuse the same `EditorService`
  and domain logic. No duplicated code paths.
- When the MCP server mutates state, it MUST emit a Tauri event
  (`state-changed`) so the frontend can re-fetch and re-render.
- The frontend MUST NOT maintain its own state for data that exists in Rust.
  Zustand stores are caches of Rust state, not independent sources.

### IV. Test-First for Domain

All domain and use case logic MUST be covered by unit tests using in-memory
adapters — no real file system, no database, no network.

- Infrastructure adapters MUST implement domain traits, enabling injection
  of in-memory test doubles.
- Integration tests for `use_cases/` MUST use in-memory adapters, never
  real I/O.
- Infrastructure tests (PNG round-trip, JSON parsing) MUST use test fixtures
  stored in `src-tauri/tests/fixtures/`.
- Frontend testing: Zustand store tests MUST mock `invoke()`.

### V. Progressive Processing

The application MUST NOT bulk-convert source assets. Conversion to `.texlab`
format happens lazily on first edit.

- Opening a texture from a source reads the original PNG directly.
  No `.texlab` file is created until the user modifies the texture.
- When created, the `.texlab` file is self-contained (ZIP archive with
  layer PNGs + metadata JSON). It MUST include a copy of the original
  source pixels so the project remains functional even if the source is
  removed.
- Source files are duplicated into `<project>/sources/` at import time,
  making the project self-contained.

### VI. Simplicity

The right amount of complexity is the minimum needed for the current
requirement. No speculative abstractions.

- Undo/redo uses full-layer snapshots, not diff-based. For 16×16 textures
  (1KB per snapshot), this is the simplest correct approach.
- Canvas rendering uses HTML5 Canvas 2D with `imageSmoothingEnabled = false`.
  WebGL is not justified for pixel art at these dimensions.
- Synchronous tool application is sufficient for pixel art. Async stroke
  pipelines (like Krita) are over-engineering for this use case.
- No premature abstractions: three similar lines of code are better than
  a premature helper function.

### VII. Component-Based UI

The frontend UI is built from independent, dockable panels that users can
freely arrange.

- Each panel (Layers, Color, Palette, Model Preview, Sources) is a
  self-contained React component with its own state subscription.
- Panel headers contain only the grip icon and title. Actions and controls
  belong in the panel body. The docking framework manages minimize, close,
  and detach.
- Layout persistence: the panel arrangement is saved to
  `<app_data_dir>/workspace.json` (via Tauri path API) and restored on
  app launch.

### VIII. Theme-First, Mockups Second

Visual literals — colours, font sizes, font weights, spacing, sizing, icon
sizes, radii, shadows — live in exactly one place: `src/styles/theme.ts`.
Mockups drive structure, composition, and hierarchy; they are not
authoritative for raw pixel values.

- `src/styles/theme.ts` is the sole source of truth for visual tokens.
  Every other file under `src/**` (TS, TSX, CSS via CSS custom properties
  written by `src/styles/applyThemeToRoot.ts`) MUST read tokens from there.
- **If a needed token is missing, extend the theme first, then consume it.**
  Hardcoding a value in a component is not allowed. Extending is additive:
  new tokens may be added to an existing scale; renames are breaking and
  MUST NOT land in the same PR as feature work.
- **Structural exceptions** (not considered design tokens): the literal
  values `0`, `1px` (hairline borders adjacent to `border*` / `outline*`
  properties), `100%`, `auto`, and the CSS keywords `"transparent"` and
  `"currentColor"`.
- **User-generated colour exemption**: hex strings originating from the
  user (picked pixels, saved swatches, imported palette entries) are data,
  not design choices. They travel through `src/utils/color.ts` /
  `src/utils/colorHex.ts` and are exempt from the rule.
- **Legibility floor**: the smallest entry of `fontSizes` is the shipped
  floor for text; the smallest entry of `iconSizes` is the shipped floor
  for clickable icons. Nothing ships below the floor — if a mockup shows
  a smaller value, ship the floor.
- **WCAG AA** is the project's aspirational contrast target for text. It is
  recorded here for future tuning but is not gated by this principle.
- Enforcement: a Biome GritQL plugin
  (`biome-plugins/no-style-literals.grit`, registered from `biome.json`)
  flags hex literals and magic pixel numbers in style contexts outside
  the exempt paths. `npm run check` fails on any violation.

## Technology Stack

### Rust Backend

| Crate | Version | Purpose |
|-------|---------|---------|
| `tauri` | ^2.10 | Desktop framework (v2) |
| `serde` + `serde_json` | ^1.0 | Serialization (DTOs only, not domain) |
| `image` | ^0.25 | PNG read/write (infrastructure adapter) |
| `uuid` | ^1.23 | Layer/texture identifiers |
| `thiserror` | ^2.0 | Error type derivation |
| `tokio` | ^1.50 | Async runtime (for MCP server) |
| `zip` | ^8.4 | .texlab file format (ZIP archives) |
| `rmcp` | ^1.3 | MCP server SDK (Streamable HTTP) |
| `tauri-build` | ^2.0 | Build scripts |

### Frontend

| Package | Version | Purpose |
|---------|---------|---------|
| `react` + `react-dom` | ^19.2 | UI framework |
| `@tauri-apps/api` | ^2.10 | Tauri IPC (invoke, events, channels) |
| `@tauri-apps/plugin-dialog` | ^2.6 | Native file dialogs |
| `zustand` | ^5.0 | Lightweight state cache (mirrors Rust state) |
| `dockview` | ^5.2 | Dockable panel system (zero deps, React support) |
| `three` | ^0.183 | 3D rendering (model preview, Tier 2) |
| `@react-three/fiber` | ^9.5 | React renderer for Three.js (Tier 2) |
| `@react-three/drei` | ^10.7 | Three.js helpers (Tier 2) |
| `vite` | ^6.0 | Build tooling |
| `typescript` | ^5.7 | Type safety |

### Tauri v2 Rules

- All commands MUST be registered in `tauri::generate_handler![]`.
- All commands MUST return `Result<T, AppError>` where `AppError` implements
  `Serialize`.
- Async commands MUST use owned types (`String`, not `&str`).
- Shared code MUST live in `lib.rs` (mobile compatibility).
- Capabilities MUST be explicitly declared in
  `src-tauri/capabilities/default.json`.

## Development Workflow

### Code Organization

```
src-tauri/src/
  main.rs              # Desktop entry point
  lib.rs               # Tauri builder, command registration
  error.rs             # AppError
  state.rs             # Mutex<AppState>
  domain/              # Pure logic, zero deps
  use_cases/           # Orchestration, imports only domain/
  infrastructure/      # I/O adapters
  commands/            # Tauri #[tauri::command] wrappers
  mcp/                 # MCP server (rmcp)

src/
  main.tsx / App.tsx
  api/                 # Typed invoke() wrappers
  hooks/               # React hooks
  components/          # UI components by feature
  store/               # Zustand stores (Rust state cache)
```

### Commit Conventions

- Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`.
- One logical change per commit.
- Reference GitHub issue numbers in commit messages.

### Code Review Gates

- No `use` statements in `domain/` or `use_cases/` referencing external
  crates or Tauri.
- No `Serialize`/`Deserialize` on domain types.
- No business logic in `commands/` — they delegate to `use_cases/`.
- No hardcoded file paths — use Tauri path APIs.
- All domain functions covered by unit tests.

## Governance

This constitution is the highest-authority document for architectural and
development decisions in TexLab. All code contributions MUST comply with
these principles.

- **Amendments** require documenting the change, rationale, and migration
  plan if it affects existing code.
- **Version**: follows semantic versioning (MAJOR: principle removal/redefinition,
  MINOR: new principle/section, PATCH: clarifications).
- **Compliance**: every PR MUST be reviewed against the Code Review Gates above.
- **Exceptions**: any deviation from a principle MUST be documented in the
  PR description with explicit justification and approval.

**Version**: 1.1.0 | **Ratified**: 2026-03-28 | **Last Amended**: 2026-04-23
