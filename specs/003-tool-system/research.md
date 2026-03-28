# Research: Tool System

**Feature Branch**: `003-tool-system`
**Date**: 2026-03-28

## Research Task 1: Line Drawing Algorithm

**Context**: The line tool requires pixel-perfect straight lines with no gaps (FR-007, SC-006).

**Decision**: Bresenham's line algorithm

**Rationale**: Bresenham's algorithm is the standard for pixel-perfect line rasterization. It uses only integer arithmetic, produces exactly N pixels for a horizontal line of length N, and guarantees no gaps on any slope. The algorithm handles all octants and produces visually correct results for pixel art.

**Alternatives considered**:
- **DDA (Digital Differential Analyzer)**: Uses floating-point arithmetic, can produce rounding artifacts. Unnecessary when integer-only precision is available.
- **Wu's algorithm**: Produces anti-aliased lines. Explicitly wrong for pixel art where hard edges are desired.

**Implementation notes**:
- Use the symmetric Bresenham variant that handles all octants (steep and shallow slopes)
- Always include both endpoints
- Handle degenerate case (start == end) as a single pixel

## Research Task 2: Flood Fill Algorithm

**Context**: The fill tool replaces all contiguous same-color pixels using 4-directional connectivity (FR-005). Must handle large canvases without stack overflow (edge case in spec).

**Decision**: Queue-based BFS (Breadth-First Search) flood fill

**Rationale**: BFS with an explicit queue avoids stack overflow entirely, regardless of fill area size. For Minecraft textures (typically 16x16 to 64x64, max ~256x256), memory usage is negligible. BFS also produces a natural fill pattern that is predictable for debugging.

**Alternatives considered**:
- **Recursive DFS**: Simple to implement but risks stack overflow on large contiguous areas. A 256x256 canvas can have 65,536 pixels — well beyond typical stack depths.
- **Scanline fill**: More cache-efficient for very large images. Over-engineering for pixel art dimensions (max ~256x256). Added complexity not justified.
- **Span-based fill**: Similar to scanline — optimized for large images, unnecessary here.

**Implementation notes**:
- Use `VecDeque` as the queue (Rust's standard deque from `std::collections`)
- Track visited pixels with a `Vec<bool>` bitmap (width * height)
- Compare colors using `Color::eq` (exact match, already derived)
- 4-directional neighbors: up, down, left, right (no diagonals per FR-005)
- Short-circuit when target color equals fill color (no-op per FR-012)

## Research Task 3: Brush/Eraser Stroke Interpolation

**Context**: Brush and eraser must interpolate between consecutive positions during drag to prevent gaps (FR-009). The user may move the cursor faster than the input sampling rate.

**Decision**: Bresenham interpolation between consecutive drag positions

**Rationale**: Reuses the same Bresenham algorithm from the line tool. For each interpolated position along the Bresenham path, stamp the brush square. This guarantees gap-free strokes regardless of cursor speed.

**Alternatives considered**:
- **No interpolation (discrete stamps)**: Fast cursor movement produces gaps. Violates FR-009.
- **Catmull-Rom / Bezier interpolation**: Produces smooth curves, but pixel art editors use linear interpolation between samples. Smooth curves would produce unexpected results at low resolutions.

**Implementation notes**:
- Extract Bresenham's algorithm into a shared utility function (`bresenham_line`) used by both the line tool and brush/eraser interpolation
- On each interpolated position, call `PixelBuffer::fill_rect` with the brush size
- The eraser uses the same interpolation but fills with `Color::TRANSPARENT`

## Research Task 4: Tool State Management Pattern

**Context**: Tools need to track state across the press-drag-release lifecycle. The brush needs the previous drag position; the line and selection tools need the press position.

**Decision**: Mutable tool structs with `&mut self` on interaction methods

**Rationale**: Each tool struct holds its own interaction state (e.g., `last_position`, `start_position`). State is set in `on_press` and consumed in `on_drag`/`on_release`. This is the simplest pattern that satisfies the requirement — no external session management, no state machines.

**Alternatives considered**:
- **Separate ToolSession/ToolState struct**: Adds an abstraction layer for minimal benefit. 6 tools with simple state don't warrant session management infrastructure.
- **Event carries previous position**: Makes `on_drag` stateless but requires the caller to track state. Moves complexity without reducing it, and doesn't solve the line tool's need for start position.
- **Enum-based state machine per tool**: Over-engineering for a 3-phase lifecycle (press → drag* → release).

**Implementation notes**:
- Tools reset state in `on_press` (beginning of new interaction)
- `Option<(u32, u32)>` for positions not yet set
- Tools are cheap to create (no heap allocation in default state)

## Research Task 5: ToolContext Design and Locked Layer Handling

**Context**: FR-010 requires all tools to reject operations on locked layers. ToolContext provides the pixel buffer and parameters to tools.

**Decision**: ToolContext holds `&mut PixelBuffer`. Lock check happens before context creation via `Layer::buffer_mut()`.

**Rationale**: Adding `buffer_mut()` to `Layer` that guards locked status ensures the invariant is enforced at the point of mutable access. If the layer is locked, `buffer_mut()` returns `DomainError::LayerLocked` before any tool code runs. The tool receives a known-unlocked buffer.

This applies uniformly to all tools, including read-only tools (color picker, selection), per FR-010's explicit "all tools" requirement.

**Alternatives considered**:
- **Tool checks locked status itself**: Duplicates the check across 6 tools. Error-prone.
- **Read-only ToolContext variant for non-modifying tools**: Adds type complexity for 2 out of 6 tools. The read-only tools simply don't call mutating methods — passing `&mut PixelBuffer` is harmless.
- **Exempt color picker and selection from lock check**: Better UX but violates FR-010 ("All tools MUST reject").

## Research Task 6: Existing PixelBuffer API Sufficiency

**Context**: Tools need to read and write pixels. The existing `PixelBuffer` API must support all tool operations.

**Decision**: The existing API is sufficient with no modifications needed to `PixelBuffer` itself.

**Rationale**: Current `PixelBuffer` methods cover all tool needs:
- `get_pixel(x, y)` — color picker reads pixels
- `set_pixel(x, y, color)` — line tool sets individual pixels
- `fill_rect(x, y, w, h, color)` — brush/eraser stamp squares with silent clipping
- `width()` / `height()` — boundary checks, selection clipping

**What IS needed (on Layer, not PixelBuffer)**:
- `Layer::buffer_mut(&mut self) -> Result<&mut PixelBuffer, DomainError>` — new method to provide mutable buffer access with locked guard. Currently only `buffer()` (read-only) and `set_pixel()` (single pixel) exist.
