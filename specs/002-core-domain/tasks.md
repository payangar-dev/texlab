# Tasks: Core Domain — PixelBuffer, Color, Layer, LayerStack, BlendMode

**Input**: Design documents from `/specs/002-core-domain/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included — the specification (SC-005) and constitution (Principle IV) require 100% unit test coverage of domain types.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1-US6)
- All paths relative to repository root

---

## Phase 1: Setup

**Purpose**: Establish domain module structure

- [ ] T001 Create domain module entry point in src-tauri/src/domain/mod.rs — declare submodules (error, color, blend, pixel_buffer, layer, layer_stack, texture, ports) and add public re-exports for all domain types. Reference data-model.md for the complete type list. At this stage, create each submodule file as an empty file so the project compiles.

---

## Phase 2: Foundational — US2: Validated Colors (Priority: P1)

**Purpose**: DomainError and Color are prerequisites for ALL other domain types. This phase satisfies User Story 2 (Validated Colors) as a side effect.

**Goal**: Provide a validated Color value object and a domain error type — both using only std.

**Independent Test**: `cargo test --lib domain::error` and `cargo test --lib domain::color` pass.

- [ ] T002 [P] [US2] Implement DomainError enum in src-tauri/src/domain/error.rs — Variants: InvalidDimensions { width: u32, height: u32 }, OutOfBounds { x: u32, y: u32, width: u32, height: u32 }, LayerLocked { layer_id: u128 }, LayerNotFound { layer_id: u128 }, InvalidIndex { index: usize, len: usize }, EmptyName. Manual `impl Display` and `impl Error` using only std. Add unit tests for Display output of each variant.
- [ ] T003 [P] [US2] Implement Color value object in src-tauri/src/domain/color.rs — Struct with r, g, b, a: u8 fields. Derive Clone, Copy, Debug, PartialEq, Eq. Constructor `new(r, g, b, a) -> Color`. Constants: TRANSPARENT (0,0,0,0), BLACK (0,0,0,255), WHITE (255,255,255,255). Unit tests: construction stores correct values, equality works, constants are correct.

**Checkpoint**: DomainError and Color compile and pass tests. No external crate imports.

---

## Phase 3: US1 — Pixel Manipulation (Priority: P1)

**Goal**: A PixelBuffer stores RGBA pixel data and supports get/set/fill/clone operations.

**Independent Test**: `cargo test --lib domain::pixel_buffer` passes all scenarios from spec US1.

- [ ] T004 [US1] Implement PixelBuffer in src-tauri/src/domain/pixel_buffer.rs — Struct with width: u32, height: u32, data: Vec<u8>. Constructor `new(width, height) -> Result<Self, DomainError>` rejects zero dimensions, initializes to transparent. Methods: `get_pixel(x, y) -> Result<Color, DomainError>`, `set_pixel(x, y, color) -> Result<(), DomainError>` (both reject out-of-bounds), `fill_rect(x, y, w, h, color)` (clips to bounds silently per research R5), `clone_data() -> Vec<u8>`, `width() -> u32`, `height() -> u32`, `pixels() -> &[u8]` (read-only access to raw data). Unit tests: create valid buffer, reject zero dims, get/set roundtrip, out-of-bounds rejected, fill_rect fills correctly, fill_rect clips at edges, clone_data is independent copy.

**Checkpoint**: PixelBuffer fully functional. `cargo test --lib domain` passes.

---

## Phase 4: US3 — Layer Organization (Priority: P1)

**Goal**: Layers wrap a PixelBuffer with identity, name, opacity, blend mode, visibility, and lock state.

**Independent Test**: `cargo test --lib domain::layer` and `cargo test --lib domain::blend` pass all scenarios from spec US3.

- [ ] T005 [P] [US3] Implement BlendMode enum in src-tauri/src/domain/blend.rs — Variants: Normal, Multiply, Screen, Overlay. Derive Clone, Copy, Debug, PartialEq, Eq. Implement Default = Normal. No blend function yet (that's US4). Unit test: default is Normal.
- [ ] T006 [US3] Implement LayerId and Layer in src-tauri/src/domain/layer.rs — LayerId: newtype over u128, derive Clone, Copy, Debug, PartialEq, Eq, Hash. Layer struct with fields per data-model.md. Constructor `new(id: LayerId, name: String, width: u32, height: u32) -> Result<Self, DomainError>` creates layer with transparent buffer, opacity 1.0, Normal blend, visible, unlocked; rejects empty name. Methods: `set_pixel(x, y, color) -> Result<(), DomainError>` returns LayerLocked if locked otherwise delegates to buffer, `set_opacity(f32)` clamps to [0.0, 1.0], `set_visible(bool)`, `set_locked(bool)`, `set_blend_mode(BlendMode)`, `set_name(String) -> Result<(), DomainError>` rejects empty, plus getters for all fields. Unit tests: new with defaults, set_pixel works, locked layer rejects writes, opacity clamping, empty name rejected, property getters.

**Checkpoint**: Layer and BlendMode fully functional. `cargo test --lib domain` passes.

---

## Phase 5: US4 — Layer Compositing with Blend Modes (Priority: P2)

**Goal**: Blend two colors per mode with opacity, and composite an ordered stack of layers into a flattened result.

**Independent Test**: `cargo test --lib domain::blend` and `cargo test --lib domain::layer_stack` pass all scenarios from spec US4.

- [ ] T007 [US4] Implement blend function in src-tauri/src/domain/blend.rs — Function `blend(base: Color, top: Color, mode: BlendMode, opacity: f32) -> Color` applies blend mode formula per research R4 then alpha-composites with Porter-Duff "source over" using opacity. Use u16/f32 intermediates to avoid overflow, clamp results to u8. Unit tests: Normal blend at full opacity = top, Normal at 50% = lerp, Multiply known values (e.g., 200×100/255), Screen known values, Overlay with base < 128 and base >= 128, fully transparent top leaves base unchanged, opacity 0 leaves base unchanged.
- [ ] T008 [US4] Implement LayerStack in src-tauri/src/domain/layer_stack.rs — Struct with layers: Vec<Layer>. Methods: `new() -> Self`, `add_layer(layer)`, `remove_layer(id) -> Option<Layer>`, `move_layer(from, to) -> Result<(), DomainError>` rejects invalid indices, `get_layer(id) -> Option<&Layer>`, `get_layer_mut(id) -> Option<&mut Layer>`, `len()`, `is_empty()`, `layers() -> &[Layer]`, `composite(width, height) -> PixelBuffer` iterates bottom-to-top, skips hidden/zero-opacity layers, blends each pixel using layer's blend mode and opacity per research R4. Unit tests: empty stack composites to transparent, single layer composite = layer data, two layers Normal blend, hidden layer skipped, zero-opacity layer skipped, Multiply/Screen/Overlay composite results, add/remove/move operations, move with invalid index rejected.

**Checkpoint**: Full compositing pipeline works. `cargo test --lib domain` passes.

---

## Phase 6: US5 — Texture Document (Priority: P2)

**Goal**: Texture ties together metadata, dimensions, layer stack, and dirty tracking.

**Independent Test**: `cargo test --lib domain::texture` passes all scenarios from spec US5.

- [ ] T009 [US5] Implement Texture in src-tauri/src/domain/texture.rs — Struct with namespace: String, path: String, width: u32, height: u32, layer_stack: LayerStack, dirty: bool. Constructor `new(namespace, path, width, height) -> Result<Self, DomainError>` rejects empty namespace/path and zero dimensions, starts clean (dirty=false) with empty stack. Methods: `mark_dirty()`, `mark_saved()`, `is_dirty() -> bool`, `add_layer(id, name) -> Result<(), DomainError>` creates a layer with texture dimensions and adds to stack then marks dirty, `layer_stack() -> &LayerStack`, `layer_stack_mut() -> &mut LayerStack`, `namespace()`, `path()`, `width()`, `height()` getters. Unit tests: new with valid data, reject empty namespace, reject empty path, reject zero dimensions, starts not dirty, mark_dirty/mark_saved transitions, add_layer marks dirty and creates correct-sized layer.

**Checkpoint**: Texture document model complete. `cargo test --lib domain` passes.

---

## Phase 7: US6 — I/O Port Definitions (Priority: P3)

**Goal**: Define trait contracts for image I/O and pack scanning without any implementation.

**Independent Test**: Port traits compile and can be implemented by test doubles.

- [ ] T010 [US6] Define port traits and TextureEntry in src-tauri/src/domain/ports.rs — TextureEntry value object: namespace: String, path: String (derive Clone, Debug, PartialEq). Traits: `ImageReader` with `fn read(&self, path: &str) -> Result<PixelBuffer, DomainError>`, `ImageWriter` with `fn write(&self, path: &str, buffer: &PixelBuffer) -> Result<(), DomainError>`, `PackScanner` with `fn scan(&self, path: &str) -> Result<Vec<TextureEntry>, DomainError>`. Unit tests: implement minimal mock for each trait (e.g., MockImageReader that returns a 2×2 buffer) and verify the mock satisfies the trait contract.

**Checkpoint**: All port traits defined and testable via mocks. `cargo test --lib domain` passes.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and compliance checks

- [ ] T011 Finalize domain module re-exports in src-tauri/src/domain/mod.rs — ensure all public types (Color, PixelBuffer, BlendMode, LayerId, Layer, LayerStack, Texture, DomainError, TextureEntry, ImageReader, ImageWriter, PackScanner) are re-exported. Run `cargo test --lib` to verify the full test suite passes. Verify `cargo clippy -- -D warnings` passes on domain code.
- [ ] T012 Audit domain/ for zero-dependency compliance — grep all .rs files in src-tauri/src/domain/ for `use` statements. Verify none reference tauri, serde, image, thiserror, uuid, or any external crate. Verify no `#[derive(Serialize)]` or `#[derive(Deserialize)]` on any domain type. Document compliance in a comment at the top of src-tauri/src/domain/mod.rs.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (needs Color + DomainError)
- **US3 (Phase 4)**: T005 (BlendMode) depends on Phase 2 only; T006 (Layer) depends on Phase 3 (needs PixelBuffer) and T005
- **US4 (Phase 5)**: Depends on Phase 4 (needs Layer + BlendMode)
- **US5 (Phase 6)**: Depends on Phase 5 (needs LayerStack)
- **US6 (Phase 7)**: Depends on Phase 2 only (ports need PixelBuffer + DomainError, not Layer/Stack)
- **Polish (Phase 8)**: Depends on all phases complete

