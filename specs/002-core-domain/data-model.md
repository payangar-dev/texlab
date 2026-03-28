# Data Model: Core Domain

**Feature**: 002-core-domain | **Date**: 2026-03-28

## Entities & Value Objects

### Color (Value Object)

Immutable RGBA color. Type system enforces 0-255 per channel (u8).

| Field | Type | Constraint |
|-------|------|------------|
| r     | u8   | 0-255 (enforced by type) |
| g     | u8   | 0-255 (enforced by type) |
| b     | u8   | 0-255 (enforced by type) |
| a     | u8   | 0-255 (enforced by type) |

**Invariants**: None needed — `u8` makes invalid values unrepresentable.
**Equality**: Two colors are equal if all four channels match.
**Constants**: `Color::TRANSPARENT` (0, 0, 0, 0), `Color::BLACK` (0, 0, 0, 255), `Color::WHITE` (255, 255, 255, 255).

---

### BlendMode (Enum)

Determines how two colors are combined during compositing.

| Variant  | Formula (per channel, 0-255)                                     |
|----------|------------------------------------------------------------------|
| Normal   | `top`                                                            |
| Multiply | `(base * top) / 255`                                            |
| Screen   | `255 - ((255 - base) * (255 - top)) / 255`                      |
| Overlay  | `if base < 128: (2 * base * top) / 255 else: 255 - (2 * (255 - base) * (255 - top)) / 255` |

**Default**: Normal.

---

### PixelBuffer (Entity)

Rectangular grid of RGBA pixels. Validates non-zero dimensions at construction.

| Field  | Type     | Constraint          |
|--------|----------|---------------------|
| width  | u32      | > 0                 |
| height | u32      | > 0                 |
| data   | Vec<u8>  | length = width × height × 4 |

**Invariants**:
- Width and height must be > 0 (validated at construction, returns error if violated).
- Data length is always exactly `width * height * 4`.

**Operations**:
| Method | Input | Output | Behavior |
|--------|-------|--------|----------|
| `new(width, height)` | dimensions | `Result<PixelBuffer, DomainError>` | Creates buffer filled with transparent pixels. Rejects zero dimensions. |
| `get_pixel(x, y)` | coordinates | `Result<Color, DomainError>` | Returns color at (x, y). Rejects out-of-bounds. |
| `set_pixel(x, y, color)` | coordinates + color | `Result<(), DomainError>` | Sets pixel at (x, y). Rejects out-of-bounds. |
| `fill_rect(x, y, w, h, color)` | rect + color | `()` | Fills region, clips to bounds silently. |
| `clone_data()` | — | `Vec<u8>` | Returns independent copy of raw pixel data. |
| `width()` / `height()` | — | `u32` | Accessor for dimensions. |

---

### LayerId (Value Object)

Unique layer identifier. Newtype over `u128` for UUID compatibility without external crate dependency.

**Invariants**: None — any u128 is a valid ID.
**Equality**: Derived from inner value.

---

### Layer (Entity)

Named editing surface with pixel buffer and compositing properties.

| Field      | Type        | Constraint              | Default     |
|------------|-------------|-------------------------|-------------|
| id         | LayerId     | unique within stack     | (provided)  |
| name       | String      | non-empty               | (provided)  |
| buffer     | PixelBuffer | same dimensions as texture | (provided) |
| opacity    | f32         | 0.0 - 1.0              | 1.0         |
| blend_mode | BlendMode   | —                       | Normal      |
| visible    | bool        | —                       | true        |
| locked     | bool        | —                       | false       |

**Invariants**:
- Opacity clamped to [0.0, 1.0] at construction and on update.
- Name must be non-empty.

**Operations**:
| Method | Behavior |
|--------|----------|
| `new(id, name, width, height)` | Creates layer with default properties and transparent buffer. |
| `set_pixel(x, y, color)` | Delegates to buffer. Returns `DomainError::LayerLocked` if locked. |
| `set_opacity(value)` | Clamps to [0.0, 1.0]. |
| `set_visible(bool)` | Toggles visibility. |
| `set_locked(bool)` | Toggles lock state. |
| `set_blend_mode(mode)` | Changes blend mode. |
| `set_name(name)` | Changes name. Rejects empty. |

---

### LayerStack (Entity)

Ordered collection of layers (bottom to top). Manages layer lifecycle and compositing.

| Field  | Type        | Constraint |
|--------|-------------|------------|
| layers | Vec<Layer>  | ordered bottom-to-top |

