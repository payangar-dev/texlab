use crate::domain::blend::BlendMode;
use crate::domain::color::Color;
use crate::domain::error::DomainError;
use crate::domain::layer::{Layer, LayerId};
use crate::domain::pixel_buffer::PixelBuffer;
use crate::domain::ports::ImageWriter;
use crate::domain::texture::Texture;
use crate::domain::tools::{BrushSize, Tool, ToolContext, ToolResult};
use crate::domain::undo::{OperationType, TextureSnapshot, UndoEntry, UndoManager};

const DEFAULT_MAX_HISTORY: usize = 100;

enum ToolPhase {
    Press,
    Drag,
    Release,
}

/// Orchestrates all undoable operations on a texture.
pub struct EditorService {
    texture: Texture,
    undo_manager: UndoManager,
    pending_snapshot: Option<TextureSnapshot>,
    pixels_modified_in_cycle: bool,
}

impl EditorService {
    pub fn new(texture: Texture) -> Self {
        Self::with_max_history(texture, DEFAULT_MAX_HISTORY)
    }

    pub fn with_max_history(texture: Texture, max_depth: usize) -> Self {
        Self {
            texture,
            undo_manager: UndoManager::new(max_depth),
            pending_snapshot: None,
            pixels_modified_in_cycle: false,
        }
    }

    pub fn texture(&self) -> &Texture {
        &self.texture
    }

    /// Direct mutation access WITHOUT undo tracking.
    /// Callers are responsible for capturing a snapshot before mutating if undo is required.
    pub(crate) fn texture_mut(&mut self) -> &mut Texture {
        &mut self.texture
    }

    pub fn can_undo(&self) -> bool {
        self.undo_manager.can_undo()
    }

    pub fn can_redo(&self) -> bool {
        self.undo_manager.can_redo()
    }

    // -- Factory methods --

    /// Creates an editor from an existing pixel buffer (e.g., loaded from a PNG file).
    /// The texture starts clean (not dirty).
    pub fn from_pixel_buffer(
        buffer: &PixelBuffer,
        namespace: String,
        path: String,
        layer_id: LayerId,
    ) -> Result<Self, DomainError> {
        let width = buffer.width();
        let height = buffer.height();
        let mut texture = Texture::new(namespace, path, width, height)?;
        texture.add_layer(layer_id, "Background".to_string())?;
        let layer = texture.layer_stack_mut().get_layer_mut(layer_id).ok_or(
            DomainError::LayerNotFound {
                layer_id: layer_id.value(),
            },
        )?;
        for y in 0..height {
            for x in 0..width {
                let color = buffer.get_pixel(x, y)?;
                layer.set_pixel(x, y, color)?;
            }
        }
        texture.mark_saved();
        Ok(Self::new(texture))
    }

    /// Creates an editor with a blank texture and one transparent layer.
    /// The texture starts clean (not dirty).
    pub fn new_blank(
        namespace: String,
        path: String,
        width: u32,
        height: u32,
        layer_id: LayerId,
    ) -> Result<Self, DomainError> {
        let mut texture = Texture::new(namespace, path, width, height)?;
        texture.add_layer(layer_id, "Layer 1".to_string())?;
        texture.mark_saved();
        Ok(Self::new(texture))
    }

    /// Composites all visible layers, writes the result via the provided writer,
    /// and marks the texture as saved.
    pub fn save_composite(
        &mut self,
        writer: &dyn ImageWriter,
        path: &str,
    ) -> Result<(), DomainError> {
        let composite = self.texture.composite()?;
        writer.write(path, &composite)?;
        self.texture.mark_saved();
        Ok(())
    }

    /// Composites all visible layers and returns the color at (x, y).
    pub fn pick_color_composite(&self, x: u32, y: u32) -> Result<Color, DomainError> {
        let composite = self.texture.composite()?;
        composite.get_pixel(x, y)
    }

    // -- Tool operations --