### User Story Dependencies

```
Phase 2 (DomainError + Color)
  ├──→ Phase 3 (US1: PixelBuffer)
  │      └──→ Phase 4 (US3: Layer)
  │             └──→ Phase 5 (US4: LayerStack + Compositing)
  │                    └──→ Phase 6 (US5: Texture)
  └──→ Phase 7 (US6: Ports) [independent branch]
```

### Parallel Opportunities

- **Phase 2**: T002 (DomainError) and T003 (Color) in parallel — different files
- **Phase 3-4**: T005 (BlendMode) depends only on Phase 2 — can start in parallel with T004 (PixelBuffer), different files, no dependency. T006 (Layer) waits for both T004 and T005.
- **Phase 7**: US6 (Ports) can run in parallel with Phases 3-6 — only depends on Phase 2

### Within Each Story

- Write tests first in `#[cfg(test)] mod tests`, verify they fail
- Implement until tests pass
- Commit after each task

---

## Parallel Example: Phases 2-4

```bash
# After Phase 1 completes, launch Phase 2 tasks in parallel:
Task T002: "DomainError in src-tauri/src/domain/error.rs"
Task T003: "Color in src-tauri/src/domain/color.rs"

# After Phase 2 completes, T004 and T005 can run in parallel:
Task T004: "PixelBuffer in src-tauri/src/domain/pixel_buffer.rs"
Task T005: "BlendMode in src-tauri/src/domain/blend.rs"

# US6 (T010) can also start here, independent of US1-US5:
Task T010: "Port traits in src-tauri/src/domain/ports.rs"
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Phase 1: Setup (T001)
2. Phase 2: DomainError + Color (T002, T003) — satisfies US2
3. Phase 3: PixelBuffer (T004) — satisfies US1
4. **STOP and VALIDATE**: `cargo test --lib domain` passes, Color + PixelBuffer work independently

### Incremental Delivery

1. Setup + Foundational → Color + DomainError ready
2. Add PixelBuffer → US1 testable independently
3. Add BlendMode + Layer → US3 testable independently
4. Add blend() + LayerStack → US4 testable independently (compositing works)
5. Add Texture → US5 testable independently
6. Add Ports → US6 testable independently
7. Polish → Full domain layer complete

### Single Developer (Sequential)

T001 → T002 ∥ T003 → T004 ∥ T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012

---

## Notes

- All domain files use inline `#[cfg(test)] mod tests { ... }` — no separate test directory
- Each task should result in a passing `cargo test --lib domain` run
- Reference data-model.md for exact struct fields and method signatures
- Reference research.md for blend formulas (R4) and design decisions
- All intermediate calculations in blend/composite must use u16 or f32 to prevent u8 overflow
- Commit after each task with `test(domain): ...` or `feat(domain): ...` prefix
