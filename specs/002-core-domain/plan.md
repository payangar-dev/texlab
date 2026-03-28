# Implementation Plan: Core Domain

**Branch**: `002-core-domain` | **Date**: 2026-03-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-core-domain/spec.md`

## Summary

Implement the pure domain layer for TexLab: pixel buffers, colors, blend modes, layers, layer stacks with compositing, and the texture document model. All types live in `src-tauri/src/domain/` with zero external dependencies (only std). Port traits define I/O boundaries for future infrastructure adapters.

## Technical Context

**Language/Version**: Rust ≥ 1.77
**Primary Dependencies**: None (domain layer — std only)
**Storage**: N/A (no I/O in domain)
**Testing**: `cargo test --lib domain` (inline `#[cfg(test)]` modules)
**Target Platform**: Windows, macOS, Linux (via Tauri, but domain is platform-agnostic)
**Project Type**: Desktop app — domain layer only
**Performance Goals**: N/A — Minecraft textures are 16×16 to 512×512, no optimization needed
**Constraints**: Zero external crate imports in `domain/`. No serde derives on domain types.
**Scale/Scope**: 9 domain types, ~10 source files, ~500-800 lines of domain code + tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Clean Architecture | PASS | All code in `domain/`, no cross-layer imports |
| II. Domain Purity | PASS | Zero external deps, u8 enforces Color invariants, manual Error impl |
| III. Dual-Access State | N/A | No commands or state management in this feature |
| IV. Test-First Domain | PASS | All types get inline unit tests, in-memory only |
| V. Progressive Processing | N/A | No file I/O in this feature |
| VI. Simplicity | PASS | Integer blend math, u128 LayerId, no premature abstractions |
| VII. Component-Based UI | N/A | No frontend in this feature |

**Gate result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-core-domain/
├── plan.md              # This file
├── research.md          # Phase 0: design decisions and formulas
├── data-model.md        # Phase 1: entity definitions and relationships
├── quickstart.md        # Phase 1: developer guide
├── checklists/
│   └── requirements.md  # Spec quality validation
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code

```text
src-tauri/src/domain/
├── mod.rs               # Module declarations, public re-exports
├── error.rs             # DomainError enum (manual Display + Error)
├── color.rs             # Color (u8 RGBA) + TRANSPARENT/BLACK/WHITE constants
├── blend.rs             # BlendMode enum + blend(base, top, mode, opacity) -> Color
├── pixel_buffer.rs      # PixelBuffer (width, height, Vec<u8>), get/set/fill_rect/clone
├── layer.rs             # LayerId (u128 newtype) + Layer (buffer + properties)
├── layer_stack.rs       # LayerStack (Vec<Layer>, add/remove/move/composite)
├── texture.rs           # Texture (namespace, path, dimensions, stack, dirty)
└── ports.rs             # Traits: ImageReader, ImageWriter, PackScanner + TextureEntry
```

**Structure Decision**: All domain code in a single flat module (`domain/`). No sub-modules or nested directories — there are only ~10 files and they're all closely related. This matches the existing scaffolding structure.

## Complexity Tracking

No violations to justify — all constitution gates pass.
