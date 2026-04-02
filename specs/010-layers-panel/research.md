# Research: Layers Panel

**Feature**: 010-layers-panel | **Date**: 2026-04-01

## 1. Drag-and-Drop Library

**Decision**: @dnd-kit/core + @dnd-kit/sortable

**Rationale**:
- Purpose-built for sortable lists in React, which is exactly the layer reorder use case.
- Lightweight: ~15KB gzipped for core + sortable. Smallest viable option with proper DX.
- Actively maintained (2024+), good TypeScript support.
- Built-in visual feedback (drag overlay, sort animations) satisfies US4-AS2 ("visual indicator shows where the layer will be inserted").
- Keyboard-accessible drag/drop out of the box.

**Alternatives considered**:
- **Native HTML5 DnD API**: No extra dependency, but requires significantly more code for drag previews, insertion indicators, and accessible keyboard reorder. Poor DX for a sortable list.
- **@hello-pangea/dnd** (react-beautiful-dnd fork): ~30KB gzipped, heavier than needed. Maintained but more opinionated and larger.
- **No library (pointer events + manual reorder)**: Maximum control but ~200+ lines of custom logic for a well-solved problem. Violates Simplicity principle.

## 2. Layer Thumbnail Strategy

**Decision**: Include raw RGBA data directly in `LayerInfoDto` via a `thumbnail` field (`Vec<u8>` / `number[]`).

**Rationale**:
- Minecraft textures are 16x16 to 64x64. Raw RGBA data per layer:
  - 16x16 = 1,024 bytes (1KB)
  - 32x32 = 4,096 bytes (4KB)
  - 64x64 = 16,384 bytes (16KB)
- For 50 layers at 16x16: ~50KB total per state update. Negligible for desktop IPC.
- Eliminates need for a separate `get_layer_thumbnails` command and caching logic.
- The frontend renders thumbnails by creating an `ImageData` from the RGBA array and drawing to a small `<canvas>` element.
- Width/height come from `TextureMetadataDto` (all layers share texture dimensions).

**Alternatives considered**:
- **Separate `get_layer_thumbnails` command**: More efficient for large textures but adds complexity (cache invalidation, extra IPC). Over-engineering for Minecraft texture sizes.
- **Base64 PNG encoding per layer**: Requires `image` crate in the DTO path or a separate encoding step. More bytes on the wire than raw RGBA for small images. Unnecessary.
- **Frontend-only thumbnails from composite**: Not viable -- composite is the flattened result, not per-layer data.

## 3. Layer List Rendering

**Decision**: Simple `div` list with @dnd-kit `SortableContext`. No virtualization.

**Rationale**:
- SC-007 requires responsiveness with up to 50 layers.
- 50 DOM nodes with simple content (icon + thumbnail canvas + text + opacity) is well within browser performance.
- React 19 handles list re-renders efficiently.
- Virtualization (@tanstack/virtual or react-window) adds complexity with no measurable benefit at this scale.

**Alternatives considered**:
- **@tanstack/react-virtual**: Would add ~3KB for zero perceptible gain at <=50 items. Complicates @dnd-kit integration.

## 4. Inline Rename Pattern

**Decision**: Controlled `<input>` element that replaces the name text on double-click or F2.

**Rationale**:
- React's controlled input pattern provides clean state management and event handling.
- `onKeyDown` handles Enter (confirm) and Escape (cancel).
- `onBlur` confirms the rename (spec US5-AS5).
- Input is pre-filled with current name and auto-selected on mount.
- Validation: empty names rejected client-side (no IPC call), backend also validates via `DomainError::EmptyName`.

**Alternatives considered**:
- **`contentEditable` on the name span**: Inconsistent browser behavior for selection, blur events, and IME input. Harder to control.
- **Modal/dialog**: Violates the spec's "inline text field" requirement.

## 5. Backend Gaps Analysis

The following backend additions are needed (the existing layer commands cover most of the spec):

| Gap | Needed for | Solution |
|-----|-----------|----------|
| No `duplicate_layer` | FR-008, US2-AS3 | Add `Layer::duplicate()` (domain), `EditorService::duplicate_layer()` (use_cases), Tauri command (commands) |
| `add_layer` appends to top | US2-AS1 wants "above active" | Add `LayerStack::insert_layer(index, layer)` + `EditorService::add_layer_above()`, modify command to use active layer position |
| No `index_of` on LayerStack | Needed by duplicate and add-above | Add `LayerStack::index_of(id) -> Option<usize>` |
| No thumbnail in DTO | FR-003 (thumbnail preview) | Add `thumbnail: Vec<u8>` to `LayerInfoDto`, populate from `layer.buffer().clone_data()` |
| Min-one-layer guard | FR-007, US2-AS4 | Enforce in `remove_layer` command: reject if `layer_stack.len() == 1` |

## 6. UI Design Reference

The `.pen` design file (`ui-design`, component `Panel-Layers`) specifies:

- **Panel background**: `#252525` (= `colors.panelBody`)
- **Header**: 28px, `#2A2A2A` (= `colors.panelHeader`), grip icon + "Layers" title
- **Layer row**: 30px height, 4px radius. Active: `#3A3A3A` (= `colors.selectedItem`). Inactive: transparent.
- **Row contents**: eye icon (12px, accent blue when visible), 18x18 thumbnail, name (10px Inter), opacity % (8px Geist Mono, `#888888`)
- **Blend mode section**: 28px, `#2A2A2A` background. Label "Blend" + dropdown (`#333333`, chevron-down icon)
- **Action bar**: 28px, 3 buttons (24x24, `#333333` bg, 4px radius): plus, trash-2, copy icons (lucide)
- **Icons**: All from lucide-react (already installed): `Eye`, `EyeOff`, `Plus`, `Trash2`, `Copy`, `ChevronDown`, `GripHorizontal`
