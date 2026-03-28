//! Pure domain logic layer.
//!
//! Contains business entities, value objects, and domain rules.
//! MUST NOT import from tauri, serde, image, or any infrastructure crate.
//!
//! Domain types are public but not yet consumed by commands/ or use_cases/.
//! The dead_code allow will be removed once consumers exist.
#![allow(dead_code, unused_imports)]

pub mod blend;
pub mod color;
pub mod error;
pub mod layer;
pub mod layer_stack;
pub mod pixel_buffer;
pub mod ports;
pub mod texture;

pub use blend::{blend, BlendMode};
pub use color::Color;
pub use error::DomainError;
pub use layer::{Layer, LayerId};
pub use layer_stack::LayerStack;
pub use pixel_buffer::PixelBuffer;
pub use ports::{ImageReader, ImageWriter, PackScanner, TextureEntry};
pub use texture::Texture;
