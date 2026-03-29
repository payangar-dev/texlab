use super::error::DomainError;
use super::layer::{Layer, LayerId};
use super::layer_stack::LayerStack;
use super::pixel_buffer::PixelBuffer;

/// Top-level document model. Owns canvas dimensions and layer stack.
///
/// Dirty tracking is caller-managed: mutations via `layer_stack_mut()` do NOT
/// automatically set dirty. The orchestration layer must call `mark_dirty()`
/// after any mutation.
#[derive(Debug)]
pub struct Texture {
    namespace: String,
    path: String,
    width: u32,
    height: u32,
    layer_stack: LayerStack,
    dirty: bool,
}

impl Texture {
    /// Creates a new texture with an empty layer stack, not dirty.
    pub fn new(
        namespace: String,
        path: String,
        width: u32,
        height: u32,
    ) -> Result<Self, DomainError> {
        if namespace.is_empty() {
            return Err(DomainError::EmptyNamespace);
        }
        if path.is_empty() {
            return Err(DomainError::EmptyPath);
        }
        if width == 0 || height == 0 {
            return Err(DomainError::InvalidDimensions { width, height });
        }
        Ok(Self {
            namespace,
            path,
            width,
            height,
            layer_stack: LayerStack::new(),
            dirty: false,
        })
    }

    pub fn namespace(&self) -> &str {
        &self.namespace
    }

    pub fn path(&self) -> &str {
        &self.path
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    pub fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    pub fn mark_saved(&mut self) {
        self.dirty = false;
    }

    pub fn layer_stack(&self) -> &LayerStack {
        &self.layer_stack
    }

    /// Grants mutable access to the layer stack.
    ///
    /// **Warning**: Mutations through this reference do NOT auto-set `dirty`.
    /// The caller MUST call `mark_dirty()` after any modification.
    pub fn layer_stack_mut(&mut self) -> &mut LayerStack {
        &mut self.layer_stack
    }

    /// Creates a new layer with the texture's dimensions and adds it to the stack.
    /// Marks the texture as dirty.
    pub fn add_layer(&mut self, id: LayerId, name: String) -> Result<(), DomainError> {
        let layer = Layer::new(id, name, self.width, self.height)?;
        self.layer_stack.add_layer(layer);
        self.dirty = true;
        Ok(())
    }

    /// Composites all layers into a flattened pixel buffer using the texture dimensions.
    pub fn composite(&self) -> Result<PixelBuffer, DomainError> {
        self.layer_stack.composite(self.width, self.height)
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use crate::domain::color::Color;

    fn test_texture() -> Texture {
        Texture::new(
            "minecraft".into(),
            "textures/block/stone.png".into(),
            16,
            16,
        )
        .unwrap()
    }

    #[test]
    fn new_with_valid_data() {
        let tex = test_texture();
        assert_eq!(tex.namespace(), "minecraft");
        assert_eq!(tex.path(), "textures/block/stone.png");
        assert_eq!(tex.width(), 16);
        assert_eq!(tex.height(), 16);
        assert!(!tex.is_dirty());
        assert!(tex.layer_stack().is_empty());
    }

    #[test]
    fn rejects_empty_namespace() {
        let err = Texture::new(String::new(), "path".into(), 16, 16).unwrap_err();
        assert_eq!(err, DomainError::EmptyNamespace);
    }

    #[test]
    fn rejects_empty_path() {
        let err = Texture::new("ns".into(), String::new(), 16, 16).unwrap_err();
        assert_eq!(err, DomainError::EmptyPath);
    }

    #[test]
    fn rejects_zero_dimensions() {
        let err = Texture::new("ns".into(), "path".into(), 0, 16).unwrap_err();
        assert_eq!(
            err,
            DomainError::InvalidDimensions {
                width: 0,
                height: 16
            }
        );
    }

    #[test]
    fn starts_not_dirty() {
        let tex = test_texture();
        assert!(!tex.is_dirty());
    }

    #[test]
    fn mark_dirty_and_saved() {
        let mut tex = test_texture();
        tex.mark_dirty();
        assert!(tex.is_dirty());
        tex.mark_saved();
        assert!(!tex.is_dirty());
    }

    #[test]
    fn add_layer_marks_dirty() {
        let mut tex = test_texture();
        tex.add_layer(LayerId::new(1), "base".into()).unwrap();
        assert!(tex.is_dirty());
        assert_eq!(tex.layer_stack().len(), 1);
    }

    #[test]
    fn add_layer_creates_correct_size() {
        let mut tex = test_texture();
        tex.add_layer(LayerId::new(1), "base".into()).unwrap();
        let layer = tex.layer_stack().get_layer(LayerId::new(1)).unwrap();
        assert_eq!(layer.buffer().width(), 16);
        assert_eq!(layer.buffer().height(), 16);
    }

    #[test]
    fn add_layer_rejects_empty_name() {
        let mut tex = test_texture();
        let err = tex.add_layer(LayerId::new(1), String::new()).unwrap_err();
        assert_eq!(err, DomainError::EmptyName);
        assert!(tex.layer_stack().is_empty()); // no partial mutation
    }

    #[test]
    fn composite_delegates_to_layer_stack() {
        let mut tex = test_texture();
        tex.add_layer(LayerId::new(1), "base".into()).unwrap();
        let result = tex.composite().unwrap();
        assert_eq!(result.width(), 16);
        assert_eq!(result.height(), 16);
    }

    #[test]
    fn pixel_edit_via_layer_stack_mut_requires_manual_dirty() {
        let mut tex = test_texture();
        tex.add_layer(LayerId::new(1), "base".into()).unwrap();
        tex.mark_saved(); // reset dirty

        // Mutate via layer_stack_mut — dirty is NOT auto-set
        let layer = tex
            .layer_stack_mut()
            .get_layer_mut(LayerId::new(1))
            .unwrap();
        layer.set_pixel(0, 0, Color::WHITE).unwrap();
        assert!(!tex.is_dirty()); // still clean — caller-managed

        tex.mark_dirty(); // caller responsibility
        assert!(tex.is_dirty());
    }
}
