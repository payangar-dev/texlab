use std::collections::VecDeque;

use super::blend::BlendMode;
use super::layer::{Layer, LayerId};
use super::layer_stack::LayerStack;

/// Snapshot of a single layer's complete state at a point in time.
#[derive(Debug)]
pub struct LayerSnapshot {
    pub(crate) id: LayerId,
    pub(crate) name: String,
    pub(crate) data: Vec<u8>,
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) opacity: f32,
    pub(crate) blend_mode: BlendMode,
    pub(crate) visible: bool,
    pub(crate) locked: bool,
}

impl LayerSnapshot {
    pub fn from_layer(layer: &Layer) -> Self {
        Self {
            id: layer.id(),
            name: layer.name().to_string(),
            data: layer.buffer().clone_data(),
            width: layer.buffer().width(),
            height: layer.buffer().height(),
            opacity: layer.opacity(),
            blend_mode: layer.blend_mode(),
            visible: layer.is_visible(),
            locked: layer.is_locked(),
        }
    }
}

/// Snapshot of all layers in the layer stack.
#[derive(Debug)]
pub struct TextureSnapshot {
    pub(crate) layers: Vec<LayerSnapshot>,
}

impl TextureSnapshot {
    pub fn capture(layer_stack: &LayerStack) -> Self {
        Self {
            layers: layer_stack
                .layers()
                .iter()
                .map(LayerSnapshot::from_layer)
                .collect(),
        }
    }
}

/// Describes the kind of user action performed.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OperationType {
    Draw,
    LayerAdd,
    LayerRemove,
    LayerReorder,
    LayerPropertyChange,
}

/// A single undoable step. Captures the state *before* the operation.
#[derive(Debug)]
pub struct UndoEntry {
    operation: OperationType,
    snapshot: TextureSnapshot,
}

impl UndoEntry {
    pub fn new(operation: OperationType, snapshot: TextureSnapshot) -> Self {
        Self {
            operation,
            snapshot,
        }
    }

    pub fn operation(&self) -> &OperationType {
        &self.operation
    }

    pub fn into_parts(self) -> (OperationType, TextureSnapshot) {
        (self.operation, self.snapshot)
    }
}

/// Per-texture history manager with bounded undo/redo stacks.
#[derive(Debug)]
pub struct UndoManager {
    undo_stack: VecDeque<UndoEntry>,
    redo_stack: Vec<UndoEntry>,
    max_depth: usize,
}

impl UndoManager {
    pub fn new(max_depth: usize) -> Self {
        assert!(max_depth > 0, "max_depth must be at least 1");
        Self {
            undo_stack: VecDeque::with_capacity(max_depth),
            redo_stack: Vec::new(),
            max_depth,
        }
    }

    /// Records a new user operation. Clears redo stack (fork behavior).
    pub fn push(&mut self, entry: UndoEntry) {
        self.redo_stack.clear();
        self.push_to_undo(entry);
    }

    /// Pushes to undo stack without clearing redo.
    pub(crate) fn push_undo(&mut self, entry: UndoEntry) {
        self.push_to_undo(entry);
    }

    fn push_to_undo(&mut self, entry: UndoEntry) {
        if self.undo_stack.len() >= self.max_depth {
            self.undo_stack.pop_front();
        }
        self.undo_stack.push_back(entry);
    }

    pub(crate) fn pop_undo(&mut self) -> Option<UndoEntry> {
        self.undo_stack.pop_back()
    }

    pub(crate) fn push_redo(&mut self, entry: UndoEntry) {
        self.redo_stack.push(entry);
    }

    pub(crate) fn pop_redo(&mut self) -> Option<UndoEntry> {
        self.redo_stack.pop()
    }

    pub fn can_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    pub fn undo_count(&self) -> usize {
        self.undo_stack.len()
    }

    pub fn redo_count(&self) -> usize {
        self.redo_stack.len()
    }

