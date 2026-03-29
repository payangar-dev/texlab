use crate::domain::ports::ImageReader;
use crate::domain::{DomainError, PixelBuffer};

/// Reads PNG files from disk into `PixelBuffer`, normalizing all color types to RGBA8.
pub struct PngReader;

impl ImageReader for PngReader {
    fn read(&self, path: &str) -> Result<PixelBuffer, DomainError> {
        let img = image::open(path).map_err(|e| DomainError::IoError {
            reason: e.to_string(),
        })?;
        let rgba = img.to_rgba8();
        let (width, height) = (rgba.width(), rgba.height());
        let data = rgba.into_raw();
        PixelBuffer::from_raw_parts(width, height, data)
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn fixture_path(name: &str) -> String {
        let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        path.push("tests");
        path.push("fixtures");
        path.push(name);
        path.to_string_lossy().into_owned()
    }

    #[test]
    fn read_rgba_png() {
        let reader = PngReader;
        let buf = reader.read(&fixture_path("16x16_rgba.png")).unwrap();
        assert_eq!(buf.width(), 16);
        assert_eq!(buf.height(), 16);
        assert_eq!(buf.pixels().len(), 16 * 16 * 4);
    }

    #[test]
    fn read_rgb_png_converts_to_rgba() {
        let reader = PngReader;
        let buf = reader.read(&fixture_path("16x16_rgb.png")).unwrap();
        assert_eq!(buf.width(), 16);
        assert_eq!(buf.height(), 16);
        assert_eq!(buf.pixels().len(), 16 * 16 * 4);
        // RGB images converted to RGBA should have alpha = 255 for all pixels
        for y in 0..16 {
            for x in 0..16 {
                let color = buf.get_pixel(x, y).unwrap();
                assert_eq!(color.a(), 255, "pixel ({x},{y}) should have alpha 255");
            }
        }
    }

    #[test]
    fn read_transparent_png() {
        let reader = PngReader;
        let buf = reader.read(&fixture_path("32x32_transparent.png")).unwrap();
        assert_eq!(buf.width(), 32);
        assert_eq!(buf.height(), 32);
        // All pixels should be transparent
        for byte in buf.pixels().chunks(4) {
            assert_eq!(byte[3], 0, "expected fully transparent pixels");
        }
    }

    #[test]
    fn read_missing_file_returns_error() {
        let reader = PngReader;
        let result = reader.read(&fixture_path("nonexistent.png"));
        assert!(result.is_err());
    }
}
