# Feature Specification: Core Domain — PixelBuffer, Color, Layer, LayerStack, BlendMode

**Feature Branch**: `002-core-domain`
**Created**: 2026-03-28
**Status**: Draft
**Input**: GitHub Issue #2 — Core domain: PixelBuffer, Color, Layer, LayerStack, BlendMode

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manipulate Individual Pixels on a Canvas (Priority: P1)

A texture creator opens a texture and paints individual pixels. The system must store pixel data (RGBA) and allow reading and writing any pixel within the canvas bounds. This is the foundational building block for all drawing operations.

**Why this priority**: Without pixel-level read/write, no drawing tool or visual operation can function. This is the absolute minimum viable unit of work.

**Independent Test**: Can be fully tested by creating a pixel buffer, setting specific pixels to known colors, and verifying the values are stored and retrieved correctly.

**Acceptance Scenarios**:

1. **Given** an empty canvas of dimensions W x H, **When** a pixel is set at position (x, y) with a specific RGBA color, **Then** reading the pixel at (x, y) returns that exact color.
2. **Given** a canvas of dimensions W x H, **When** a pixel is set at a position outside the bounds, **Then** the operation is rejected without corrupting any data.
3. **Given** a canvas, **When** a rectangular region is filled with a single color, **Then** every pixel within that region holds the specified color and pixels outside are unchanged.
4. **Given** a canvas with pixel data, **When** the data is cloned, **Then** the clone is an independent copy — modifications to the clone do not affect the original.

---

### User Story 2 - Work with Validated Colors (Priority: P1)

A texture creator picks colors to paint with. Each color must be a valid RGBA value (0-255 per channel). Invalid colors must never enter the system.

**Why this priority**: Colors are the core value unit of a pixel editor. Every other feature (layers, blending, palettes) depends on a trustworthy color representation.

**Independent Test**: Can be tested by constructing colors with valid and invalid channel values and verifying that only valid colors are accepted.

**Acceptance Scenarios**:

1. **Given** valid RGBA values (each 0-255), **When** a color is created, **Then** it is accepted and stores the exact values.
2. **Given** the color type, **When** a caller attempts to provide a channel value outside 0-255, **Then** the type system prevents it at compile time — invalid colors are unrepresentable.
3. **Given** two colors with identical RGBA values, **When** compared, **Then** they are considered equal.

---

### User Story 3 - Organize Work in Layers (Priority: P1)

A texture creator organizes their work into named layers (e.g., "base", "shading", "details"). Each layer has its own pixel buffer and can be toggled visible/invisible, locked to prevent edits, and assigned an opacity and blend mode.

**Why this priority**: Layers are essential for non-destructive texture editing. Without them, the editor is limited to flat single-surface editing.

**Independent Test**: Can be tested by creating layers with different properties (name, opacity, visibility, lock state) and verifying each property is correctly stored and modifiable.

**Acceptance Scenarios**:

1. **Given** a new layer is created with a name, dimensions, and default properties, **When** inspected, **Then** it has the given name, full opacity, Normal blend mode, is visible, and is unlocked.
2. **Given** a layer, **When** its visibility is toggled off, **Then** it reports as not visible.
3. **Given** a locked layer, **When** a pixel write is attempted, **Then** the operation is rejected.
4. **Given** a layer with an opacity of 50%, **When** inspected, **Then** the opacity value is correctly stored and retrievable.

---

### User Story 4 - Composite Layers with Blend Modes (Priority: P2)

A texture creator stacks multiple layers and previews the flattened result. Layers are composited from bottom to top, respecting each layer's opacity, visibility, and blend mode. Supported blend modes are: Normal, Multiply, Screen, and Overlay.

**Why this priority**: Layer compositing is what makes the multi-layer workflow useful. Without flattening, the user cannot see the combined result of their layers. Ranked P2 because it depends on layers and pixel buffers being functional first.

**Independent Test**: Can be tested by creating a stack with known layer colors, opacities, and blend modes, compositing, and comparing the result pixel-by-pixel against expected values.

**Acceptance Scenarios**:

1. **Given** a stack with a single visible layer, **When** composited, **Then** the result is identical to that layer's pixel data (adjusted for opacity).
2. **Given** a stack with two layers using Normal blend mode, **When** composited, **Then** the top layer's pixels are blended over the bottom layer's pixels respecting the top layer's opacity.
3. **Given** a stack where one layer is hidden, **When** composited, **Then** the hidden layer does not contribute to the result.
4. **Given** two layers with Multiply blend mode on the top layer, **When** composited, **Then** each resulting pixel's channels are the product of the corresponding channels of the two layers (normalized to 0-255), adjusted for opacity.
5. **Given** two layers with Screen blend mode, **When** composited, **Then** each resulting pixel follows the Screen formula: result = 1 - (1 - base) * (1 - top), adjusted for opacity.
6. **Given** two layers with Overlay blend mode, **When** composited, **Then** each resulting pixel follows the Overlay formula (Multiply when base < 0.5, Screen when base >= 0.5), adjusted for opacity.

---

### User Story 5 - Manage a Texture Document (Priority: P2)

A texture creator works on a texture that has a namespace (e.g., "minecraft"), a resource path (e.g., "textures/block/stone.png"), and a stack of layers. The system tracks whether the texture has unsaved modifications (dirty flag).

**Why this priority**: The Texture document model ties together layers and metadata, providing the structure needed for project management and save/export workflows.

**Independent Test**: Can be tested by creating a texture with metadata, modifying it, and verifying the dirty flag transitions correctly.

**Acceptance Scenarios**:

