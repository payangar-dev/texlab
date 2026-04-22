//! Infrastructure and I/O adapters layer.
//!
//! Implements persistence, file I/O (PNG, ZIP, JSON), and external service integrations.
//! Depends on domain types but provides concrete implementations of ports.

pub mod palette_file;
pub mod palette_state_io;
pub mod palette_store_fs;
pub mod png_reader;
pub mod png_writer;
pub mod workspace_io;
