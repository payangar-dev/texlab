//! Use case orchestration layer.
//!
//! Coordinates domain logic to fulfill application operations.
//! May only import from the `domain` layer — no infrastructure or framework imports.
//!
//! Use case types are public but not yet consumed by commands/ or mcp/.
#![allow(dead_code)]

pub mod editor_service;
pub mod palette_service;