    #[allow(clippy::too_many_arguments)]
    fn run_tool(
        &mut self,
        tool: &mut dyn Tool,
        phase: ToolPhase,
        layer_id: LayerId,
        x: u32,
        y: u32,
        color: Color,
        brush_size: BrushSize,
        opacity: f32,
    ) -> Result<ToolResult, DomainError> {
        let layer = self
            .texture
            .layer_stack_mut()
            .get_layer_mut(layer_id)
            .ok_or(DomainError::LayerNotFound {
                layer_id: layer_id.value(),
            })?;
        let buffer = layer.buffer_mut()?;
        let mut ctx = ToolContext::new(buffer, color, brush_size, opacity);
        let result = match phase {
            ToolPhase::Press => tool.on_press(&mut ctx, x, y)?,
            ToolPhase::Drag => tool.on_drag(&mut ctx, x, y)?,
            ToolPhase::Release => tool.on_release(&mut ctx, x, y)?,
        };
        if result == ToolResult::PixelsModified {
            self.pixels_modified_in_cycle = true;
            self.texture.mark_dirty();
        }
        Ok(result)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn apply_tool_press(
        &mut self,
        tool: &mut dyn Tool,
        layer_id: LayerId,
        x: u32,
        y: u32,
        color: Color,
        brush_size: BrushSize,
        opacity: f32,
    ) -> Result<ToolResult, DomainError> {
        self.pending_snapshot = Some(TextureSnapshot::capture(self.texture.layer_stack()));
        self.pixels_modified_in_cycle = false;
        self.run_tool(
            tool,
            ToolPhase::Press,
            layer_id,
            x,
            y,
            color,
            brush_size,
            opacity,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn apply_tool_drag(
        &mut self,
        tool: &mut dyn Tool,
        layer_id: LayerId,
        x: u32,
        y: u32,
        color: Color,
        brush_size: BrushSize,
        opacity: f32,
    ) -> Result<ToolResult, DomainError> {
        self.run_tool(
            tool,
            ToolPhase::Drag,
            layer_id,
            x,
            y,
            color,
            brush_size,
            opacity,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn apply_tool_release(
        &mut self,
        tool: &mut dyn Tool,
        layer_id: LayerId,
        x: u32,
        y: u32,
        color: Color,
        brush_size: BrushSize,
        opacity: f32,
    ) -> Result<ToolResult, DomainError> {
        let result = self.run_tool(
            tool,
            ToolPhase::Release,
            layer_id,
            x,
            y,
            color,
            brush_size,
            opacity,
        )?;
        if self.pixels_modified_in_cycle {
            if let Some(snapshot) = self.pending_snapshot.take() {
                self.undo_manager
                    .push(UndoEntry::new(OperationType::Draw, snapshot));
            }
        } else {
            self.pending_snapshot = None;
        }
        Ok(result)
    }

    // -- Undo/Redo --

    /// Generic undo/redo swap: pops an entry from one stack, captures the current
    /// state as the reverse entry, restores the popped snapshot, then pushes the
    /// captured state onto the opposite stack.
    fn apply_history_swap(
        &mut self,
        pop: fn(&mut UndoManager) -> Option<UndoEntry>,
        push: fn(&mut UndoManager, UndoEntry),
    ) -> Result<(), DomainError> {
        let entry = pop(&mut self.undo_manager).ok_or(DomainError::EmptyHistory)?;
        let (operation, snapshot) = entry.into_parts();
        let current = TextureSnapshot::capture(self.texture.layer_stack());
        self.texture
            .layer_stack_mut()
            .restore_from_snapshots(snapshot)?;
        push(&mut self.undo_manager, UndoEntry::new(operation, current));
        self.texture.mark_dirty();
        Ok(())
    }

    pub fn undo(&mut self) -> Result<(), DomainError> {
        self.apply_history_swap(UndoManager::pop_undo, UndoManager::push_redo)
    }

    pub fn redo(&mut self) -> Result<(), DomainError> {
        self.apply_history_swap(UndoManager::pop_redo, UndoManager::push_undo)
    }

    // -- Layer operations --

    pub fn add_layer(&mut self, id: LayerId, name: &str) -> Result<(), DomainError> {
        let snapshot = TextureSnapshot::capture(self.texture.layer_stack());
        self.texture.add_layer(id, name.to_string())?;
        self.undo_manager
            .push(UndoEntry::new(OperationType::LayerAdd, snapshot));
        Ok(())
    }

    pub fn add_layer_above(
        &mut self,
        id: LayerId,
        name: &str,
        above_id: Option<LayerId>,
    ) -> Result<(), DomainError> {
        let layer = Layer::new(
            id,
            name.to_string(),
            self.texture.width(),
            self.texture.height(),
        )?;
        // Snapshot after validation to avoid unnecessary allocation on failure
        let snapshot = TextureSnapshot::capture(self.texture.layer_stack());
        match above_id {
            Some(ref_id) => {
                let index = self.texture.layer_stack().index_of(ref_id).ok_or(
                    DomainError::LayerNotFound {
                        layer_id: ref_id.value(),
                    },
                )?;
                self.texture
                    .layer_stack_mut()
                    .insert_layer(index + 1, layer)?;
            }
            None => {
                self.texture.layer_stack_mut().add_layer(layer);
            }
        }
        self.texture.mark_dirty();
        self.undo_manager
            .push(UndoEntry::new(OperationType::LayerAdd, snapshot));
        Ok(())
    }

    pub fn duplicate_layer(
        &mut self,
        source_id: LayerId,
        new_id: LayerId,
    ) -> Result<(), DomainError> {
        let index =
            self.texture
                .layer_stack()
                .index_of(source_id)
                .ok_or(DomainError::LayerNotFound {
                    layer_id: source_id.value(),
                })?;
        let duplicate = self.texture.layer_stack().layers()[index].duplicate(new_id)?;
        // Snapshot after validation to avoid unnecessary allocation on failure
        let snapshot = TextureSnapshot::capture(self.texture.layer_stack());
        self.texture
            .layer_stack_mut()
            .insert_layer(index + 1, duplicate)?;
        self.texture.mark_dirty();
        self.undo_manager
            .push(UndoEntry::new(OperationType::LayerAdd, snapshot));
        Ok(())
    }

    pub fn remove_layer(&mut self, id: LayerId) -> Result<(), DomainError> {
        let snapshot = TextureSnapshot::capture(self.texture.layer_stack());
        self.texture.layer_stack_mut().remove_layer(id)?;
        self.texture.mark_dirty();
        self.undo_manager
            .push(UndoEntry::new(OperationType::LayerRemove, snapshot));
        Ok(())
    }

    pub fn move_layer(&mut self, from_index: usize, to_index: usize) -> Result<(), DomainError> {
        let snapshot = TextureSnapshot::capture(self.texture.layer_stack());
        self.texture
            .layer_stack_mut()
            .move_layer(from_index, to_index)?;
        self.texture.mark_dirty();
        self.undo_manager
            .push(UndoEntry::new(OperationType::LayerReorder, snapshot));
        Ok(())
    }

    fn with_layer_undo(
        &mut self,
        id: LayerId,
        op: OperationType,
        f: impl FnOnce(&mut Layer) -> Result<(), DomainError>,
    ) -> Result<(), DomainError> {
        let snapshot = TextureSnapshot::capture(self.texture.layer_stack());
        let layer =
            self.texture
                .layer_stack_mut()
                .get_layer_mut(id)
                .ok_or(DomainError::LayerNotFound {
                    layer_id: id.value(),
                })?;
        f(layer)?;
        self.texture.mark_dirty();
        self.undo_manager.push(UndoEntry::new(op, snapshot));
        Ok(())
    }

    pub fn set_layer_opacity(&mut self, id: LayerId, opacity: f32) -> Result<(), DomainError> {
        self.with_layer_undo(id, OperationType::LayerPropertyChange, |layer| {
            layer.set_opacity(opacity);
            Ok(())
        })
    }

    pub fn set_layer_blend_mode(
        &mut self,
        id: LayerId,
        mode: BlendMode,
    ) -> Result<(), DomainError> {
        self.with_layer_undo(id, OperationType::LayerPropertyChange, |layer| {
            layer.set_blend_mode(mode);
            Ok(())
        })
    }

    pub fn set_layer_visibility(&mut self, id: LayerId, visible: bool) -> Result<(), DomainError> {
        self.with_layer_undo(id, OperationType::LayerPropertyChange, |layer| {
            layer.set_visible(visible);
            Ok(())
        })
    }

    pub fn set_layer_name(&mut self, id: LayerId, name: &str) -> Result<(), DomainError> {
        let name = name.to_string();
        self.with_layer_undo(id, OperationType::LayerPropertyChange, move |layer| {
            layer.set_name(name)
        })
    }

    pub fn set_layer_locked(&mut self, id: LayerId, locked: bool) -> Result<(), DomainError> {
        self.with_layer_undo(id, OperationType::LayerPropertyChange, |layer| {
            layer.set_locked(locked);
            Ok(())
        })
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use crate::domain::tools::{
        BrushTool, ColorPickerTool, EraserTool, FillTool, LineTool, SelectionTool,
    };

    fn test_texture() -> Texture {
        Texture::new("minecraft".into(), "textures/block/stone.png".into(), 4, 4).unwrap()
    }

    fn test_service() -> EditorService {
        let mut tex = test_texture();
        tex.add_layer(LayerId::new(1), "base".to_string()).unwrap();
        EditorService::new(tex)
    }

    fn brush_stroke(
        svc: &mut EditorService,
        tool: &mut BrushTool,
        layer_id: LayerId,
        x: u32,
        y: u32,
        color: Color,
    ) {
        svc.apply_tool_press(tool, layer_id, x, y, color, BrushSize::DEFAULT, 1.0)
            .unwrap();
        svc.apply_tool_release(tool, layer_id, x, y, color, BrushSize::DEFAULT, 1.0)
            .unwrap();
    }

    fn get_pixel(svc: &EditorService, layer_id: LayerId, x: u32, y: u32) -> Color {
        svc.texture()
            .layer_stack()
            .get_layer(layer_id)
            .unwrap()
            .buffer()
            .get_pixel(x, y)
            .unwrap()
    }

    fn get_layer_data(svc: &EditorService, layer_id: LayerId) -> Vec<u8> {
        svc.texture()
            .layer_stack()
            .get_layer(layer_id)
            .unwrap()
            .buffer()
            .clone_data()
    }

    // === US1: Undo a Drawing Mistake (T013) ===

    #[test]
    fn single_brush_stroke_undo_reverts_pixels() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let red = Color::new(255, 0, 0, 255);
        let mut tool = BrushTool::default();

        assert_eq!(get_pixel(&svc, id, 0, 0), Color::TRANSPARENT);

        brush_stroke(&mut svc, &mut tool, id, 0, 0, red);
        assert_eq!(get_pixel(&svc, id, 0, 0), red);

        svc.undo().unwrap();
        assert_eq!(get_pixel(&svc, id, 0, 0), Color::TRANSPARENT);
    }

    #[test]
    fn multiple_operations_sequential_undo_in_reverse_order() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let red = Color::new(255, 0, 0, 255);
        let blue = Color::new(0, 0, 255, 255);
        let mut tool = BrushTool::default();

        brush_stroke(&mut svc, &mut tool, id, 0, 0, red);
        brush_stroke(&mut svc, &mut tool, id, 1, 1, blue);

        svc.undo().unwrap();
        assert_eq!(get_pixel(&svc, id, 0, 0), red);
        assert_eq!(get_pixel(&svc, id, 1, 1), Color::TRANSPARENT);

        svc.undo().unwrap();
        assert_eq!(get_pixel(&svc, id, 0, 0), Color::TRANSPARENT);
    }

    #[test]
    fn undo_all_back_to_initial_state() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let mut tool = BrushTool::default();

        let initial = get_layer_data(&svc, id);

        brush_stroke(&mut svc, &mut tool, id, 0, 0, Color::WHITE);
        brush_stroke(&mut svc, &mut tool, id, 1, 1, Color::BLACK);
        brush_stroke(&mut svc, &mut tool, id, 2, 2, Color::new(255, 0, 0, 255));

        svc.undo().unwrap();
        svc.undo().unwrap();
        svc.undo().unwrap();

        assert_eq!(initial, get_layer_data(&svc, id));
    }

    #[test]
    fn undo_on_empty_history_returns_error() {
        let mut svc = test_service();
        assert_eq!(svc.undo().unwrap_err(), DomainError::EmptyHistory);
    }

    #[test]
    fn color_picker_does_not_create_undo_entry() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let mut tool = ColorPickerTool;

        svc.apply_tool_press(
            &mut tool,
            id,
            0,
            0,
            Color::TRANSPARENT,
            BrushSize::DEFAULT,
            1.0,
        )
        .unwrap();
        svc.apply_tool_release(
            &mut tool,
            id,
            0,
            0,
            Color::TRANSPARENT,
            BrushSize::DEFAULT,
            1.0,
        )
        .unwrap();

        assert!(!svc.can_undo());
    }

    #[test]
    fn selection_tool_does_not_create_undo_entry() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let mut tool = SelectionTool::default();

        svc.apply_tool_press(
            &mut tool,
            id,
            0,
            0,
            Color::TRANSPARENT,
            BrushSize::DEFAULT,
            1.0,
        )
        .unwrap();
        svc.apply_tool_release(
            &mut tool,
            id,
            0,
            0,
            Color::TRANSPARENT,
            BrushSize::DEFAULT,
            1.0,
        )
        .unwrap();

        assert!(!svc.can_undo());
    }

    #[test]
    fn undo_restores_exact_pixel_state() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let mut tool = BrushTool::default();

        brush_stroke(&mut svc, &mut tool, id, 2, 3, Color::new(42, 84, 168, 200));
        let post_stroke = get_layer_data(&svc, id);

        brush_stroke(&mut svc, &mut tool, id, 0, 0, Color::WHITE);
        svc.undo().unwrap();

        assert_eq!(post_stroke, get_layer_data(&svc, id));
    }

