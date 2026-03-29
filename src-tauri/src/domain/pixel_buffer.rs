use super::color::Color;
use super::error::DomainError;

/// Rectangular grid of RGBA pixels.
///
/// Byte layout: row-major, 4 bytes per pixel in RGBA order.
/// Total size: `width * height * 4` bytes.
#[derive(Debug, Clone)]
pub struct PixelBuffer {
    width: u32,
    height: u32,
    data: Vec<u8>,
}

impl PixelBuffer {
    /// Creates a new buffer filled with transparent pixels.
    /// Returns an error if width or height is zero.
    pub fn new(width: u32, height: u32) -> Result<Self, DomainError> {
        if width == 0 || height == 0 {
            return Err(DomainError::InvalidDimensions { width, height });
        }
        let size = (width as usize) * (height as usize) * 4;
        Ok(Self {
            width,
            height,
            data: vec![0; size],
        })
    }

    /// Creates a buffer from pre-existing RGBA pixel data.
    pub fn from_raw_parts(width: u32, height: u32, data: Vec<u8>) -> Result<Self, DomainError> {
        if width == 0 || height == 0 {
            return Err(DomainError::InvalidDimensions { width, height });
        }
        let expected = (width as usize) * (height as usize) * 4;
        if data.len() != expected {
            return Err(DomainError::BufferSizeMismatch {
                expected,
                actual: data.len(),
            });
        }
        Ok(Self { width, height, data })
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    /// Returns raw RGBA pixel data. Layout: row-major, 4 bytes per pixel (R, G, B, A).
    pub fn pixels(&self) -> &[u8] {
        &self.data
    }

    fn index(&self, x: u32, y: u32) -> Result<usize, DomainError> {
        if x >= self.width || y >= self.height {
            return Err(DomainError::OutOfBounds {
                x,
                y,
                width: self.width,
                height: self.height,
            });
        }
        Ok(((y as usize) * (self.width as usize) + (x as usize)) * 4)
    }

    pub fn get_pixel(&self, x: u32, y: u32) -> Result<Color, DomainError> {
        let i = self.index(x, y)?;
        Ok(Color::new(
            self.data[i],
            self.data[i + 1],
            self.data[i + 2],
            self.data[i + 3],
        ))
    }

    pub fn set_pixel(&mut self, x: u32, y: u32, color: Color) -> Result<(), DomainError> {
        let i = self.index(x, y)?;
        self.data[i] = color.r();
        self.data[i + 1] = color.g();
        self.data[i + 2] = color.b();
        self.data[i + 3] = color.a();
        Ok(())
    }

    /// Fills a rectangular region, clipping silently to buffer bounds.
    pub fn fill_rect(&mut self, x: u32, y: u32, w: u32, h: u32, color: Color) {
        let x_start = x.min(self.width);
        let y_start = y.min(self.height);
        let x_end = (x.saturating_add(w)).min(self.width);
        let y_end = (y.saturating_add(h)).min(self.height);

        for py in y_start..y_end {
            for px in x_start..x_end {
                let i = ((py as usize) * (self.width as usize) + (px as usize)) * 4;
                self.data[i] = color.r();
                self.data[i + 1] = color.g();
                self.data[i + 2] = color.b();
                self.data[i + 3] = color.a();
            }
        }
    }

    /// Returns an independent copy of the raw pixel data.
    pub fn clone_data(&self) -> Vec<u8> {
        self.data.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_creates_transparent_buffer() {
        let buf = PixelBuffer::new(4, 4).unwrap();
        assert_eq!(buf.width(), 4);
        assert_eq!(buf.height(), 4);
        assert_eq!(buf.pixels().len(), 4 * 4 * 4);
        assert!(buf.pixels().iter().all(|&b| b == 0));
    }

    #[test]
    fn new_rejects_zero_width() {
        let err = PixelBuffer::new(0, 10).unwrap_err();
        assert_eq!(
            err,
            DomainError::InvalidDimensions {
                width: 0,
                height: 10
            }
        );
    }

    #[test]
    fn new_rejects_zero_height() {
        let err = PixelBuffer::new(10, 0).unwrap_err();
        assert_eq!(
            err,
            DomainError::InvalidDimensions {
                width: 10,
                height: 0
            }
        );
    }

    #[test]
    fn get_set_roundtrip() {
        let mut buf = PixelBuffer::new(8, 8).unwrap();
        let red = Color::new(255, 0, 0, 255);
        buf.set_pixel(3, 5, red).unwrap();
        assert_eq!(buf.get_pixel(3, 5).unwrap(), red);
    }

    #[test]
    fn get_pixel_out_of_bounds() {
        let buf = PixelBuffer::new(4, 4).unwrap();
        let err = buf.get_pixel(4, 0).unwrap_err();
        assert_eq!(
            err,
            DomainError::OutOfBounds {
                x: 4,
                y: 0,
                width: 4,
                height: 4
            }
        );
    }

    #[test]
    fn set_pixel_out_of_bounds() {
        let mut buf = PixelBuffer::new(4, 4).unwrap();
        let err = buf.set_pixel(0, 4, Color::BLACK).unwrap_err();
        assert_eq!(
            err,
            DomainError::OutOfBounds {
                x: 0,
                y: 4,
                width: 4,
                height: 4
            }
        );
    }

    #[test]
    fn fill_rect_fills_correctly() {
        let mut buf = PixelBuffer::new(4, 4).unwrap();
        let blue = Color::new(0, 0, 255, 255);
        buf.fill_rect(1, 1, 2, 2, blue);

        assert_eq!(buf.get_pixel(1, 1).unwrap(), blue);
        assert_eq!(buf.get_pixel(2, 2).unwrap(), blue);
        assert_eq!(buf.get_pixel(0, 0).unwrap(), Color::TRANSPARENT);
        assert_eq!(buf.get_pixel(3, 3).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn fill_rect_clips_at_edges() {
        let mut buf = PixelBuffer::new(4, 4).unwrap();
        let green = Color::new(0, 255, 0, 255);
        buf.fill_rect(2, 2, 10, 10, green);

        assert_eq!(buf.get_pixel(2, 2).unwrap(), green);
        assert_eq!(buf.get_pixel(3, 3).unwrap(), green);
        assert_eq!(buf.get_pixel(1, 1).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn fill_rect_fully_outside_is_noop() {
        let mut buf = PixelBuffer::new(4, 4).unwrap();
        buf.fill_rect(10, 10, 5, 5, Color::WHITE);
        assert!(buf.pixels().iter().all(|&b| b == 0));
    }

    #[test]
    fn fill_rect_zero_width_is_noop() {
        let mut buf = PixelBuffer::new(4, 4).unwrap();
        buf.fill_rect(0, 0, 0, 4, Color::WHITE);
        assert!(buf.pixels().iter().all(|&b| b == 0));
    }

    #[test]
    fn fill_rect_zero_height_is_noop() {
        let mut buf = PixelBuffer::new(4, 4).unwrap();
        buf.fill_rect(0, 0, 4, 0, Color::WHITE);
        assert!(buf.pixels().iter().all(|&b| b == 0));
    }

    #[test]
    fn clone_data_is_independent() {
        let mut buf = PixelBuffer::new(2, 2).unwrap();
        buf.set_pixel(0, 0, Color::WHITE).unwrap();
        let cloned = buf.clone_data();
        buf.set_pixel(0, 0, Color::BLACK).unwrap();

        assert_eq!(cloned[0], 255);
        assert_eq!(cloned[1], 255);
        assert_eq!(cloned[2], 255);
        assert_eq!(cloned[3], 255);
    }
}
