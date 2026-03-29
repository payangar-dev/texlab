use super::blend;
use super::error::DomainError;
use super::layer::{Layer, LayerId};
use super::pixel_buffer::PixelBuffer;
use super::undo::TextureSnapshot;

/// Ordered collection of layers (bottom to top).
/// Manages layer lifecycle and compositing.
#[derive(Debug)]
pub struct LayerStack {
    layers: Vec<Layer>,
}

impl LayerStack {
    pub fn new() -> Self {
        Self { layers: Vec::new() }
    }

    pub fn add_layer(&mut self, layer: Layer) {
        self.layers.push(layer);
    }

    pub fn remove_layer(&mut self, id: LayerId) -> Result<Layer, DomainError> {
        let pos =
            self.layers
                .iter()
                .position(|l| l.id() == id)
                .ok_or(DomainError::LayerNotFound {
                    layer_id: id.value(),
                })?;
        Ok(self.layers.remove(pos))
    }

    pub fn move_layer(&mut self, from: usize, to: usize) -> Result<(), DomainError> {
        let len = self.layers.len();
        if from >= len {
            return Err(DomainError::InvalidIndex { index: from, len });
        }
        if to >= len {
            return Err(DomainError::InvalidIndex { index: to, len });
        }
        let layer = self.layers.remove(from);
        self.layers.insert(to, layer);
        Ok(())
    }

    pub fn get_layer(&self, id: LayerId) -> Option<&Layer> {
        self.layers.iter().find(|l| l.id() == id)
    }

    pub fn get_layer_mut(&mut self, id: LayerId) -> Option<&mut Layer> {
        self.layers.iter_mut().find(|l| l.id() == id)
    }

    pub fn len(&self) -> usize {
        self.layers.len()
    }

    pub fn is_empty(&self) -> bool {
        self.layers.is_empty()
    }

    pub fn layers(&self) -> &[Layer] {
        &self.layers
    }

    /// Replaces all layers from the given texture snapshot.
    pub fn restore_from_snapshots(&mut self, snapshot: TextureSnapshot) -> Result<(), DomainError> {
        let mut new_layers = Vec::with_capacity(snapshot.layers.len());
        for snap in snapshot.layers {
            new_layers.push(Layer::from_snapshot(snap)?);
        }
        self.layers = new_layers;
        Ok(())
    }

    /// Composites all visible layers bottom-to-top into a flattened buffer.
    ///
    /// Returns an error if dimensions are zero or if any layer has
    /// mismatched dimensions.
    pub fn composite(&self, width: u32, height: u32) -> Result<PixelBuffer, DomainError> {
        let mut result = PixelBuffer::new(width, height)?;

        for layer in &self.layers {
            if !layer.is_visible() || layer.opacity() <= 0.0 {
                continue;
            }

            if layer.buffer().width() != width || layer.buffer().height() != height {
                return Err(DomainError::InvalidDimensions {
                    width: layer.buffer().width(),
                    height: layer.buffer().height(),
                });
            }

            for y in 0..height {
                for x in 0..width {
                    let base = result.get_pixel(x, y)?;
                    let top = layer.buffer().get_pixel(x, y)?;
                    let blended = blend::blend(base, top, layer.blend_mode(), layer.opacity());
                    result.set_pixel(x, y, blended)?;
                }
            }
        }

        Ok(result)
    }
}

impl Default for LayerStack {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::blend::BlendMode;
    use crate::domain::color::Color;

    fn make_layer(id: u128, name: &str, w: u32, h: u32) -> Layer {
        Layer::new(LayerId::new(id), name.to_string(), w, h).unwrap()
    }

    fn solid_layer(id: u128, name: &str, w: u32, h: u32, color: Color) -> Layer {
        let mut layer = make_layer(id, name, w, h);
        for y in 0..h {
            for x in 0..w {
                layer.set_pixel(x, y, color).unwrap();
            }
        }
        layer
    }

    #[test]
    fn empty_stack_composites_to_transparent() {
        let stack = LayerStack::new();
        let result = stack.composite(4, 4).unwrap();
        for y in 0..4 {
            for x in 0..4 {
                assert_eq!(result.get_pixel(x, y).unwrap(), Color::TRANSPARENT);
            }
        }
    }

