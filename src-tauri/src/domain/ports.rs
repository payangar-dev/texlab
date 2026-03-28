use super::error::DomainError;
use super::pixel_buffer::PixelBuffer;

/// Texture entry discovered when scanning a resource pack.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct TextureEntry {
    pub namespace: String,
    pub path: String,
}

/// Contract for loading pixel data from an external image source.
/// Object-safe: can be used as `Box<dyn ImageReader>`.
pub trait ImageReader {
    fn read(&self, path: &str) -> Result<PixelBuffer, DomainError>;
}

/// Contract for persisting pixel data to an external destination.
/// Object-safe: can be used as `Box<dyn ImageWriter>`.
pub trait ImageWriter {
    fn write(&self, path: &str, buffer: &PixelBuffer) -> Result<(), DomainError>;
}

/// Contract for enumerating texture entries within a resource pack.
/// Object-safe: can be used as `Box<dyn PackScanner>`.
pub trait PackScanner {
    fn scan(&self, path: &str) -> Result<Vec<TextureEntry>, DomainError>;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::color::Color;

    struct MockImageReader;

    impl ImageReader for MockImageReader {
        fn read(&self, _path: &str) -> Result<PixelBuffer, DomainError> {
            let mut buf = PixelBuffer::new(2, 2)?;
            buf.set_pixel(0, 0, Color::WHITE)?;
            Ok(buf)
        }
    }

    struct FailingImageReader;

    impl ImageReader for FailingImageReader {
        fn read(&self, path: &str) -> Result<PixelBuffer, DomainError> {
            Err(DomainError::IoError {
                reason: format!("file not found: {path}"),
            })
        }
    }

    struct MockImageWriter {
        written: std::cell::RefCell<bool>,
    }

    impl ImageWriter for MockImageWriter {
        fn write(&self, _path: &str, _buffer: &PixelBuffer) -> Result<(), DomainError> {
            *self.written.borrow_mut() = true;
            Ok(())
        }
    }

    struct FailingImageWriter;

    impl ImageWriter for FailingImageWriter {
        fn write(&self, path: &str, _buffer: &PixelBuffer) -> Result<(), DomainError> {
            Err(DomainError::IoError {
                reason: format!("permission denied: {path}"),
            })
        }
    }

    struct MockPackScanner;

    impl PackScanner for MockPackScanner {
        fn scan(&self, _path: &str) -> Result<Vec<TextureEntry>, DomainError> {
            Ok(vec![TextureEntry {
                namespace: "minecraft".into(),
                path: "textures/block/stone.png".into(),
            }])
        }
    }

    struct FailingPackScanner;

    impl PackScanner for FailingPackScanner {
        fn scan(&self, path: &str) -> Result<Vec<TextureEntry>, DomainError> {
            Err(DomainError::IoError {
                reason: format!("corrupt archive: {path}"),
            })
        }
    }

    #[test]
    fn mock_reader_returns_buffer() {
        let reader = MockImageReader;
        let buf = reader.read("test.png").unwrap();
        assert_eq!(buf.width(), 2);
        assert_eq!(buf.height(), 2);
        assert_eq!(buf.get_pixel(0, 0).unwrap(), Color::WHITE);
    }

    #[test]
    fn failing_reader_returns_error() {
        let reader = FailingImageReader;
        let err = reader.read("missing.png").unwrap_err();
        assert_eq!(
            err,
            DomainError::IoError {
                reason: "file not found: missing.png".into()
            }
        );
    }

    #[test]
    fn mock_writer_accepts_buffer() {
        let writer = MockImageWriter {
            written: std::cell::RefCell::new(false),
        };
        let buf = PixelBuffer::new(2, 2).unwrap();
        writer.write("out.png", &buf).unwrap();
        assert!(*writer.written.borrow());
    }

    #[test]
    fn failing_writer_returns_error() {
        let writer = FailingImageWriter;
        let buf = PixelBuffer::new(2, 2).unwrap();
        let err = writer.write("/readonly/out.png", &buf).unwrap_err();
        assert_eq!(
            err,
            DomainError::IoError {
                reason: "permission denied: /readonly/out.png".into()
            }
        );
    }

    #[test]
    fn mock_scanner_returns_entries() {
        let scanner = MockPackScanner;
        let entries = scanner.scan("pack.zip").unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].namespace, "minecraft");
        assert_eq!(entries[0].path, "textures/block/stone.png");
    }

    #[test]
    fn failing_scanner_returns_error() {
        let scanner = FailingPackScanner;
        let err = scanner.scan("corrupt.zip").unwrap_err();
        assert_eq!(
            err,
            DomainError::IoError {
                reason: "corrupt archive: corrupt.zip".into()
            }
        );
    }

    #[test]
    fn texture_entry_is_hashable() {
        use std::collections::HashSet;
        let mut set = HashSet::new();
        set.insert(TextureEntry {
            namespace: "minecraft".into(),
            path: "textures/block/stone.png".into(),
        });
        assert_eq!(set.len(), 1);
    }
}
