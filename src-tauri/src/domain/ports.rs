use super::error::DomainError;
use super::palette::{ActiveMemory, Palette, PaletteId, PaletteScope};
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

/// Port for palette CRUD in a single scope (global directory or project
/// directory). Rename is intentionally absent — `PaletteService`
/// implements rename as read→write→delete to keep adapters minimal.
/// Object-safe: `Box<dyn PaletteStore + Send + Sync>` in `PaletteService`.
pub trait PaletteStore {
    fn list(&self) -> Result<Vec<Palette>, DomainError>;
    fn read(&self, id: PaletteId) -> Result<Palette, DomainError>;
    fn write(&self, palette: &Palette) -> Result<(), DomainError>;
    fn delete(&self, id: PaletteId) -> Result<(), DomainError>;
}

/// Port for persisting [`ActiveMemory`] (per-context active-palette
/// restore — FR-023a). The on-disk shape lives in infrastructure; this
/// trait keeps `use_cases/` free of file-format knowledge.
pub trait ActiveMemoryStore {
    fn load(&self) -> Result<ActiveMemory, DomainError>;
    fn save(&self, memory: &ActiveMemory) -> Result<(), DomainError>;
}

/// Port for the `.texpal` codec. Used by `PaletteService::export_palette`
/// and `import_palette`, where serialization must happen outside of any
/// `PaletteStore` because the path is user-chosen. Infrastructure owns
/// the actual JSON shape.
pub trait PaletteCodec {
    fn encode(&self, palette: &Palette) -> Result<String, DomainError>;
    fn decode(&self, raw: &str, scope: PaletteScope) -> Result<Palette, DomainError>;
}

/// In-memory [`PaletteStore`] used across the test suite. Exposes the
/// underlying `Vec` so tests can simulate out-of-band file edits.
#[cfg(test)]
pub struct HashMapPaletteStore {
    palettes: std::sync::Mutex<Vec<Palette>>,
}

#[cfg(test)]
#[allow(dead_code)]
impl HashMapPaletteStore {
    pub fn new() -> Self {
        Self {
            palettes: std::sync::Mutex::new(Vec::new()),
        }
    }

    pub fn seed(&self, palette: Palette) {
        self.palettes.lock().expect("lock").push(palette);
    }
}

#[cfg(test)]
impl PaletteStore for HashMapPaletteStore {
    fn list(&self) -> Result<Vec<Palette>, DomainError> {
        Ok(self.palettes.lock().expect("lock").clone())
    }

    fn read(&self, id: PaletteId) -> Result<Palette, DomainError> {
        self.palettes
            .lock()
            .expect("lock")
            .iter()
            .find(|p| p.id() == id)
            .cloned()
            .ok_or(DomainError::InvalidInput {
                reason: format!("palette {:?} not found", id.to_hex_string()),
            })
    }

    fn write(&self, palette: &Palette) -> Result<(), DomainError> {
        let mut list = self.palettes.lock().expect("lock");
        if let Some(pos) = list.iter().position(|p| p.id() == palette.id()) {
            list[pos] = palette.clone();
        } else {
            list.push(palette.clone());
        }
        Ok(())
    }

    fn delete(&self, id: PaletteId) -> Result<(), DomainError> {
        let mut list = self.palettes.lock().expect("lock");
        let before = list.len();
        list.retain(|p| p.id() != id);
        if list.len() == before {
            return Err(DomainError::InvalidInput {
                reason: format!("palette {:?} not found", id.to_hex_string()),
            });
        }
        Ok(())
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use crate::domain::color::Color;
    use crate::domain::palette::{PaletteName, PaletteScope};

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

    #[test]
    fn in_memory_store_roundtrip() {
        let store = HashMapPaletteStore::new();
        let id = PaletteId::from_value(1);
        let p = Palette::new(id, PaletteName::new("Blues").unwrap(), PaletteScope::Global);
        store.write(&p).unwrap();
        let got = store.read(id).unwrap();
        assert_eq!(got.name().as_str(), "Blues");
        assert_eq!(store.list().unwrap().len(), 1);
    }

    #[test]
    fn in_memory_store_delete() {
        let store = HashMapPaletteStore::new();
        let id = PaletteId::from_value(42);
        store
            .write(&Palette::new(
                id,
                PaletteName::new("A").unwrap(),
                PaletteScope::Global,
            ))
            .unwrap();
        store.delete(id).unwrap();
        assert!(store.read(id).is_err());
    }

    #[test]
    fn in_memory_store_delete_missing_errors() {
        let store = HashMapPaletteStore::new();
        assert!(store.delete(PaletteId::from_value(99)).is_err());
    }
}