    #[test]
    fn single_layer_composite() {
        let red = Color::new(255, 0, 0, 255);
        let layer = solid_layer(1, "red", 2, 2, red);
        let mut stack = LayerStack::new();
        stack.add_layer(layer);
        let result = stack.composite(2, 2).unwrap();
        assert_eq!(result.get_pixel(0, 0).unwrap(), red);
        assert_eq!(result.get_pixel(1, 1).unwrap(), red);
    }

    #[test]
    fn two_layers_normal_blend() {
        let blue = Color::new(0, 0, 255, 255);
        let red = Color::new(255, 0, 0, 255);

        let bottom = solid_layer(1, "blue", 2, 2, blue);
        let top = solid_layer(2, "red", 2, 2, red);

        let mut stack = LayerStack::new();
        stack.add_layer(bottom);
        stack.add_layer(top);

        let result = stack.composite(2, 2).unwrap();
        assert_eq!(result.get_pixel(0, 0).unwrap(), red);
    }

    #[test]
    fn hidden_layer_skipped() {
        let blue = Color::new(0, 0, 255, 255);
        let red = Color::new(255, 0, 0, 255);

        let bottom = solid_layer(1, "blue", 2, 2, blue);
        let mut top = solid_layer(2, "red", 2, 2, red);
        top.set_visible(false);

        let mut stack = LayerStack::new();
        stack.add_layer(bottom);
        stack.add_layer(top);

        let result = stack.composite(2, 2).unwrap();
        assert_eq!(result.get_pixel(0, 0).unwrap(), blue);
    }

    #[test]
    fn zero_opacity_layer_skipped() {
        let blue = Color::new(0, 0, 255, 255);
        let red = Color::new(255, 0, 0, 255);

        let bottom = solid_layer(1, "blue", 2, 2, blue);
        let mut top = solid_layer(2, "red", 2, 2, red);
        top.set_opacity(0.0);

        let mut stack = LayerStack::new();
        stack.add_layer(bottom);
        stack.add_layer(top);

        let result = stack.composite(2, 2).unwrap();
        assert_eq!(result.get_pixel(0, 0).unwrap(), blue);
    }

    #[test]
    fn multiply_composite() {
        let base_color = Color::new(200, 100, 50, 255);
        let top_color = Color::new(100, 200, 255, 255);

        let bottom = solid_layer(1, "base", 1, 1, base_color);
        let mut top = solid_layer(2, "top", 1, 1, top_color);
        top.set_blend_mode(BlendMode::Multiply);

        let mut stack = LayerStack::new();
        stack.add_layer(bottom);
        stack.add_layer(top);

        let result = stack.composite(1, 1).unwrap();
        let pixel = result.get_pixel(0, 0).unwrap();
        assert_eq!(pixel.r(), 78);
        assert_eq!(pixel.g(), 78);
        assert_eq!(pixel.b(), 50);
    }

    #[test]
    fn screen_composite() {
        let base_color = Color::new(100, 150, 200, 255);
        let top_color = Color::new(100, 150, 200, 255);

        let bottom = solid_layer(1, "base", 1, 1, base_color);
        let mut top = solid_layer(2, "top", 1, 1, top_color);
        top.set_blend_mode(BlendMode::Screen);

        let mut stack = LayerStack::new();
        stack.add_layer(bottom);
        stack.add_layer(top);

        let result = stack.composite(1, 1).unwrap();
        let pixel = result.get_pixel(0, 0).unwrap();
        assert_eq!(pixel.r(), 161);
    }

    #[test]
    fn overlay_composite() {
        let base_color = Color::new(50, 200, 50, 255);
        let top_color = Color::new(200, 100, 200, 255);

        let bottom = solid_layer(1, "base", 1, 1, base_color);
        let mut top = solid_layer(2, "top", 1, 1, top_color);
        top.set_blend_mode(BlendMode::Overlay);

        let mut stack = LayerStack::new();
        stack.add_layer(bottom);
        stack.add_layer(top);

        let result = stack.composite(1, 1).unwrap();
        let pixel = result.get_pixel(0, 0).unwrap();
        assert_eq!(pixel.r(), 78);
        assert_eq!(pixel.g(), 189);
    }

