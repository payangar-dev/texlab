//! Filesystem-backed [`PaletteStore`] implementation.
//!
//! Each palette lives as a single `.texpal` file under a directory bound
//! to a scope (global = `<app_data_dir>/palettes/`, project =
//! `<project>/palettes/`). The basename is derived from the palette name
//! via [`sanitize_basename`].
//!
//! Errors are mapped into [`DomainError`] so the port contract stays pure.

use std::path::{Path, PathBuf};

use crate::domain::{DomainError, Palette, PaletteId, PaletteScope, PaletteStore};
use crate::infrastructure::palette_file::{decode, encode};

const EXTENSION: &str = "texpal";

pub struct FilesystemPaletteStore {
    root: PathBuf,
    scope: PaletteScope,
}

impl FilesystemPaletteStore {
    /// Constructs a store rooted at the given directory. The directory is
    /// created lazily on first `write`.
    pub fn new(root: PathBuf, scope: PaletteScope) -> Self {
        Self { root, scope }
    }

    fn ensure_root(&self) -> Result<(), DomainError> {
        if !self.root.exists() {
            std::fs::create_dir_all(&self.root).map_err(io_err)?;
        }
        Ok(())
    }

    /// Returns all entries in the store directory (may be empty). Missing
    /// directory is treated as an empty store. Unreadable entries are
    /// logged and skipped so a single bad file doesn't hide the rest.
    fn list_dir(&self) -> Result<Vec<PathBuf>, DomainError> {
        if !self.root.exists() {
            return Ok(Vec::new());
        }
        let mut entries = Vec::new();
        for entry in std::fs::read_dir(&self.root).map_err(io_err)? {
            match entry {
                Ok(e) => {
                    let p = e.path();
                    if p.extension().and_then(|s| s.to_str()) == Some(EXTENSION) {
                        entries.push(p);
                    }
                }
                Err(e) => eprintln!(
                    "[palette_store_fs] skipped unreadable entry in {}: {e}",
                    self.root.display()
                ),
            }
        }
        entries.sort();
        Ok(entries)
    }

    fn destination_path(&self, palette: &Palette) -> Result<PathBuf, DomainError> {
        let base = sanitize_basename(palette.name().as_str());
        let mut candidate = self.root.join(format!("{base}.{EXTENSION}"));

        // If a file already exists for a *different* id, suffix with the
        // first 8 hex chars of this palette's id to keep both on disk.
        if candidate.exists() {
            if let Ok(existing) = read_palette(&candidate, self.scope) {
                if existing.id() == palette.id() {
                    return Ok(candidate);
                }
            }
            let suffix = &palette.id().to_hex_string()[..8];
            candidate = self.root.join(format!("{base}-{suffix}.{EXTENSION}"));
        }
        Ok(candidate)
    }

    fn find_existing_path(&self, id: PaletteId) -> Result<Option<PathBuf>, DomainError> {
        for path in self.list_dir()? {
            match read_palette(&path, self.scope) {
                Ok(p) if p.id() == id => return Ok(Some(path)),
                Ok(_) => {}
                Err(e) => eprintln!(
                    "[palette_store_fs] skipped unreadable palette {}: {e}",
                    path.display()
                ),
            }
        }
        Ok(None)
    }
}

fn io_err(e: std::io::Error) -> DomainError {
    DomainError::IoError {
        reason: e.to_string(),
    }
}

fn read_palette(path: &Path, scope: PaletteScope) -> Result<Palette, DomainError> {
    let raw = std::fs::read_to_string(path).map_err(io_err)?;
    decode(&raw, scope).map_err(|e| DomainError::InvalidInput {
        reason: e.to_string(),
    })
}

