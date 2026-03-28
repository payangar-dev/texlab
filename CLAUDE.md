# TexLab

Pixel art texture editor for Minecraft resource packs, built with Tauri v2 (Rust + React). Integrates with AI agents via an embedded MCP server.

## Project Context

- **What it does**: Edit and create textures for Minecraft resource packs (vanilla + mods). Supports layers, palettes, and project-based workflow with source management.
- **What it doesn't do**: No 3D modeling. Model preview is read-only (Three.js).
- **Target users**: Minecraft resource pack creators. Public distribution, cross-platform.
- **Design files**: `ui-design` at repo root (Pencil .pen format, open with Pencil MCP)

## Architecture

Strict Clean Architecture with inward-pointing dependencies. See `.specify/memory/constitution.md` for the full constitution (7 principles).

```
src-tauri/src/
  domain/          # Pure logic, ZERO external deps (no tauri, no serde, no image)
  use_cases/       # Orchestration, imports ONLY from domain/
  infrastructure/  # I/O adapters (PNG, ZIP, JSON, MCP server)
  commands/        # Thin Tauri command wrappers, delegates to use_cases
  mcp/             # Embedded MCP server (rmcp)
  state.rs         # Mutex<AppState> — single source of truth (frontend + MCP)

src/               # React + TypeScript frontend
  api/             # Typed invoke() wrappers
  components/      # UI by feature (canvas, tools, layers, color, palette, etc.)
  hooks/           # React hooks
  store/           # Zustand stores (cache of Rust state, NOT independent source)
```

**Key rules**:
- `domain/` and `use_cases/` MUST NOT import from tauri, serde, image, or any infra crate
- Tauri commands return `Result<T, AppError>` with owned types (`String`, not `&str`)
- All commands registered in `generate_handler![]`
- Domain types have NO serde derives — separate DTOs for IPC
- State is shared between frontend (Tauri IPC) and MCP server (direct Rust)

## Tech Stack

- **Backend**: Rust — tauri ^2.10, image ^0.25, uuid ^1, thiserror ^2, tokio ^1, zip ^8, rmcp ^1.3
- **Frontend**: React 19, TypeScript 5, Zustand 5, dockview ^5.2, Vite 6
- **3D (Tier 2)**: three ^0.183, @react-three/fiber ^9, @react-three/drei ^10

## Development Workflow

- Use `/speckit.specify #<issue>` to start a feature from a GitHub issue
- Follow SpecKit flow: specify → plan → tasks → implement → verify
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Reference issue numbers in commits

## Skills Available

- `/tauri-v2`: Tauri v2 patterns, IPC, capabilities, troubleshooting
- `/architecture-patterns`: Clean Architecture, Hexagonal, DDD patterns
- `/speckit.*`: Feature specification and implementation workflow
- `/git-commit`: Conventional commit generation

## Key Concepts

- **Project**: Folder with `project.texlab.json` — links to sources, stores overrides
- **Source**: Resource pack or mod .jar — duplicated into `<project>/sources/` at import
- **.texlab**: ZIP archive per texture — contains layer PNGs + metadata JSON. Created lazily on first edit.
- **Progressive conversion**: Opening a source texture reads the original PNG. A .texlab is created only when the user edits.
- **Panels**: Dockable via dockview — Sources, Layers, Color, Palette, Model Preview. User arranges freely.
- **MCP**: Embedded Streamable HTTP server (rmcp). AI agents read/modify textures via tools (get_editor_state, set_pixels, etc.)

## Active Technologies
- Rust ≥ 1.77 (backend), TypeScript ^5.7 (frontend), Node.js ≥ 20 LTS + tauri ^2.10, react ^19.2, vite ^6.0, zustand ^5.0 (see constitution for full list) (001-project-scaffolding)
- File system only (project files, .texlab archives — future features) (001-project-scaffolding)

## Recent Changes
- 001-project-scaffolding: Added Rust ≥ 1.77 (backend), TypeScript ^5.7 (frontend), Node.js ≥ 20 LTS + tauri ^2.10, react ^19.2, vite ^6.0, zustand ^5.0 (see constitution for full list)
