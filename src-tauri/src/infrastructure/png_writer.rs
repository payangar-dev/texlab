use crate::domain::ports::ImageWriter;
use crate::domain::{DomainError, PixelBuffer};

/// Writes a `PixelBuffer` to a PNG file on disk.
pub struct PngWriter;

impl ImageWriter for PngWriter {
    fn write(&self, path: &str, buffer: &PixelBuffer) -> Result<(), DomainError> {
        let img: image::RgbaImage =
            image::ImageBuffer::from_raw(buffer.width(), buffer.height(), buffer.pixels().to_vec())
                .ok_or_else(|| DomainError::BufferSizeMismatch {
                    expected: (buffer.width() * buffer.height() * 4) as usize,
                    actual: buffer.pixels().len(),
                })?;
        img.save(path).map_err(|e| DomainError::IoError {
            reason: e.to_string(),
        })
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use crate::domain::ports::ImageReader;
    use crate::infrastructure::png_reader::PngReader;

    #[test]
    fn write_then_read_roundtrip() {
        let width = 8;
        let height = 8;
        let mut data = vec![0u8; (width * height * 4) as usize];
        // Set a few pixels to known colors
        data[0] = 255; // R
        data[1] = 0; // G
        data[2] = 0; // B
        data[3] = 255; // A
                       // Last pixel
        let last = ((width * height - 1) * 4) as usize;
        data[last] = 0;
        data[last + 1] = 255;
        data[last + 2] = 0;
        data[last + 3] = 128;

        let buffer = PixelBuffer::from_raw_parts(width, height, data.clone()).unwrap();

        let tmp = std::env::temp_dir().join(format!(
            "texlab_test_roundtrip_{:?}.png",
            std::thread::current().id()
        ));
        let path = tmp.to_string_lossy().into_owned();

        let writer = PngWriter;
        writer.write(&path, &buffer).unwrap();

        let reader = PngReader;
        let read_back = reader.read(&path).unwrap();

        assert_eq!(read_back.width(), width);
        assert_eq!(read_back.height(), height);
        assert_eq!(read_back.pixels(), buffer.pixels());

        // Cleanup
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn write_to_nonexistent_directory_returns_error() {
        let buffer = PixelBuffer::new(2, 2).unwrap();
        let writer = PngWriter;
        let result = writer.write("/nonexistent/dir/out.png", &buffer);
        assert!(result.is_err());
    }
}
