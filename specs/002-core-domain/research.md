# Research: Core Domain

**Feature**: 002-core-domain | **Date**: 2026-03-28

## R1: Color Representation in Pure Rust Domain

**Decision**: Use `u8` for each RGBA channel. No validation needed at construction.

**Rationale**: In Rust, `u8` is inherently constrained to 0-255. The type system enforces the invariant that the spec requires ("each channel must be in the 0-255 range") at compile time. There is no way to create an invalid Color value — the "validation at construction" principle is satisfied by the type choice itself.

**Alternatives considered**:
- `u16` or `f32` channels: unnecessary for 8-bit pixel art, adds complexity for no gain
- Newtype wrappers per channel: over-engineering for a 4-field struct

## R2: Layer Identity Without External Crates

**Decision**: Define `LayerId` as a newtype over `u128`. Layer IDs are passed in at construction, not generated within the domain.

**Rationale**: The constitution mandates zero external crate dependencies in `domain/`. The `uuid` crate (listed in the tech stack) can be used by `use_cases/` or `infrastructure/` to generate IDs, then pass them into domain types as `u128` (UUID is 128 bits). In tests, any `u128` value works as an ID. This keeps the domain pure while allowing UUID-based identity in production.

**Alternatives considered**:
- `String` ID: heap allocation for every layer reference, slower comparisons
- `u64` ID: insufficient for globally unique identifiers
- IdGenerator port trait in domain: adds abstraction for a simple value pass-through — violates Simplicity (Principle VI)

## R3: Domain Error Type (No thiserror)

**Decision**: Define `DomainError` as a plain `enum` with manual `Display` and `Error` impls using only `std`.

**Rationale**: `thiserror` is an external crate, forbidden in `domain/`. `std::fmt::Display` and `std::error::Error` are standard library traits. Manual implementation is trivial for a small error enum.

**Alternatives considered**:
- Return `String` errors: loses type safety, can't match on error variants
- Return `Option` instead of `Result`: loses error context

## R4: Blend Mode Formulas

**Decision**: Use standard Photoshop-compatible blend mode formulas with integer arithmetic in 0-255 space.

**Rationale**: These are industry-standard formulas used by Photoshop, GIMP, Krita, and Aseprite. Using them ensures predictable, familiar behavior for texture artists.

### Formulas (per channel, working in u8 0-255)

**Normal**:
```
blended = top
```

**Multiply**:
```
blended = (base * top) / 255
```

**Screen**:
```
blended = 255 - ((255 - base) * (255 - top)) / 255
```

**Overlay**:
```
if base < 128:
    blended = (2 * base * top) / 255
else:
    blended = 255 - (2 * (255 - base) * (255 - top)) / 255
```

### Alpha compositing with opacity (Porter-Duff "source over")

After computing `blended` via the blend mode:
```
effective_alpha = top.a * opacity            // opacity is f32 0.0-1.0
factor = effective_alpha / 255.0
result.r = lerp(base.r, blended.r, factor)   // lerp(a, b, t) = a + (b - a) * t
result.g = lerp(base.g, blended.g, factor)
result.b = lerp(base.b, blended.b, factor)
result.a = effective_alpha + base.a * (1.0 - factor)
```

All intermediate calculations use `u16` or `f32` to avoid overflow, then clamp back to `u8`.

**Alternatives considered**:
- Premultiplied alpha throughout: more efficient for heavy compositing, but adds complexity for simple 16×16 textures — violates Simplicity
- Floating-point 0.0-1.0 color space: unnecessary precision for 8-bit art, slower for no benefit

## R5: fill_rect Bounds Behavior

**Decision**: `fill_rect` clips the rectangle to canvas bounds silently.

**Rationale**: This is the universal standard in pixel art editors (Aseprite, Piskel, GIMP). When a user drags a fill operation near the edge of the canvas, the expectation is that the visible portion is filled, not that the operation fails entirely. Rejecting the entire operation on partial out-of-bounds would make the API hostile to callers.

**Alternatives considered**:
- Reject if any part is out of bounds: non-standard, unfriendly to drawing tools that naturally extend past edges
- Wrap around: nonsensical for a canvas editor

## R6: LayerStack Operations

**Decision**: LayerStack must support add, remove, and reorder operations in addition to compositing.

**Rationale**: The spec defines FR-010 ("maintain an ordered stack of layers") which implies mutation capabilities. Without add/remove/reorder, the stack is read-only and useless for an editor. These operations are fundamental to any layer-based editor.

Operations:
- `add_layer(layer)` — push to top of stack
- `remove_layer(id)` — remove by ID, return removed layer
- `move_layer(from_index, to_index)` — reorder within stack
- `get_layer(id)` / `get_layer_mut(id)` — access by ID

## R7: Texture Owns Canvas Dimensions

**Decision**: `Texture` owns `width` and `height` fields. All layers in a texture share these dimensions.

**Rationale**: In Minecraft resource packs, every texture has fixed dimensions (16×16, 32×32, etc.). All layers represent the same pixel grid. Having the texture own the canonical dimensions ensures consistency and simplifies layer creation — new layers automatically match the texture size. This is standard in pixel art editors (Aseprite, Piskel).

**Alternatives considered**:
- Independent layer dimensions with offset: useful for general-purpose editors like Photoshop, but over-engineering for fixed-size Minecraft textures — violates Simplicity
- Dimensions only on PixelBuffer: creates consistency enforcement burden across all callers
