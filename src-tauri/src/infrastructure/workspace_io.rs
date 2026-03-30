//! Workspace file I/O for layout persistence.
//!
//! Reads and writes `workspace.json` in the app data directory.

use std::path::Path;

const WORKSPACE_FILE: &str = "workspace.json";

/// Writes JSON content to `<app_data_dir>/workspace.json`.
/// Creates parent directories if they don't exist.
pub fn write_workspace(app_data_dir: &Path, json: &str) -> Result<(), std::io::Error> {
    std::fs::create_dir_all(app_data_dir)?;
    std::fs::write(app_data_dir.join(WORKSPACE_FILE), json)
}

/// Reads `<app_data_dir>/workspace.json`.
/// Returns `Ok(None)` if the file does not exist.
pub fn read_workspace(app_data_dir: &Path) -> Result<Option<String>, std::io::Error> {
    let path = app_data_dir.join(WORKSPACE_FILE);
    match std::fs::read_to_string(&path) {
        Ok(content) => Ok(Some(content)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}

/// Deletes `<app_data_dir>/workspace.json`.
/// Returns `Ok(())` even if the file does not exist.
#[allow(dead_code)] // Tested and available for future use (e.g., reset from MCP)
pub fn delete_workspace(app_data_dir: &Path) -> Result<(), std::io::Error> {
    let path = app_data_dir.join(WORKSPACE_FILE);
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn temp_dir() -> std::path::PathBuf {
        let dir = env::temp_dir().join(format!("texlab_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    fn cleanup(dir: &Path) {
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn write_creates_file_and_parent_directories() {
        let dir = temp_dir().join("nested").join("deep");
        let content = r#"{"version":1,"dockview":{}}"#;

        write_workspace(&dir, content).expect("write_workspace should succeed");

        let read_back =
            std::fs::read_to_string(dir.join(WORKSPACE_FILE)).expect("file should exist");
        assert_eq!(read_back, content);

        cleanup(&dir);
    }

    #[test]
    fn read_returns_none_when_file_missing() {
        let dir = temp_dir();

        let result = read_workspace(&dir).expect("read_workspace should succeed");
        assert!(result.is_none());

        cleanup(&dir);
    }

    #[test]
    fn read_returns_content_when_file_exists() {
        let dir = temp_dir();
        let content = r#"{"version":1}"#;
        write_workspace(&dir, content).expect("write");

        let result = read_workspace(&dir).expect("read_workspace should succeed");
        assert_eq!(result, Some(content.to_string()));

        cleanup(&dir);
    }

    #[test]
    fn delete_succeeds_when_file_absent() {
        let dir = temp_dir();

        delete_workspace(&dir).expect("delete_workspace should succeed even when file is missing");

        cleanup(&dir);
    }

    #[test]
    fn delete_removes_existing_file() {
        let dir = temp_dir();
        write_workspace(&dir, "{}").expect("write");

        delete_workspace(&dir).expect("delete should succeed");

        assert!(!dir.join(WORKSPACE_FILE).exists());

        cleanup(&dir);
    }
}