    #[test]
    fn eraser_tool_creates_undo_entry() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let mut brush = BrushTool::default();
        let mut eraser = EraserTool::default();

        brush_stroke(&mut svc, &mut brush, id, 0, 0, Color::WHITE);

        svc.apply_tool_press(
            &mut eraser,
            id,
            0,
            0,
            Color::TRANSPARENT,
            BrushSize::DEFAULT,
            1.0,
        )
        .unwrap();
        svc.apply_tool_release(
            &mut eraser,
            id,
            0,
            0,
            Color::TRANSPARENT,
            BrushSize::DEFAULT,
            1.0,
        )
        .unwrap();

        assert_eq!(get_pixel(&svc, id, 0, 0), Color::TRANSPARENT);
        svc.undo().unwrap();
        assert_eq!(get_pixel(&svc, id, 0, 0), Color::WHITE);
    }

    #[test]
    fn fill_tool_creates_undo_entry() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let mut tool = FillTool;

        svc.apply_tool_press(&mut tool, id, 0, 0, Color::WHITE, BrushSize::DEFAULT, 1.0)
            .unwrap();
        svc.apply_tool_release(&mut tool, id, 0, 0, Color::WHITE, BrushSize::DEFAULT, 1.0)
            .unwrap();

        assert!(svc.can_undo());
        svc.undo().unwrap();
        assert_eq!(get_pixel(&svc, id, 0, 0), Color::TRANSPARENT);
    }

    #[test]
    fn line_tool_creates_undo_entry() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let mut tool = LineTool::default();

        svc.apply_tool_press(&mut tool, id, 0, 0, Color::WHITE, BrushSize::DEFAULT, 1.0)
            .unwrap();
        svc.apply_tool_release(&mut tool, id, 3, 3, Color::WHITE, BrushSize::DEFAULT, 1.0)
            .unwrap();

        assert!(svc.can_undo());
        svc.undo().unwrap();
        assert_eq!(get_pixel(&svc, id, 0, 0), Color::TRANSPARENT);
    }

    #[test]
    fn drag_modifying_pixels_creates_undo_entry() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let red = Color::new(255, 0, 0, 255);
        let mut tool = BrushTool::default();

        svc.apply_tool_press(&mut tool, id, 0, 0, red, BrushSize::DEFAULT, 1.0)
            .unwrap();
        svc.apply_tool_drag(&mut tool, id, 2, 2, red, BrushSize::DEFAULT, 1.0)
            .unwrap();
        svc.apply_tool_release(&mut tool, id, 2, 2, red, BrushSize::DEFAULT, 1.0)
            .unwrap();

        assert!(svc.can_undo());
        svc.undo().unwrap();
        assert_eq!(get_pixel(&svc, id, 0, 0), Color::TRANSPARENT);
        assert_eq!(get_pixel(&svc, id, 2, 2), Color::TRANSPARENT);
    }

    #[test]
    fn tool_press_on_missing_layer_returns_error() {
        let mut svc = test_service();
        let missing = LayerId::new(999);
        let mut tool = BrushTool::default();

        let err = svc
            .apply_tool_press(
                &mut tool,
                missing,
                0,
                0,
                Color::WHITE,
                BrushSize::DEFAULT,
                1.0,
            )
            .unwrap_err();
        assert_eq!(err, DomainError::LayerNotFound { layer_id: 999 });
    }

    // === Pipette composite sampling ===

    #[test]
    fn pick_color_composite_returns_blended_color() {
        let mut tex = test_texture();
        let id1 = LayerId::new(1);
        let id2 = LayerId::new(2);
        tex.add_layer(id1, "bottom".to_string()).unwrap();
        tex.add_layer(id2, "top".to_string()).unwrap();

        let mut svc = EditorService::new(tex);

        // Paint red on bottom layer
        let red = Color::new(255, 0, 0, 255);
        let mut tool = BrushTool::default();
        brush_stroke(&mut svc, &mut tool, id1, 0, 0, red);

        // Paint green on top layer
        let green = Color::new(0, 255, 0, 255);
        brush_stroke(&mut svc, &mut tool, id2, 0, 0, green);

        // Composite should show the top layer color (fully opaque green over red)
        let picked = svc.pick_color_composite(0, 0).unwrap();
        assert_eq!(
            picked, green,
            "composite should return top layer color when fully opaque"
        );
    }

    #[test]
    fn pick_color_composite_out_of_bounds_returns_error() {
        let svc = test_service();
        let result = svc.pick_color_composite(100, 100);
        assert!(result.is_err(), "out of bounds should return error");
    }

    // === US2: Redo a Reverted Action (T015) ===

    #[test]
    fn single_undo_redo_restores() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let mut tool = BrushTool::default();

        brush_stroke(&mut svc, &mut tool, id, 0, 0, Color::new(255, 0, 0, 255));
        let post_stroke = get_layer_data(&svc, id);

        svc.undo().unwrap();
        svc.redo().unwrap();

        assert_eq!(post_stroke, get_layer_data(&svc, id));
    }

    #[test]
    fn multiple_undo_multiple_redo_in_order() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let red = Color::new(255, 0, 0, 255);
        let blue = Color::new(0, 0, 255, 255);
        let green = Color::new(0, 255, 0, 255);
        let mut tool = BrushTool::default();

        brush_stroke(&mut svc, &mut tool, id, 0, 0, red);
        brush_stroke(&mut svc, &mut tool, id, 1, 1, blue);
        brush_stroke(&mut svc, &mut tool, id, 2, 2, green);

        svc.undo().unwrap();
        svc.undo().unwrap();
        svc.undo().unwrap();

        svc.redo().unwrap();
        assert_eq!(get_pixel(&svc, id, 0, 0), red);

        svc.redo().unwrap();
        assert_eq!(get_pixel(&svc, id, 1, 1), blue);

        svc.redo().unwrap();
        assert_eq!(get_pixel(&svc, id, 2, 2), green);
    }

    #[test]
    fn redo_on_empty_returns_error() {
        let mut svc = test_service();
        assert_eq!(svc.redo().unwrap_err(), DomainError::EmptyHistory);
    }

    #[test]
    fn new_operation_after_undo_clears_redo() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let mut tool = BrushTool::default();

        brush_stroke(&mut svc, &mut tool, id, 0, 0, Color::WHITE);
        brush_stroke(&mut svc, &mut tool, id, 1, 1, Color::BLACK);

        svc.undo().unwrap();
        assert!(svc.can_redo());

        brush_stroke(&mut svc, &mut tool, id, 2, 2, Color::new(255, 0, 0, 255));
        assert!(!svc.can_redo());
        assert_eq!(svc.redo().unwrap_err(), DomainError::EmptyHistory);
    }

    #[test]
    fn can_undo_can_redo_correct_at_all_times() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let mut tool = BrushTool::default();

        assert!(!svc.can_undo());
        assert!(!svc.can_redo());

        brush_stroke(&mut svc, &mut tool, id, 0, 0, Color::WHITE);
        assert!(svc.can_undo());
        assert!(!svc.can_redo());

        svc.undo().unwrap();
        assert!(!svc.can_undo());
        assert!(svc.can_redo());

        svc.redo().unwrap();
        assert!(svc.can_undo());
        assert!(!svc.can_redo());

        svc.undo().unwrap();
        brush_stroke(&mut svc, &mut tool, id, 1, 1, Color::BLACK);
        assert!(svc.can_undo());
        assert!(!svc.can_redo());
    }

    // === US3: Undo Layer Management Actions (T019) ===

    #[test]
    fn add_layer_undo_removes_it() {
        let mut svc = test_service();
        assert_eq!(svc.texture().layer_stack().len(), 1);

        svc.add_layer(LayerId::new(2), "second").unwrap();
        assert_eq!(svc.texture().layer_stack().len(), 2);

        svc.undo().unwrap();
        assert_eq!(svc.texture().layer_stack().len(), 1);
        assert!(svc
            .texture()
            .layer_stack()
            .get_layer(LayerId::new(2))
            .is_none());
    }

    #[test]
    fn remove_layer_undo_restores_with_content_and_properties() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let red = Color::new(255, 0, 0, 255);
        let mut tool = BrushTool::default();

        brush_stroke(&mut svc, &mut tool, id, 0, 0, red);
        svc.set_layer_opacity(id, 0.5).unwrap();
        svc.set_layer_blend_mode(id, BlendMode::Multiply).unwrap();

        let pre_remove = get_layer_data(&svc, id);

        svc.remove_layer(id).unwrap();
        assert!(svc.texture().layer_stack().is_empty());

        svc.undo().unwrap();
        assert_eq!(svc.texture().layer_stack().len(), 1);
        assert_eq!(get_layer_data(&svc, id), pre_remove);
        let layer = svc.texture().layer_stack().get_layer(id).unwrap();
        assert_eq!(layer.opacity(), 0.5);
        assert_eq!(layer.blend_mode(), BlendMode::Multiply);
    }

    #[test]
    fn reorder_layers_undo_reverts_order() {
        let mut svc = test_service();
        svc.add_layer(LayerId::new(2), "second").unwrap();
        svc.add_layer(LayerId::new(3), "third").unwrap();

        assert_eq!(svc.texture().layer_stack().layers()[0].name(), "base");
        assert_eq!(svc.texture().layer_stack().layers()[2].name(), "third");

        svc.move_layer(0, 2).unwrap();
        assert_eq!(svc.texture().layer_stack().layers()[0].name(), "second");
        assert_eq!(svc.texture().layer_stack().layers()[2].name(), "base");

        svc.undo().unwrap();
        assert_eq!(svc.texture().layer_stack().layers()[0].name(), "base");
        assert_eq!(svc.texture().layer_stack().layers()[2].name(), "third");
    }

    #[test]
    fn opacity_change_undo_reverts() {
        let mut svc = test_service();
        let id = LayerId::new(1);

        svc.set_layer_opacity(id, 0.3).unwrap();
        assert_eq!(
            svc.texture().layer_stack().get_layer(id).unwrap().opacity(),
            0.3
        );

        svc.undo().unwrap();
        assert_eq!(
            svc.texture().layer_stack().get_layer(id).unwrap().opacity(),
            1.0
        );
    }

    #[test]
    fn blend_mode_change_undo_reverts() {
        let mut svc = test_service();
        let id = LayerId::new(1);

        svc.set_layer_blend_mode(id, BlendMode::Screen).unwrap();
        svc.undo().unwrap();
        assert_eq!(
            svc.texture()
                .layer_stack()
                .get_layer(id)
                .unwrap()
                .blend_mode(),
            BlendMode::Normal
        );
    }

    #[test]
    fn visibility_change_undo_reverts() {
        let mut svc = test_service();
        let id = LayerId::new(1);

        svc.set_layer_visibility(id, false).unwrap();
        assert!(!svc
            .texture()
            .layer_stack()
            .get_layer(id)
            .unwrap()
            .is_visible());

        svc.undo().unwrap();
        assert!(svc
            .texture()
            .layer_stack()
            .get_layer(id)
            .unwrap()
            .is_visible());
    }

    #[test]
    fn name_change_undo_reverts() {
        let mut svc = test_service();
        let id = LayerId::new(1);

        svc.set_layer_name(id, "renamed").unwrap();
        assert_eq!(
            svc.texture().layer_stack().get_layer(id).unwrap().name(),
            "renamed"
        );

        svc.undo().unwrap();
        assert_eq!(
            svc.texture().layer_stack().get_layer(id).unwrap().name(),
            "base"
        );
    }

    #[test]
    fn locked_change_undo_reverts() {
        let mut svc = test_service();
        let id = LayerId::new(1);

        svc.set_layer_locked(id, true).unwrap();
        assert!(svc
            .texture()
            .layer_stack()
            .get_layer(id)
            .unwrap()
            .is_locked());

        svc.undo().unwrap();
        assert!(!svc
            .texture()
            .layer_stack()
            .get_layer(id)
            .unwrap()
            .is_locked());
    }

    #[test]
    fn same_property_three_times_produces_three_undo_steps() {
        let mut svc = test_service();
        let id = LayerId::new(1);

        svc.set_layer_opacity(id, 0.8).unwrap();
        svc.set_layer_opacity(id, 0.5).unwrap();
        svc.set_layer_opacity(id, 0.2).unwrap();

        svc.undo().unwrap();
        assert_eq!(
            svc.texture().layer_stack().get_layer(id).unwrap().opacity(),
            0.5
        );

        svc.undo().unwrap();
        assert_eq!(
            svc.texture().layer_stack().get_layer(id).unwrap().opacity(),
            0.8
        );

        svc.undo().unwrap();
        assert_eq!(
            svc.texture().layer_stack().get_layer(id).unwrap().opacity(),
            1.0
        );
    }

    #[test]
    fn undo_bypasses_layer_lock() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let mut tool = BrushTool::default();

        brush_stroke(&mut svc, &mut tool, id, 0, 0, Color::WHITE);
        svc.set_layer_locked(id, true).unwrap();

        svc.undo().unwrap();
        svc.undo().unwrap();
        assert_eq!(get_pixel(&svc, id, 0, 0), Color::TRANSPARENT);
    }

    #[test]
    fn mixed_draw_and_layer_ops_undo_in_correct_order() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let mut tool = BrushTool::default();

        brush_stroke(&mut svc, &mut tool, id, 0, 0, Color::WHITE);
        svc.add_layer(LayerId::new(2), "second").unwrap();
        svc.set_layer_opacity(id, 0.5).unwrap();

        svc.undo().unwrap();
        assert_eq!(
            svc.texture().layer_stack().get_layer(id).unwrap().opacity(),
            1.0
        );

        svc.undo().unwrap();
        assert_eq!(svc.texture().layer_stack().len(), 1);

        svc.undo().unwrap();
        assert_eq!(get_pixel(&svc, id, 0, 0), Color::TRANSPARENT);
    }

    // === US3 Redo: Layer operations redo ===

    #[test]
    fn add_layer_redo_restores() {
        let mut svc = test_service();
        svc.add_layer(LayerId::new(2), "second").unwrap();
        assert_eq!(svc.texture().layer_stack().len(), 2);

        svc.undo().unwrap();
        assert_eq!(svc.texture().layer_stack().len(), 1);

        svc.redo().unwrap();
        assert_eq!(svc.texture().layer_stack().len(), 2);
        assert!(svc
            .texture()
            .layer_stack()
            .get_layer(LayerId::new(2))
            .is_some());
    }

    #[test]
    fn remove_layer_redo_removes_again() {
        let mut svc = test_service();
        let id = LayerId::new(1);

        svc.remove_layer(id).unwrap();
        assert!(svc.texture().layer_stack().is_empty());

        svc.undo().unwrap();
        assert_eq!(svc.texture().layer_stack().len(), 1);

        svc.redo().unwrap();
        assert!(svc.texture().layer_stack().is_empty());
    }

    #[test]
    fn property_change_redo_reapplies() {
        let mut svc = test_service();
        let id = LayerId::new(1);

        svc.set_layer_opacity(id, 0.5).unwrap();
        svc.undo().unwrap();
        assert_eq!(
            svc.texture().layer_stack().get_layer(id).unwrap().opacity(),
            1.0
        );

        svc.redo().unwrap();
        assert_eq!(
            svc.texture().layer_stack().get_layer(id).unwrap().opacity(),
            0.5
        );
    }

    // === US4: History Limit Protection (T020) ===

    #[test]
    fn history_limit_enforced_at_101_operations() {
        let mut tex = test_texture();
        tex.add_layer(LayerId::new(1), "base".to_string()).unwrap();
        let mut svc = EditorService::with_max_history(tex, 100);
        let id = LayerId::new(1);
        let mut tool = BrushTool::default();

        for i in 0..101u32 {
            brush_stroke(
                &mut svc,
                &mut tool,
                id,
                i % 4,
                (i / 4) % 4,
                Color::new(i as u8, 0, 0, 255),
            );
        }

        let mut count = 0;
        while svc.can_undo() {
            svc.undo().unwrap();
            count += 1;
        }
        assert_eq!(count, 100);
    }

    #[test]
    fn oldest_operation_is_unreachable() {
        let mut tex = test_texture();
        tex.add_layer(LayerId::new(1), "base".to_string()).unwrap();
        let mut svc = EditorService::with_max_history(tex, 3);
        let id = LayerId::new(1);
        let mut tool = BrushTool::default();

        let initial = get_layer_data(&svc, id);

        brush_stroke(&mut svc, &mut tool, id, 0, 0, Color::new(10, 0, 0, 255));
        brush_stroke(&mut svc, &mut tool, id, 1, 0, Color::new(20, 0, 0, 255));
        brush_stroke(&mut svc, &mut tool, id, 2, 0, Color::new(30, 0, 0, 255));
        brush_stroke(&mut svc, &mut tool, id, 3, 0, Color::new(40, 0, 0, 255));

        svc.undo().unwrap();
        svc.undo().unwrap();
        svc.undo().unwrap();
        assert!(svc.undo().is_err());

        assert_ne!(initial, get_layer_data(&svc, id));
    }

    #[test]
    fn memory_stays_bounded_at_capacity() {
        let mut tex = test_texture();
        tex.add_layer(LayerId::new(1), "base".to_string()).unwrap();
        let mut svc = EditorService::with_max_history(tex, 5);
        let id = LayerId::new(1);
        let mut tool = BrushTool::default();

        for i in 0..20u32 {
            brush_stroke(
                &mut svc,
                &mut tool,
                id,
                i % 4,
                (i / 4) % 4,
                Color::new(i as u8, 0, 0, 255),
            );
        }

        for _ in 0..5 {
            svc.undo().unwrap();
        }
        for _ in 0..5 {
            svc.redo().unwrap();
        }

        brush_stroke(&mut svc, &mut tool, id, 0, 0, Color::WHITE);
        assert!(svc.can_undo());
    }

    // === Factory methods ===

    #[test]
    fn from_pixel_buffer_creates_editor_with_correct_pixels() {
        let mut buf = PixelBuffer::new(4, 4).unwrap();
        let red = Color::new(255, 0, 0, 255);
        buf.set_pixel(1, 2, red).unwrap();

        let layer_id = LayerId::new(42);
        let svc = EditorService::from_pixel_buffer(
            &buf,
            "minecraft".into(),
            "block/test".into(),
            layer_id,
        )
        .unwrap();

        assert_eq!(svc.texture().width(), 4);
        assert_eq!(svc.texture().height(), 4);
        assert_eq!(svc.texture().namespace(), "minecraft");
        assert!(!svc.texture().is_dirty());
        assert_eq!(svc.texture().layer_stack().len(), 1);
        assert_eq!(get_pixel(&svc, layer_id, 1, 2), red);
        assert_eq!(get_pixel(&svc, layer_id, 0, 0), Color::TRANSPARENT);
    }

    #[test]
    fn from_pixel_buffer_starts_clean() {
        let buf = PixelBuffer::new(2, 2).unwrap();
        let svc =
            EditorService::from_pixel_buffer(&buf, "ns".into(), "path".into(), LayerId::new(1))
                .unwrap();
        assert!(!svc.texture().is_dirty());
    }

    #[test]
    fn new_blank_creates_transparent_layer() {
        let layer_id = LayerId::new(10);
        let svc = EditorService::new_blank("minecraft".into(), "block/new".into(), 8, 8, layer_id)
            .unwrap();

        assert_eq!(svc.texture().width(), 8);
        assert_eq!(svc.texture().height(), 8);
        assert!(!svc.texture().is_dirty());
        assert_eq!(svc.texture().layer_stack().len(), 1);
        let layer = svc.texture().layer_stack().get_layer(layer_id).unwrap();
        assert_eq!(layer.name(), "Layer 1");
        assert_eq!(get_pixel(&svc, layer_id, 0, 0), Color::TRANSPARENT);
    }

    #[test]
    fn new_blank_starts_clean() {
        let svc = EditorService::new_blank("ns".into(), "p".into(), 2, 2, LayerId::new(1)).unwrap();
        assert!(!svc.texture().is_dirty());
    }

    #[test]
    fn save_composite_marks_clean() {
        use crate::domain::ports::ImageWriter;

        struct NoopWriter;
        impl ImageWriter for NoopWriter {
            fn write(&self, _path: &str, _buffer: &PixelBuffer) -> Result<(), DomainError> {
                Ok(())
            }
        }

        let layer_id = LayerId::new(1);
        let mut svc = EditorService::new_blank("ns".into(), "p".into(), 4, 4, layer_id).unwrap();
        let mut tool = BrushTool::default();
        brush_stroke(&mut svc, &mut tool, layer_id, 0, 0, Color::WHITE);
        assert!(svc.texture().is_dirty());

        svc.save_composite(&NoopWriter, "/tmp/test.png").unwrap();
        assert!(!svc.texture().is_dirty());
    }

    #[test]
    fn save_composite_failure_keeps_dirty() {
        use crate::domain::ports::ImageWriter;

        struct FailingWriter;
        impl ImageWriter for FailingWriter {
            fn write(&self, _path: &str, _buffer: &PixelBuffer) -> Result<(), DomainError> {
                Err(DomainError::IoError {
                    reason: "disk full".to_owned(),
                })
            }
        }

        let layer_id = LayerId::new(1);
        let mut svc = EditorService::new_blank("ns".into(), "p".into(), 4, 4, layer_id).unwrap();
        let mut tool = BrushTool::default();
        brush_stroke(&mut svc, &mut tool, layer_id, 0, 0, Color::WHITE);
        assert!(svc.texture().is_dirty());

        let result = svc.save_composite(&FailingWriter, "/tmp/test.png");
        assert!(result.is_err());
        assert!(
            svc.texture().is_dirty(),
            "texture must remain dirty on save failure"
        );
    }

    #[test]
    fn factory_methods_start_with_empty_history() {
        let svc = EditorService::new_blank("ns".into(), "p".into(), 2, 2, LayerId::new(1)).unwrap();
        assert!(!svc.can_undo());
        assert!(!svc.can_redo());

        let buf = PixelBuffer::new(2, 2).unwrap();
        let svc2 = EditorService::from_pixel_buffer(&buf, "ns".into(), "p".into(), LayerId::new(2))
            .unwrap();
        assert!(!svc2.can_undo());
        assert!(!svc2.can_redo());
    }

    #[test]
    fn save_composite_writes_composited_pixels() {
        use crate::domain::ports::ImageWriter;
        use std::cell::RefCell;

        struct RecordingWriter {
            data: RefCell<Vec<u8>>,
        }
        impl ImageWriter for RecordingWriter {
            fn write(&self, _path: &str, buffer: &PixelBuffer) -> Result<(), DomainError> {
                *self.data.borrow_mut() = buffer.pixels().to_vec();
                Ok(())
            }
        }

        let layer_id = LayerId::new(1);
        let mut svc = EditorService::new_blank("ns".into(), "p".into(), 2, 2, layer_id).unwrap();
        let mut tool = BrushTool::default();
        brush_stroke(&mut svc, &mut tool, layer_id, 0, 0, Color::WHITE);

        let writer = RecordingWriter {
            data: RefCell::new(Vec::new()),
        };
        svc.save_composite(&writer, "out.png").unwrap();

        let data = writer.data.borrow();
        // First pixel should be white (255,255,255,255)
        assert_eq!(&data[0..4], &[255, 255, 255, 255]);
    }

    // === Layers Panel: add_layer_above, duplicate_layer ===

    #[test]
    fn add_layer_above_inserts_after_reference() {
        let mut svc = test_service();
        let id1 = LayerId::new(1);
        svc.add_layer(LayerId::new(2), "top").unwrap();

        svc.add_layer_above(LayerId::new(3), "middle", Some(id1))
            .unwrap();

        let names: Vec<&str> = svc
            .texture()
            .layer_stack()
            .layers()
            .iter()
            .map(|l| l.name())
            .collect();
        assert_eq!(names, vec!["base", "middle", "top"]);
    }

    #[test]
    fn add_layer_above_none_appends_to_top() {
        let mut svc = test_service();
        svc.add_layer_above(LayerId::new(2), "new_top", None)
            .unwrap();

        let last = svc.texture().layer_stack().layers().last().unwrap();
        assert_eq!(last.name(), "new_top");
    }

    #[test]
    fn add_layer_above_is_undoable() {
        let mut svc = test_service();
        let id1 = LayerId::new(1);
        svc.add_layer_above(LayerId::new(2), "above", Some(id1))
            .unwrap();
        assert_eq!(svc.texture().layer_stack().len(), 2);

        svc.undo().unwrap();
        assert_eq!(svc.texture().layer_stack().len(), 1);
    }

    #[test]
    fn add_layer_above_missing_reference_returns_error() {
        let mut svc = test_service();
        let err = svc
            .add_layer_above(LayerId::new(2), "nope", Some(LayerId::new(999)))
            .unwrap_err();
        assert_eq!(err, DomainError::LayerNotFound { layer_id: 999 });
    }

    #[test]
    fn duplicate_layer_copies_above_source() {
        let mut svc = test_service();
        let id1 = LayerId::new(1);
        svc.add_layer(LayerId::new(2), "top").unwrap();

        svc.duplicate_layer(id1, LayerId::new(3)).unwrap();

        let names: Vec<&str> = svc
            .texture()
            .layer_stack()
            .layers()
            .iter()
            .map(|l| l.name())
            .collect();
        assert_eq!(names, vec!["base", "base (copy)", "top"]);
    }

    #[test]
    fn duplicate_layer_copies_pixel_data() {
        let mut svc = test_service();
        let id1 = LayerId::new(1);
        let mut tool = BrushTool::default();
        brush_stroke(&mut svc, &mut tool, id1, 0, 0, Color::WHITE);

        svc.duplicate_layer(id1, LayerId::new(2)).unwrap();

        let dup = svc
            .texture()
            .layer_stack()
            .get_layer(LayerId::new(2))
            .unwrap();
        assert_eq!(dup.buffer().get_pixel(0, 0).unwrap(), Color::WHITE);
    }

    #[test]
    fn duplicate_layer_is_undoable() {
        let mut svc = test_service();
        svc.duplicate_layer(LayerId::new(1), LayerId::new(2))
            .unwrap();
        assert_eq!(svc.texture().layer_stack().len(), 2);

        svc.undo().unwrap();
        assert_eq!(svc.texture().layer_stack().len(), 1);
    }

    #[test]
    fn duplicate_layer_missing_source_returns_error() {
        let mut svc = test_service();
        let err = svc
            .duplicate_layer(LayerId::new(999), LayerId::new(2))
            .unwrap_err();
        assert_eq!(err, DomainError::LayerNotFound { layer_id: 999 });
    }

    #[test]
    fn set_layer_name_empty_returns_error_without_undo_entry() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        let err = svc.set_layer_name(id, "").unwrap_err();
        assert_eq!(err, DomainError::EmptyName);
        assert!(!svc.can_undo(), "failed rename must not push undo entry");
    }

    #[test]
    fn duplicate_layer_is_unlocked() {
        let mut svc = test_service();
        let id = LayerId::new(1);
        svc.set_layer_locked(id, true).unwrap();
        svc.duplicate_layer(id, LayerId::new(2)).unwrap();
        let dup = svc
            .texture()
            .layer_stack()
            .get_layer(LayerId::new(2))
            .unwrap();
        assert!(!dup.is_locked(), "duplicated layer must be unlocked");
    }
}
