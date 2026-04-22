//! Codec + atomic writer for `<app_data_dir>/palette-state.json`.
//!
//! Holds the active-palette memory used by [`PaletteService`] to implement
//! FR-023a (remember-last-selection per context). Corrupt or missing files
//! recover to an empty memory — losing the restore feature is not fatal.
//!
//! The module exposes [`FsActiveMemoryStore`], the default implementation
//! of the [`ActiveMemoryStore`] port. Use-cases depend on the port, not
//! on this module (Principle I).

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::domain::{ActiveMemory, ActiveMemoryStore, DomainError, PaletteId};

const STATE_FILE: &str = "palette-state.json";
const STATE_VERSION: u32 = 1;

#[derive(Debug, Default, Serialize, Deserialize, Clone)]
pub struct ActiveMemoryFile {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub global: Option<String>,
    #[serde(default)]
    pub projects: HashMap<String, String>,
}

fn default_version() -> u32 {
    STATE_VERSION
}

impl ActiveMemoryFile {
    pub fn empty() -> Self {
        Self {
            version: STATE_VERSION,
            global: None,
            projects: HashMap::new(),
        }
    }
}

pub fn state_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(STATE_FILE)
}

/// Reads and parses the state file. A missing file yields an empty memory.
/// A corrupt file logs a warning and also yields empty memory so the app
/// boots cleanly.
pub fn read(app_data_dir: &Path) -> Result<ActiveMemoryFile, std::io::Error> {
    let path = state_path(app_data_dir);
    let raw = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Ok(ActiveMemoryFile::empty());
        }
        Err(e) => return Err(e),
    };
    match serde_json::from_str::<ActiveMemoryFile>(&raw) {
        Ok(file) if file.version == STATE_VERSION => Ok(file),
        Ok(file) => {
            eprintln!(
                "[palette-state] unsupported version {}, discarding memory",
                file.version
            );
            Ok(ActiveMemoryFile::empty())
        }
        Err(e) => {
            eprintln!("[palette-state] parse error {e}, discarding memory");
            Ok(ActiveMemoryFile::empty())
        }
    }
}

/// Writes the state atomically (`.tmp` + rename) so an interrupted write
/// leaves the previous file intact.
pub fn write(app_data_dir: &Path, memory: &ActiveMemoryFile) -> Result<(), std::io::Error> {
    std::fs::create_dir_all(app_data_dir)?;
    let json = serde_json::to_string_pretty(memory)
        .map_err(|e| std::io::Error::other(format!("palette-state encode: {e}")))?;
    let final_path = state_path(app_data_dir);
    let tmp_path = final_path.with_extension("json.tmp");
    std::fs::write(&tmp_path, json)?;
    std::fs::rename(&tmp_path, &final_path)
}

fn to_wire(mem: &ActiveMemory) -> ActiveMemoryFile {
    ActiveMemoryFile {
        version: STATE_VERSION,
        global: mem.global.map(|id| id.to_hex_string()),
        projects: mem
            .projects
            .iter()
            .map(|(path, id)| (path.to_string_lossy().into_owned(), id.to_hex_string()))
            .collect(),
    }
}

fn from_wire(file: ActiveMemoryFile) -> ActiveMemory {
    let global = file
        .global
        .as_deref()
        .and_then(|s| PaletteId::from_hex(s).ok());
    let projects = file
        .projects
        .into_iter()
        .filter_map(|(path, id)| {
            PaletteId::from_hex(&id)
                .ok()
                .map(|pid| (PathBuf::from(path), pid))
        })
        .collect();
    ActiveMemory { global, projects }
}

/// Filesystem implementation of [`ActiveMemoryStore`]. Bound to
/// `<app_data_dir>/palette-state.json`.
pub struct FsActiveMemoryStore {
    app_data_dir: PathBuf,
}

impl FsActiveMemoryStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self { app_data_dir }
    }
}

impl ActiveMemoryStore for FsActiveMemoryStore {
    fn load(&self) -> Result<ActiveMemory, DomainError> {
        read(&self.app_data_dir)
            .map(from_wire)
            .map_err(|e| DomainError::IoError {
                reason: e.to_string(),
            })
    }

    fn save(&self, memory: &ActiveMemory) -> Result<(), DomainError> {
        write(&self.app_data_dir, &to_wire(memory)).map_err(|e| DomainError::IoError {
            reason: e.to_string(),
        })
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("texlab_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    fn cleanup(dir: &Path) {
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn read_missing_returns_empty() {
        let dir = temp_dir();
        let mem = read(&dir).unwrap();
        assert!(mem.global.is_none());
        assert!(mem.projects.is_empty());
        cleanup(&dir);
    }

    #[test]
    fn write_then_read_roundtrip() {
        let dir = temp_dir();
        let mut mem = ActiveMemoryFile::empty();
        mem.global = Some("aa".into());
        mem.projects.insert("C:/p".into(), "bb".into());
        write(&dir, &mem).unwrap();

        let loaded = read(&dir).unwrap();
        assert_eq!(loaded.global.as_deref(), Some("aa"));
        assert_eq!(loaded.projects.get("C:/p"), Some(&"bb".to_string()));
        cleanup(&dir);
    }

    #[test]
    fn corrupt_file_recovers_to_empty() {
        let dir = temp_dir();
        std::fs::write(state_path(&dir), "{not json").unwrap();
        let loaded = read(&dir).unwrap();
        assert!(loaded.global.is_none());
        assert!(loaded.projects.is_empty());
        cleanup(&dir);
    }

    #[test]
    fn unsupported_version_recovers_to_empty() {
        let dir = temp_dir();
        std::fs::write(
            state_path(&dir),
            r#"{"version":99,"global":"x","projects":{}}"#,
        )
        .unwrap();
        let loaded = read(&dir).unwrap();
        assert!(loaded.global.is_none());
        cleanup(&dir);
    }

    #[test]
    fn atomic_write_no_tmp_left() {
        let dir = temp_dir();
        write(&dir, &ActiveMemoryFile::empty()).unwrap();
        let entries: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok().map(|d| d.file_name()))
            .collect();
        assert!(entries.iter().all(|n| n != "palette-state.json.tmp"));
        cleanup(&dir);
    }

    #[test]
    fn fs_memory_store_roundtrips_via_port() {
        let dir = temp_dir();
        let store = FsActiveMemoryStore::new(dir.clone());
        let mut mem = ActiveMemory {
            global: Some(PaletteId::from_value(0xabcd)),
            ..Default::default()
        };
        mem.projects
            .insert(PathBuf::from("C:/proj"), PaletteId::from_value(0xbeef));
        store.save(&mem).unwrap();

        let loaded = store.load().unwrap();
        assert_eq!(loaded.global, Some(PaletteId::from_value(0xabcd)));
        assert_eq!(
            loaded.projects.get(&PathBuf::from("C:/proj")),
            Some(&PaletteId::from_value(0xbeef))
        );
        cleanup(&dir);
    }

    #[test]
    fn fs_memory_store_load_missing_returns_default() {
        let dir = temp_dir().join("missing");
        let store = FsActiveMemoryStore::new(dir);
        let mem = store.load().unwrap();
        assert!(mem.global.is_none());
        assert!(mem.projects.is_empty());
    }
}