**Operations**:
| Method | Input | Output | Behavior |
|--------|-------|--------|----------|
| `new()` | — | `LayerStack` | Creates empty stack. |
| `add_layer(layer)` | Layer | `()` | Pushes layer to top of stack. |
| `remove_layer(id)` | LayerId | `Option<Layer>` | Removes and returns layer by ID, or None. |
| `move_layer(from, to)` | indices | `Result<(), DomainError>` | Reorders layer. Rejects invalid indices. |
| `get_layer(id)` | LayerId | `Option<&Layer>` | Read access by ID. |
| `get_layer_mut(id)` | LayerId | `Option<&mut Layer>` | Mutable access by ID. |
| `composite(width, height)` | dimensions | `PixelBuffer` | Flattens all visible layers with opacity > 0. |
| `len()` | — | `usize` | Number of layers. |
| `is_empty()` | — | `bool` | True if no layers. |

**Compositing algorithm**:
1. Create result buffer (width × height), filled with transparent pixels.
2. Iterate layers bottom to top.
3. Skip hidden layers and layers with opacity == 0.0.
4. For each visible layer, for each pixel:
   a. Compute blended color using the layer's blend mode.
   b. Mix blended color with current result using Porter-Duff "source over" with layer opacity.
5. Return result buffer.

---

### Texture (Entity)

Top-level document model. Owns canvas dimensions and layer stack.

| Field       | Type       | Constraint     |
|-------------|------------|----------------|
| namespace   | String     | non-empty      |
| path        | String     | non-empty      |
| width       | u32        | > 0            |
| height      | u32        | > 0            |
| layer_stack | LayerStack | —              |
| dirty       | bool       | —              |

**Invariants**:
- Namespace and path must be non-empty.
- Width and height must be > 0.
- All layers in the stack share the texture's width and height.

**State transitions**:
- Created → dirty = false
- Any modification (pixel set, layer added/removed/reordered, property changed) → dirty = true
- Explicitly marked as saved → dirty = false

**Note**: Dirty tracking is caller-managed. The orchestration layer (use cases) is responsible for calling `mark_dirty()` after mutations via `layer_stack_mut()`. The domain does not auto-propagate dirty state from layer changes.

**Operations**:
| Method | Behavior |
|--------|----------|
| `new(namespace, path, width, height)` | Creates texture with empty layer stack, not dirty. |
| `mark_dirty()` | Sets dirty = true. |
| `mark_saved()` | Sets dirty = false. |
| `add_layer(id, name)` | Creates layer with texture dimensions, adds to stack, marks dirty. |
| `layer_stack()` / `layer_stack_mut()` | Access to layer stack. |

---

### DomainError (Enum)

Domain-specific error type. Uses only `std` (no thiserror).

| Variant | Fields | When |
|---------|--------|------|
| `InvalidDimensions` | width, height | Zero width or height on PixelBuffer/Texture creation |
| `OutOfBounds` | x, y, width, height | Pixel access outside buffer bounds |
| `LayerLocked` | layer_id: LayerId | Write to a locked layer |
| `LayerNotFound` | layer_id: LayerId | Layer ID not in stack |
| `InvalidIndex` | index, len | Layer move with out-of-range index |
| `EmptyName` | — | Empty string for layer name, namespace, or path |

## Port Traits (Interfaces)

These traits define I/O boundaries. They live in `domain/` but are implemented in `infrastructure/`.

### ImageReader

```
trait ImageReader {
    fn read(&self, path) -> Result<PixelBuffer, DomainError>
}
```

Loads pixel data from an external image source. The path format is opaque to the domain.

### ImageWriter

```
trait ImageWriter {
    fn write(&self, path, buffer: &PixelBuffer) -> Result<(), DomainError>
}
```

Persists pixel data to an external destination.

### PackScanner

```
trait PackScanner {
    fn scan(&self, path) -> Result<Vec<TextureEntry>, DomainError>
}
```

Enumerates texture entries in a resource pack.

**TextureEntry** (Value Object):

| Field     | Type   | Description |
|-----------|--------|-------------|
| namespace | String | e.g., "minecraft" |
| path      | String | e.g., "textures/block/stone.png" |

## Relationships

```
Texture 1──1 LayerStack 1──* Layer 1──1 PixelBuffer
                                  │
                                  ├── BlendMode
                                  └── LayerId

Color (standalone value object, used by PixelBuffer operations)

Ports: ImageReader, ImageWriter, PackScanner (trait interfaces, no relationships)
```
