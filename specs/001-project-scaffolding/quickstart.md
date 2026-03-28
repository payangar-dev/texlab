# Quickstart: Project Scaffolding

**Feature**: 001-project-scaffolding | **Date**: 2026-03-28

## Prerequisites

- **Rust** ≥ 1.77 (`rustup update stable`)
- **Node.js** ≥ 20 LTS (`node --version`)
- **npm** (bundled with Node.js)
- **Platform build tools**: Visual Studio C++ Build Tools (Windows), Xcode CLI (macOS), or `build-essential` (Linux)

## Setup (from fresh clone)

```bash
# 1. Install frontend dependencies
npm install

# 2. Run the application in development mode
npm run tauri dev
```

The app should open a window titled "TexLab" within 10 seconds.

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run tauri dev` | Start the app in development mode (Vite HMR + Rust rebuild) |
| `npm run tauri build` | Build production binaries |
| `npm run dev` | Start only the Vite frontend dev server (no Tauri) |
| `npm run build` | Build only the frontend (Vite) |
| `cargo build` | Build only the Rust backend (from `src-tauri/`) |
| `cargo test` | Run Rust unit tests (from `src-tauri/`) |

## Verification

After setup, verify the scaffolding is correct:

1. **App launches**: `npm run tauri dev` → window titled "TexLab" appears, blank page, no console errors.
2. **Clean exit**: Close the window → process exits, no orphaned processes.
3. **Rust builds clean**: `cd src-tauri && cargo build` → zero warnings.
4. **Frontend builds clean**: `npm run build` → zero warnings.
5. **Directory structure**: All directories listed in `CONTRIBUTING.md` exist and are non-empty.

## Project Structure Overview

```
texture-lab/
├── src/                  # React frontend (TypeScript)
│   ├── api/              # Typed invoke() wrappers
│   ├── components/       # UI components by feature
│   ├── hooks/            # React hooks
│   └── store/            # Zustand stores
└── src-tauri/            # Rust backend
    └── src/
        ├── domain/       # Pure business logic (no external deps)
        ├── use_cases/    # Orchestration (imports only domain/)
        ├── infrastructure/ # I/O adapters
        ├── commands/     # Tauri command wrappers
        └── mcp/          # MCP server (future)
```
