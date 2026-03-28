# Quickstart: Core Domain

**Feature**: 002-core-domain | **Date**: 2026-03-28

## What This Feature Does

Implements the pure domain layer for TexLab's texture editor: pixel buffers, colors, layers, blend modes, and layer compositing. All types are testable in isolation with zero external dependencies.

## Where Code Lives

```
src-tauri/src/domain/
├── mod.rs           # Module declarations, re-exports
├── error.rs         # DomainError enum (std only)
├── color.rs         # Color value object (u8 RGBA)
├── blend.rs         # BlendMode enum + blend() function
├── pixel_buffer.rs  # PixelBuffer (Vec<u8> RGBA grid)
├── layer.rs         # Layer (buffer + properties) + LayerId
├── layer_stack.rs   # LayerStack (ordered layers + compositing)
├── texture.rs       # Texture (document model + dirty tracking)
└── ports.rs         # Port traits: ImageReader, ImageWriter, PackScanner
```

## Key Design Decisions

1. **Color uses u8 channels** — Rust's type system enforces 0-255 at compile time. No runtime validation needed.
2. **LayerId is a u128 newtype** — UUID-compatible without importing the `uuid` crate into domain.
3. **DomainError with manual Display/Error** — No `thiserror` in domain; only std traits.
4. **fill_rect clips silently** — Standard pixel art editor behavior.
5. **Texture owns width × height** — All layers share canvas dimensions.
6. **Blend formulas use integer arithmetic** — Photoshop-compatible, sufficient for 8-bit art.

## How to Run Tests

```bash
cd src-tauri
cargo test --lib domain
```

Each domain module contains inline `#[cfg(test)] mod tests { ... }` blocks.

## Dependencies

**Domain layer**: zero external crates. Only `std`.

**Test dependencies**: none beyond `cargo test` built-in.

## Architecture Constraints

- `domain/` MUST NOT contain `use tauri::`, `use serde::`, `use image::`, or any external crate import.
- No `#[derive(Serialize)]` or `#[derive(Deserialize)]` on domain types.
- Port traits are defined here but implemented in `infrastructure/`.
