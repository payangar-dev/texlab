# Contributing to TexLab

Pixel art texture editor for Minecraft resource packs, built with Tauri v2.

## Prerequisites

- **Rust** >= 1.77 (`rustup update stable`)
- **Node.js** >= 20 LTS
- **npm** (bundled with Node.js)
- **Visual Studio C++ Build Tools** (Windows) / Xcode CLI (macOS) / `build-essential` (Linux)

## Quick Start

```bash
npm install
npm run tauri dev
```

## Architecture

TexLab follows **Clean Architecture** with strict inward-pointing dependencies. The backend is split into 5 layers, each with a clear responsibility.

### Backend (`src-tauri/src/`)

```
src-tauri/src/
├── domain/           # Pure business logic (entities, value objects, domain rules)
├── use_cases/        # Application orchestration (imports only from domain/)
├── infrastructure/   # I/O adapters (PNG, ZIP, JSON, external services)
├── commands/         # Tauri IPC command wrappers (thin, delegates to use_cases)
├── mcp/              # Embedded MCP server for AI agent integration
├── error.rs          # Unified AppError type (serde::Serialize for IPC)
├── state.rs          # Mutex<AppState> — single source of truth
├── lib.rs            # Tauri builder and module registration
└── main.rs           # Desktop entry point (thin, calls lib)
```

**Dependency rules**:

- `domain/` MUST NOT import from any external crate (no tauri, serde, image)
- `use_cases/` MUST only import from `domain/`
- `infrastructure/` implements adapters using external crates, depends on `domain/`
- `commands/` are thin wrappers — delegate to `use_cases/`, handle serialization
- `mcp/` accesses `Mutex<AppState>` directly for AI agent operations

### Frontend (`src/`)

```
src/
├── api/              # Typed invoke() wrappers for Tauri IPC
├── components/       # UI components organized by feature
├── hooks/            # React hooks
├── store/            # Zustand stores (cache of Rust state, NOT independent source)
├── App.tsx           # Root component
└── main.tsx          # React entry point
```

Zustand stores mirror Rust state — they are a cache for the frontend, not an independent source of truth.

## Naming Conventions

### Rust

- **Files/modules**: `snake_case` (`texture_editor.rs`)
- **Types/enums**: `PascalCase` (`AppState`, `AppError`)
- **Functions**: `snake_case` (`get_texture`)
- **Constants**: `SCREAMING_SNAKE_CASE` (`MAX_LAYERS`)
- **Domain types**: No `Serialize`/`Deserialize` derives — use separate DTOs in `commands/`

### TypeScript

- **Files**: `PascalCase` for components (`CanvasPanel.tsx`), `camelCase` for utilities (`useEditor.ts`)
- **Types/interfaces**: `PascalCase` (`EditorState`, `TextureData`)
- **Functions/variables**: `camelCase` (`getTexture`, `editorState`)
- **Constants**: `SCREAMING_SNAKE_CASE` or `camelCase` depending on scope

## Adding a New Feature

1. **Specify**: Run `/speckit.specify` from the GitHub issue
2. **Plan**: Run `/speckit.plan` to generate the technical design
3. **Tasks**: Run `/speckit.tasks` to generate the implementation tasks
4. **Implement**: Follow the task list, respecting dependency order
5. **Verify**: Run `/speckit.verify` to validate against the spec

### Adding a Tauri Command

1. Define domain types in `domain/`
2. Write use case logic in `use_cases/`
3. Create a `#[tauri::command]` wrapper in `commands/`
4. Register the command in `generate_handler![]` in `lib.rs`
5. Add the corresponding capability permission if needed

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code restructuring without behavior change
- `docs:` — documentation only
- `test:` — adding or updating tests
- `chore:` — tooling, CI, dependencies

Reference issue numbers in commits (e.g., `feat: add layer panel (#12)`).

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run tauri dev` | Start app in dev mode (Vite HMR + Rust rebuild) |
| `npm run tauri build` | Build production binaries |
| `npm run dev` | Frontend dev server only |
| `npm run build` | Frontend production build |
| `cargo build` | Rust backend only (from `src-tauri/`) |
| `cargo test` | Rust unit tests (from `src-tauri/`) |
