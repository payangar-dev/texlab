# Research: Project Scaffolding

**Feature**: 001-project-scaffolding | **Date**: 2026-03-28

## R-001: Tauri v2 Project Initialization Strategy

**Decision**: Manual setup (add Tauri to existing Vite+React project) rather than `create-tauri-app`.

**Rationale**: The repository already exists with `.specify/`, `CLAUDE.md`, and other configuration. Running `create-tauri-app` assumes an empty directory and generates files that would conflict. Manual setup gives full control over the directory structure, which is critical for enforcing the clean architecture layers.

**Alternatives considered**:
- `create-tauri-app` — generates a standard Tauri+React project. Rejected because it doesn't support custom backend directory structures and would require significant restructuring after generation.
- Forking a Tauri template — rejected as unnecessary indirection for a well-documented manual process.

## R-002: Tauri v2 lib.rs / main.rs Split

**Decision**: All application logic lives in `lib.rs` (exposed as `app_lib` crate). `main.rs` is a thin 3-line desktop entry point.

**Rationale**: Tauri v2 compiles the app as a library for mobile targets (iOS/Android). The `#[cfg_attr(mobile, tauri::mobile_entry_point)]` attribute on the `run()` function in `lib.rs` enables this. Desktop uses `main.rs` which simply calls `app_lib::run()`. This is the Tauri v2 convention and enables future mobile support without restructuring.

**Alternatives considered**:
- Everything in `main.rs` (Tauri v1 style) — rejected, breaks mobile compatibility and violates Tauri v2 conventions.

## R-003: Cargo.toml crate-type Configuration

**Decision**: `crate-type = ["staticlib", "cdylib", "rlib"]` in `[lib]` section.

**Rationale**:
- `rlib` — required for the desktop binary to link against the library and for `cargo test`.
- `staticlib` — required for iOS builds.
- `cdylib` — required for Android builds.
All three are included from the start to maintain cross-platform compatibility per the assumptions.

**Alternatives considered**:
- `rlib` only — would work for desktop but block future mobile builds. Rejected to avoid future rework.

## R-004: Frontend Testing Framework

**Decision**: vitest + jsdom + @testing-library/react.

**Rationale**: Vitest is the Vite-native test runner — shares the same config and transform pipeline, zero additional bundler configuration. jsdom chosen over happy-dom for broader API coverage (important for future canvas/pixel testing). @testing-library/react is the standard React testing library.

**Alternatives considered**:
- Jest — requires separate babel/transform config that duplicates Vite's pipeline. Rejected for complexity.
- happy-dom — faster but less mature API surface. Rejected for canvas/pixel editor reliability concerns.

## R-005: Vite Configuration for Tauri

**Decision**: Use Tauri-specific Vite settings: `clearScreen: false`, `strictPort: true`, `server.watch.ignored: ["**/src-tauri/**"]`, Tauri environment-based build targets.

**Rationale**: These are documented Tauri v2 best practices. `clearScreen: false` lets Tauri CLI manage terminal output. `strictPort: true` ensures the dev server port matches `tauri.conf.json`'s `devUrl`. Ignoring `src-tauri/` in watch prevents Rust recompilation from triggering HMR.

**Alternatives considered**: None — these are non-optional for correct Tauri+Vite integration.

## R-006: Default Window Dimensions

**Decision**: 1280x800 default, minimum 1024x768 (enforced via Tauri window config).

**Rationale**: 1280x800 is the most common laptop resolution baseline and provides comfortable space for a design tool with side panels. The spec requires minimum 1024x768. Tauri v2 supports `minWidth`/`minHeight` constraints in `tauri.conf.json`.

**Alternatives considered**:
- 1920x1080 default — too large for smaller screens, would open off-screen.
- 1024x768 default — functional but cramped for a design tool.

## R-007: Placeholder Strategy for Empty Modules

**Decision**: Each Rust layer directory gets a `mod.rs` with a comment indicating the layer's purpose. Frontend directories get `.gitkeep` files.

**Rationale**: SC-003 requires 100% of the defined directory structure to exist and be non-empty. `mod.rs` files are idiomatic Rust for module declaration. `.gitkeep` is the standard Git convention for tracking empty directories.

**Alternatives considered**:
- Index files with exports (e.g., `index.ts`) in frontend dirs — premature; no exports to declare yet. `.gitkeep` is simpler and clearly communicates "placeholder".