/// Derives a Windows/NTFS-safe filesystem basename from a palette name.
/// Replaces reserved chars (`< > : " / \ | ? *` + ASCII controls + NUL)
/// with `_`, trims trailing dots and spaces, and falls back to `palette`
/// if the result is empty. No Unicode normalization is applied.
pub fn sanitize_basename(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    for ch in name.chars() {
        if matches!(ch, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') || (ch as u32) < 0x20
        {
            out.push('_');
        } else {
            out.push(ch);
        }
    }
    while matches!(out.chars().last(), Some('.') | Some(' ')) {
        out.pop();
    }
    if out.is_empty() {
        out.push_str("palette");
    }
    out
}

impl PaletteStore for FilesystemPaletteStore {
    fn list(&self) -> Result<Vec<Palette>, DomainError> {
        let mut palettes = Vec::new();
        for path in self.list_dir()? {
            match read_palette(&path, self.scope) {
                Ok(p) => palettes.push(p),
                Err(e) => eprintln!(
                    "[palette_store_fs] skipped unreadable palette {}: {e}",
                    path.display()
                ),
            }
        }
        palettes.sort_by(|a, b| a.name().as_str().cmp(b.name().as_str()));
        Ok(palettes)
    }

    fn read(&self, id: PaletteId) -> Result<Palette, DomainError> {
        match self.find_existing_path(id)? {
            Some(path) => read_palette(&path, self.scope),
            None => Err(DomainError::InvalidInput {
                reason: format!("palette {} not found", id.to_hex_string()),
            }),
        }
    }

    fn write(&self, palette: &Palette) -> Result<(), DomainError> {
        self.ensure_root()?;

        // Remove any previous file belonging to this id at a stale basename
        // (rename flow: basename changes when the user renames the palette).
        if let Some(existing) = self.find_existing_path(palette.id())? {
            let target = self.destination_path(palette)?;
            if existing != target {
                std::fs::remove_file(&existing).map_err(io_err)?;
            }
        }

        let path = self.destination_path(palette)?;
        let json = encode(palette).map_err(|e| DomainError::InvalidInput {
            reason: e.to_string(),
        })?;
        std::fs::write(&path, json).map_err(io_err)?;
        Ok(())
    }

    fn delete(&self, id: PaletteId) -> Result<(), DomainError> {
        match self.find_existing_path(id)? {
            Some(path) => std::fs::remove_file(&path).map_err(io_err),
            None => Err(DomainError::InvalidInput {
                reason: format!("palette {} not found", id.to_hex_string()),
            }),
        }
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use crate::domain::{Color, PaletteName};

    fn temp_root() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("texlab_fs_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn cleanup(dir: &Path) {
        let _ = std::fs::remove_dir_all(dir);
    }

    fn make_palette(id: u128, name: &str) -> Palette {
        let mut p = Palette::new(
            PaletteId::from_value(id),
            PaletteName::new(name).unwrap(),
            PaletteScope::Global,
        );
        p.add_color(Color::new(0x10, 0x20, 0x30, 255));
        p
    }

    #[test]
    fn sanitize_basename_replaces_reserved() {
        assert_eq!(sanitize_basename("a/b"), "a_b");
        assert_eq!(sanitize_basename("<>:\"/\\|?*"), "_________");
    }

    #[test]
    fn sanitize_basename_trims_trailing_dots_and_spaces() {
        assert_eq!(sanitize_basename("name..  "), "name");
    }

    #[test]
    fn sanitize_basename_empty_fallback() {
        assert_eq!(sanitize_basename("..."), "palette");
    }

    #[test]
    fn write_then_list_reads_it_back() {
        let root = temp_root();
        let store = FilesystemPaletteStore::new(root.clone(), PaletteScope::Global);
        store.write(&make_palette(1, "Blues")).unwrap();
        let list = store.list().unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name().as_str(), "Blues");
        cleanup(&root);
    }

    #[test]
    fn list_empty_directory_ok() {
        let root = temp_root();
        let store = FilesystemPaletteStore::new(root.clone(), PaletteScope::Global);
        assert_eq!(store.list().unwrap().len(), 0);
        cleanup(&root);
    }

    #[test]
    fn list_missing_directory_ok() {
        let root = temp_root().join("does-not-exist");
        let store = FilesystemPaletteStore::new(root, PaletteScope::Global);
        assert_eq!(store.list().unwrap().len(), 0);
    }

    #[test]
    fn write_same_id_updates_file() {
        let root = temp_root();
        let store = FilesystemPaletteStore::new(root.clone(), PaletteScope::Global);
        store.write(&make_palette(1, "Orig")).unwrap();
        let mut p = make_palette(1, "Renamed");
        p.add_color(Color::new(0xFF, 0x00, 0x00, 255));
        store.write(&p).unwrap();
        let list = store.list().unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name().as_str(), "Renamed");
        cleanup(&root);
    }

    #[test]
    fn delete_removes_file() {
        let root = temp_root();
        let store = FilesystemPaletteStore::new(root.clone(), PaletteScope::Global);
        store.write(&make_palette(1, "X")).unwrap();
        store.delete(PaletteId::from_value(1)).unwrap();
        assert_eq!(store.list().unwrap().len(), 0);
        cleanup(&root);
    }

    #[test]
    fn read_unknown_id_errors() {
        let root = temp_root();
        let store = FilesystemPaletteStore::new(root.clone(), PaletteScope::Global);
        assert!(store.read(PaletteId::from_value(99)).is_err());
        cleanup(&root);
    }

    #[test]
    fn name_collision_on_different_ids_suffixes() {
        let root = temp_root();
        let store = FilesystemPaletteStore::new(root.clone(), PaletteScope::Global);
        store.write(&make_palette(1, "Name")).unwrap();
        store.write(&make_palette(2, "Name")).unwrap();
        let files: Vec<_> = std::fs::read_dir(&root)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(files.len(), 2, "both palettes must persist: {files:?}");
        cleanup(&root);
    }

    #[test]
    fn list_stable_alphabetical_order() {
        let root = temp_root();
        let store = FilesystemPaletteStore::new(root.clone(), PaletteScope::Global);
        store.write(&make_palette(1, "Charlie")).unwrap();
        store.write(&make_palette(2, "Alpha")).unwrap();
        store.write(&make_palette(3, "Bravo")).unwrap();
        let names: Vec<_> = store
            .list()
            .unwrap()
            .into_iter()
            .map(|p| p.name().as_str().to_owned())
            .collect();
        assert_eq!(names, vec!["Alpha", "Bravo", "Charlie"]);
        cleanup(&root);
    }
}