    #[test]
    fn all_layers_hidden_composites_to_transparent() {
        let mut layer_a = solid_layer(1, "a", 2, 2, Color::WHITE);
        let mut layer_b = solid_layer(2, "b", 2, 2, Color::BLACK);
        layer_a.set_visible(false);
        layer_b.set_visible(false);

        let mut stack = LayerStack::new();
        stack.add_layer(layer_a);
        stack.add_layer(layer_b);

        let result = stack.composite(2, 2).unwrap();
        for y in 0..2 {
            for x in 0..2 {
                assert_eq!(result.get_pixel(x, y).unwrap(), Color::TRANSPARENT);
            }
        }
    }

    #[test]
    fn composite_rejects_zero_dimensions() {
        let stack = LayerStack::new();
        let err = stack.composite(0, 4).unwrap_err();
        assert_eq!(
            err,
            DomainError::InvalidDimensions {
                width: 0,
                height: 4
            }
        );
    }

    #[test]
    fn composite_rejects_dimension_mismatch() {
        let layer = solid_layer(1, "small", 2, 2, Color::WHITE);
        let mut stack = LayerStack::new();
        stack.add_layer(layer);

        let err = stack.composite(4, 4).unwrap_err();
        assert_eq!(
            err,
            DomainError::InvalidDimensions {
                width: 2,
                height: 2
            }
        );
    }

    #[test]
    fn add_remove_operations() {
        let mut stack = LayerStack::new();
        assert!(stack.is_empty());

        stack.add_layer(make_layer(1, "first", 2, 2));
        stack.add_layer(make_layer(2, "second", 2, 2));
        assert_eq!(stack.len(), 2);

        let removed = stack.remove_layer(LayerId::new(1)).unwrap();
        assert_eq!(removed.name(), "first");
        assert_eq!(stack.len(), 1);
    }

    #[test]
    fn remove_layer_not_found() {
        let mut stack = LayerStack::new();
        stack.add_layer(make_layer(1, "a", 2, 2));
        let err = stack.remove_layer(LayerId::new(99)).unwrap_err();
        assert_eq!(err, DomainError::LayerNotFound { layer_id: 99 });
    }

    #[test]
    fn move_layer_reorder() {
        let mut stack = LayerStack::new();
        stack.add_layer(make_layer(1, "a", 2, 2));
        stack.add_layer(make_layer(2, "b", 2, 2));
        stack.add_layer(make_layer(3, "c", 2, 2));

        stack.move_layer(0, 2).unwrap();
        assert_eq!(stack.layers()[0].name(), "b");
        assert_eq!(stack.layers()[1].name(), "c");
        assert_eq!(stack.layers()[2].name(), "a");
    }

    #[test]
    fn move_layer_to_invalid_index() {
        let mut stack = LayerStack::new();
        stack.add_layer(make_layer(1, "a", 2, 2));
        let err = stack.move_layer(0, 5).unwrap_err();
        assert_eq!(err, DomainError::InvalidIndex { index: 5, len: 1 });
    }

    #[test]
    fn move_layer_from_invalid_index() {
        let mut stack = LayerStack::new();
        stack.add_layer(make_layer(1, "a", 2, 2));
        let err = stack.move_layer(5, 0).unwrap_err();
        assert_eq!(err, DomainError::InvalidIndex { index: 5, len: 1 });
    }

    #[test]
    fn get_layer_by_id() {
        let mut stack = LayerStack::new();
        stack.add_layer(make_layer(42, "target", 2, 2));
        assert!(stack.get_layer(LayerId::new(42)).is_some());
        assert!(stack.get_layer(LayerId::new(99)).is_none());
    }

    #[test]
    fn get_layer_mut_by_id() {
        let mut stack = LayerStack::new();
        stack.add_layer(make_layer(42, "target", 2, 2));
        let layer = stack.get_layer_mut(LayerId::new(42)).unwrap();
        layer.set_name("modified".to_string()).unwrap();
        assert_eq!(
            stack.get_layer(LayerId::new(42)).unwrap().name(),
            "modified"
        );
    }
}