    pub fn clear(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use crate::domain::color::Color;

    fn make_test_layer_stack(num_layers: usize) -> LayerStack {
        let mut stack = LayerStack::new();
        for i in 0..num_layers {
            let layer = Layer::new(
                LayerId::new(i as u128 + 1),
                format!("layer_{}", i + 1),
                4,
                4,
            )
            .unwrap();
            stack.add_layer(layer);
        }
        stack
    }

    fn make_snapshot(num_layers: usize) -> TextureSnapshot {
        TextureSnapshot::capture(&make_test_layer_stack(num_layers))
    }

    fn make_entry(op: OperationType) -> UndoEntry {
        UndoEntry::new(op, make_snapshot(1))
    }

    // --- Snapshot round-trip tests (T007) ---

    #[test]
    fn layer_snapshot_round_trip_preserves_pixels() {
        let mut layer = Layer::new(LayerId::new(1), "test".to_string(), 4, 4).unwrap();
        let red = Color::new(255, 0, 0, 255);
        layer.set_pixel(0, 0, red).unwrap();
        layer.set_pixel(3, 3, Color::WHITE).unwrap();

        let snapshot = LayerSnapshot::from_layer(&layer);
        layer.restore_from_snapshot(snapshot).unwrap();

        assert_eq!(layer.buffer().get_pixel(0, 0).unwrap(), red);
        assert_eq!(layer.buffer().get_pixel(3, 3).unwrap(), Color::WHITE);
        assert_eq!(layer.buffer().get_pixel(1, 1).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn layer_snapshot_preserves_all_properties() {
        use crate::domain::blend::BlendMode;

        let mut layer = Layer::new(LayerId::new(42), "original".to_string(), 4, 4).unwrap();
        layer.set_opacity(0.5);
        layer.set_blend_mode(BlendMode::Multiply);
        layer.set_visible(false);
        layer.set_locked(true);

        let snapshot = LayerSnapshot::from_layer(&layer);

        // Modify all properties
        layer.set_opacity(1.0);
        layer.set_blend_mode(BlendMode::Normal);
        layer.set_visible(true);
        layer.set_locked(false);
        layer.set_name("changed".to_string()).unwrap();

        layer.restore_from_snapshot(snapshot).unwrap();

        assert_eq!(layer.id(), LayerId::new(42));
        assert_eq!(layer.name(), "original");
        assert_eq!(layer.opacity(), 0.5);
        assert_eq!(layer.blend_mode(), BlendMode::Multiply);
        assert!(!layer.is_visible());
        assert!(layer.is_locked());
    }

    #[test]
    fn texture_snapshot_captures_multi_layer_stack() {
        let mut stack = LayerStack::new();
        let mut layer1 = Layer::new(LayerId::new(1), "bottom".to_string(), 4, 4).unwrap();
        layer1.set_pixel(0, 0, Color::WHITE).unwrap();
        let mut layer2 = Layer::new(LayerId::new(2), "top".to_string(), 4, 4).unwrap();
        layer2.set_pixel(1, 1, Color::new(255, 0, 0, 255)).unwrap();
        layer2.set_opacity(0.5);
        stack.add_layer(layer1);
        stack.add_layer(layer2);

        let snapshot = TextureSnapshot::capture(&stack);

        // Destroy the stack
        stack.remove_layer(LayerId::new(2)).unwrap();

        // Restore
        stack.restore_from_snapshots(snapshot).unwrap();

        assert_eq!(stack.len(), 2);
        assert_eq!(stack.layers()[0].name(), "bottom");
        assert_eq!(
            stack.layers()[0].buffer().get_pixel(0, 0).unwrap(),
            Color::WHITE
        );
        assert_eq!(stack.layers()[1].name(), "top");
        assert_eq!(
            stack.layers()[1].buffer().get_pixel(1, 1).unwrap(),
            Color::new(255, 0, 0, 255)
        );
        assert_eq!(stack.layers()[1].opacity(), 0.5);
    }

    #[test]
    fn texture_snapshot_empty_stack_round_trip() {
        let mut stack = LayerStack::new();
        let snapshot = TextureSnapshot::capture(&stack);

        stack.add_layer(Layer::new(LayerId::new(1), "temp".to_string(), 4, 4).unwrap());

        stack.restore_from_snapshots(snapshot).unwrap();
        assert!(stack.is_empty());
    }

    // --- UndoManager tests (T008) ---

    #[test]
    fn push_and_pop_undo() {
        let mut mgr = UndoManager::new(10);
        mgr.push(make_entry(OperationType::Draw));

        assert!(mgr.can_undo());
        assert_eq!(mgr.undo_count(), 1);

        let entry = mgr.pop_undo().unwrap();
        assert_eq!(entry.operation(), &OperationType::Draw);
        assert!(!mgr.can_undo());
    }

    #[test]
    fn push_and_pop_redo() {
        let mut mgr = UndoManager::new(10);
        mgr.push_redo(make_entry(OperationType::Draw));

        assert!(mgr.can_redo());
        assert_eq!(mgr.redo_count(), 1);

        let entry = mgr.pop_redo().unwrap();
        assert_eq!(entry.operation(), &OperationType::Draw);
        assert!(!mgr.can_redo());
    }

    #[test]
    fn max_depth_evicts_oldest() {
        let mut mgr = UndoManager::new(3);
        mgr.push(make_entry(OperationType::Draw));
        mgr.push(make_entry(OperationType::LayerAdd));
        mgr.push(make_entry(OperationType::LayerRemove));
        assert_eq!(mgr.undo_count(), 3);

        mgr.push(make_entry(OperationType::LayerReorder));
        assert_eq!(mgr.undo_count(), 3);

        assert_eq!(
            mgr.pop_undo().unwrap().operation(),
            &OperationType::LayerReorder
        );
        assert_eq!(
            mgr.pop_undo().unwrap().operation(),
            &OperationType::LayerRemove
        );
        assert_eq!(
            mgr.pop_undo().unwrap().operation(),
            &OperationType::LayerAdd
        );
        assert!(mgr.pop_undo().is_none());
    }

    #[test]
    fn push_clears_redo_stack() {
        let mut mgr = UndoManager::new(10);
        mgr.push_redo(make_entry(OperationType::Draw));
        mgr.push_redo(make_entry(OperationType::LayerAdd));
        assert_eq!(mgr.redo_count(), 2);

        mgr.push(make_entry(OperationType::LayerRemove));
        assert_eq!(mgr.redo_count(), 0);
        assert!(!mgr.can_redo());
    }

    #[test]
    fn can_undo_can_redo_state() {
        let mut mgr = UndoManager::new(10);
        assert!(!mgr.can_undo());
        assert!(!mgr.can_redo());

        mgr.push(make_entry(OperationType::Draw));
        assert!(mgr.can_undo());
        assert!(!mgr.can_redo());

        mgr.push_redo(make_entry(OperationType::Draw));
        assert!(mgr.can_undo());
        assert!(mgr.can_redo());
    }

    #[test]
    fn clear_empties_both_stacks() {
        let mut mgr = UndoManager::new(10);
        mgr.push(make_entry(OperationType::Draw));
        mgr.push_redo(make_entry(OperationType::LayerAdd));

        mgr.clear();

        assert!(!mgr.can_undo());
        assert!(!mgr.can_redo());
        assert_eq!(mgr.undo_count(), 0);
        assert_eq!(mgr.redo_count(), 0);
    }

    #[test]
    fn undo_count_redo_count_accuracy() {
        let mut mgr = UndoManager::new(10);
        assert_eq!(mgr.undo_count(), 0);
        assert_eq!(mgr.redo_count(), 0);

        mgr.push(make_entry(OperationType::Draw));
        mgr.push(make_entry(OperationType::LayerAdd));
        assert_eq!(mgr.undo_count(), 2);

        mgr.pop_undo();
        assert_eq!(mgr.undo_count(), 1);

        mgr.push_redo(make_entry(OperationType::Draw));
        mgr.push_redo(make_entry(OperationType::LayerAdd));
        assert_eq!(mgr.redo_count(), 2);

        mgr.pop_redo();
        assert_eq!(mgr.redo_count(), 1);
    }

    #[test]
    fn pop_undo_on_empty_returns_none() {
        let mut mgr = UndoManager::new(10);
        assert!(mgr.pop_undo().is_none());
    }

    #[test]
    fn pop_redo_on_empty_returns_none() {
        let mut mgr = UndoManager::new(10);
        assert!(mgr.pop_redo().is_none());
    }

    #[test]
    #[should_panic(expected = "max_depth must be at least 1")]
    fn new_panics_on_zero_depth() {
        UndoManager::new(0);
    }
}
