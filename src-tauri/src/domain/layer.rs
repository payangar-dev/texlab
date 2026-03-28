use super::blend::BlendMode;
use super::color::Color;
use super::error::DomainError;
use super::pixel_buffer::PixelBuffer;

/// Unique layer identifier. Newtype over `u128` for UUID compatibility
/// without importing the `uuid` crate into the domain.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct LayerId(u128);

impl LayerId {
    pub fn new(value: u128) -> Self {
        Self(value)
    }

    pub fn value(self) -> u128 {
        self.0
    }
}

/// Named editing surface with pixel buffer and compositing properties.
#[derive(Debug)]
pub struct Layer {
    id: LayerId,
    name: String,
    buffer: PixelBuffer,
    opacity: f32,
    blend_mode: BlendMode,
    visible: bool,
    locked: bool,
}

impl Layer {
    /// Creates a new layer with default properties (visible, unlocked,
    /// full opacity, Normal blend mode) and a transparent pixel buffer.
    pub fn new(
        id: LayerId,
        name: String,
        width: u32,
        height: u32,
    ) -> Result<Self, DomainError> {
        if name.is_empty() {
            return Err(DomainError::EmptyName);
        }
        let buffer = PixelBuffer::new(width, height)?;
        Ok(Self {
            id,
            name,
            buffer,
            opacity: 1.0,
            blend_mode: BlendMode::default(),
            visible: true,
            locked: false,
        })
    }

    // -- Getters --

    pub fn id(&self) -> LayerId {
        self.id
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn buffer(&self) -> &PixelBuffer {
        &self.buffer
    }

    pub fn opacity(&self) -> f32 {
        self.opacity
    }

    pub fn blend_mode(&self) -> BlendMode {
        self.blend_mode
    }

    pub fn is_visible(&self) -> bool {
        self.visible
    }

    pub fn is_locked(&self) -> bool {
        self.locked
    }

    // -- Setters --

    pub fn set_pixel(&mut self, x: u32, y: u32, color: Color) -> Result<(), DomainError> {
        if self.locked {
            return Err(DomainError::LayerLocked { layer_id: self.id.value() });
        }
        self.buffer.set_pixel(x, y, color)
    }

    pub fn set_opacity(&mut self, value: f32) {
        self.opacity = value.clamp(0.0, 1.0);
    }

    pub fn set_visible(&mut self, visible: bool) {
        self.visible = visible;
    }

    pub fn set_locked(&mut self, locked: bool) {
        self.locked = locked;
    }

    pub fn set_blend_mode(&mut self, mode: BlendMode) {
        self.blend_mode = mode;
    }

    pub fn set_name(&mut self, name: String) -> Result<(), DomainError> {
        if name.is_empty() {
            return Err(DomainError::EmptyName);
        }
        self.name = name;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_layer() -> Layer {
        Layer::new(LayerId::new(1), "test".to_string(), 4, 4).unwrap()
    }

    #[test]
    fn new_with_defaults() {
        let layer = test_layer();
        assert_eq!(layer.id(), LayerId::new(1));
        assert_eq!(layer.name(), "test");
        assert_eq!(layer.opacity(), 1.0);
        assert_eq!(layer.blend_mode(), BlendMode::Normal);
        assert!(layer.is_visible());
        assert!(!layer.is_locked());
        assert_eq!(layer.buffer().width(), 4);
        assert_eq!(layer.buffer().height(), 4);
    }

    #[test]
    fn new_rejects_empty_name() {
        let err = Layer::new(LayerId::new(1), String::new(), 4, 4).unwrap_err();
        assert_eq!(err, DomainError::EmptyName);
    }

    #[test]
    fn set_pixel_works() {
        let mut layer = test_layer();
        layer.set_pixel(0, 0, Color::WHITE).unwrap();
        assert_eq!(layer.buffer().get_pixel(0, 0).unwrap(), Color::WHITE);
    }

    #[test]
    fn locked_layer_rejects_writes() {
        let mut layer = test_layer();
        layer.set_locked(true);
        let err = layer.set_pixel(0, 0, Color::WHITE).unwrap_err();
        assert_eq!(err, DomainError::LayerLocked { layer_id: 1 });
    }

    #[test]
    fn set_pixel_propagates_out_of_bounds() {
        let mut layer = test_layer();
        let err = layer.set_pixel(10, 10, Color::WHITE).unwrap_err();
        assert_eq!(
            err,
            DomainError::OutOfBounds { x: 10, y: 10, width: 4, height: 4 }
        );
    }

    #[test]
    fn opacity_clamped_high() {
        let mut layer = test_layer();
        layer.set_opacity(1.5);
        assert_eq!(layer.opacity(), 1.0);
    }

    #[test]
    fn opacity_clamped_low() {
        let mut layer = test_layer();
        layer.set_opacity(-0.5);
        assert_eq!(layer.opacity(), 0.0);
    }

    #[test]
    fn set_name_rejects_empty() {
        let mut layer = test_layer();
        let err = layer.set_name(String::new()).unwrap_err();
        assert_eq!(err, DomainError::EmptyName);
    }

    #[test]
    fn set_name_valid() {
        let mut layer = test_layer();
        layer.set_name("renamed".to_string()).unwrap();
        assert_eq!(layer.name(), "renamed");
    }

    #[test]
    fn toggle_visibility() {
        let mut layer = test_layer();
        layer.set_visible(false);
        assert!(!layer.is_visible());
        layer.set_visible(true);
        assert!(layer.is_visible());
    }

    #[test]
    fn set_blend_mode() {
        let mut layer = test_layer();
        layer.set_blend_mode(BlendMode::Multiply);
        assert_eq!(layer.blend_mode(), BlendMode::Multiply);
    }

    #[test]
    fn layer_id_value_accessor() {
        let id = LayerId::new(42);
        assert_eq!(id.value(), 42);
    }
}