1. **Given** a new texture is created with a namespace and path, **When** inspected, **Then** it reports the correct namespace, path, and is not dirty.
2. **Given** a clean texture, **When** a modification is made (e.g., a pixel changed in a layer), **Then** the texture reports as dirty.
3. **Given** a dirty texture, **When** it is marked as saved, **Then** it reports as not dirty.

---

### User Story 6 - Define I/O Boundaries (Priority: P3)

The system defines clear contracts (ports) for reading images, writing images, and scanning resource packs. These contracts specify WHAT data flows in and out without dictating HOW the I/O is performed.

**Why this priority**: Ports decouple the domain from infrastructure, enabling testability and future adapter implementations. Ranked P3 because the domain logic is fully functional without concrete adapters.

**Independent Test**: Can be tested by verifying that the port contracts are defined and can be implemented by mock adapters in tests.

**Acceptance Scenarios**:

1. **Given** an image reader port, **When** implemented by a test double, **Then** it can provide pixel data to the domain without any dependency on file formats.
2. **Given** an image writer port, **When** implemented by a test double, **Then** it can receive pixel data from the domain for persistence.
3. **Given** a pack scanner port, **When** implemented by a test double, **Then** it can provide a list of texture entries from a resource pack.

---

### Edge Cases

- What happens when a pixel buffer is created with zero width or zero height? The creation must be rejected.
- What happens when compositing an empty layer stack (no layers)? The result must be a fully transparent pixel buffer.
- What happens when all layers in a stack are hidden? The composite result must be fully transparent.
- What happens when blending with a fully transparent top pixel? The base pixel must remain unchanged regardless of blend mode.
- What happens when a layer's opacity is set to 0%? It must not contribute to the composite, equivalent to being hidden.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store pixel data as RGBA (4 channels, 0-255 each) for a given width and height.
- **FR-002**: System MUST allow reading and writing individual pixels by (x, y) coordinate, rejecting out-of-bounds access.
- **FR-003**: System MUST support filling a rectangular region of pixels with a single color.
- **FR-004**: System MUST support cloning pixel data into an independent copy.
- **FR-005**: System MUST ensure color values are constrained to 0-255 per channel (R, G, B, A) — invalid values MUST be unrepresentable by design.
- **FR-006**: System MUST support blend modes: Normal, Multiply, Screen, and Overlay.
- **FR-007**: System MUST blend two colors given a blend mode and an opacity value (0.0 to 1.0), producing a valid output color.
- **FR-008**: System MUST represent a layer with: unique identifier, name, pixel buffer, opacity (0.0-1.0), blend mode, visibility flag, and lock flag.
- **FR-009**: System MUST reject pixel writes to a locked layer.
- **FR-010**: System MUST maintain an ordered stack of layers and composite them bottom-to-top into a single flattened pixel buffer.
- **FR-011**: Hidden layers and layers with 0% opacity MUST NOT contribute to the composite result.
- **FR-012**: System MUST represent a texture document with: namespace, resource path, width, height, layer stack, and dirty flag.
- **FR-013**: The dirty flag MUST transition to true on any modification and back to false when explicitly marked as saved. Dirty tracking is caller-managed — the orchestration layer is responsible for marking the texture dirty after mutations, not the domain types themselves.
- **FR-014**: System MUST define port contracts for image reading, image writing, and resource pack scanning — specifying data inputs/outputs without implementation.
- **FR-015**: All domain types MUST be testable in complete isolation, with zero dependencies on external libraries or I/O.

### Key Entities

- **PixelBuffer** (referred to as "canvas" in user stories): A rectangular grid of RGBA pixels with defined width and height. Supports per-pixel and region-based operations.
- **Color**: An immutable RGBA value object. Validates channel ranges at construction. Supports equality comparison.
- **BlendMode**: A mode that determines how two colors are combined (Normal, Multiply, Screen, Overlay).
- **Layer**: A named editing surface containing a pixel buffer, with opacity, blend mode, visibility, and lock state. Identified by a unique ID.
- **LayerStack**: An ordered collection of layers. Composites all visible layers into a single flattened pixel buffer.
- **Texture**: The top-level document model. Owns canvas dimensions (width, height), links a layer stack with resource metadata (namespace, path), and tracks modification state. All layers share the texture's dimensions.
- **ImageReader (port)**: Contract for loading pixel data from an external source.
- **ImageWriter (port)**: Contract for persisting pixel data to an external destination.
- **PackScanner (port)**: Contract for enumerating texture entries within a resource pack.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All pixel read/write operations on valid coordinates return correct values with 100% accuracy.
- **SC-002**: All invalid inputs (out-of-bounds coordinates, invalid color channels, zero-dimension buffers) are rejected before any state mutation occurs.
- **SC-003**: Layer compositing produces pixel-perfect results matching the mathematical definitions of each blend mode for all test cases.
- **SC-004**: All domain types can be instantiated and tested without importing or depending on any external library or I/O system.
- **SC-005**: 100% of functional requirements (FR-001 through FR-015) are covered by automated tests.
- **SC-006**: A locked layer rejects 100% of modification attempts without data corruption.

## Assumptions

- Pixel channel values use 8-bit unsigned integers (0-255). Higher bit depths are out of scope.
- Layer compositing uses standard alpha compositing (Porter-Duff "source over") as the foundation for all blend modes.
- The blend mode set (Normal, Multiply, Screen, Overlay) is fixed for this feature. Additional blend modes may be added in future iterations.
- Unique layer identifiers are provided to the domain at construction time (generated by outer layers using UUID). The domain stores and compares IDs but does not generate them.
- The port contracts define trait signatures only — concrete implementations (PNG reading, ZIP scanning, etc.) are out of scope for this feature.
- This feature depends on #1 (project scaffolding) being complete.
- Texture dimensions relevant to Minecraft are small (typically 16x16 to 512x512), so performance optimization for very large canvases is not a concern at this stage.
