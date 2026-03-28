use std::fmt;

/// Domain-specific error type. Uses only `std` (no thiserror).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DomainError {
    InvalidDimensions {
        width: u32,
        height: u32,
    },
    OutOfBounds {
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    },
    LayerLocked {
        layer_id: u128,
    },
    LayerNotFound {
        layer_id: u128,
    },
    InvalidIndex {
        index: usize,
        len: usize,
    },
    EmptyName,
    EmptyNamespace,
    EmptyPath,
    IoError {
        reason: String,
    },
}

impl fmt::Display for DomainError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidDimensions { width, height } => {
                write!(f, "invalid dimensions: {width}x{height} (must be > 0)")
            }
            Self::OutOfBounds {
                x,
                y,
                width,
                height,
            } => {
                write!(
                    f,
                    "pixel ({x}, {y}) out of bounds for {width}x{height} buffer"
                )
            }
            Self::LayerLocked { layer_id } => {
                write!(f, "layer {layer_id} is locked")
            }
            Self::LayerNotFound { layer_id } => {
                write!(f, "layer {layer_id} not found")
            }
            Self::InvalidIndex { index, len } => {
                write!(f, "index {index} out of range for stack of length {len}")
            }
            Self::EmptyName => write!(f, "name must not be empty"),
            Self::EmptyNamespace => write!(f, "namespace must not be empty"),
            Self::EmptyPath => write!(f, "path must not be empty"),
            Self::IoError { reason } => write!(f, "I/O error: {reason}"),
        }
    }
}

impl std::error::Error for DomainError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_invalid_dimensions() {
        let err = DomainError::InvalidDimensions {
            width: 0,
            height: 16,
        };
        assert_eq!(err.to_string(), "invalid dimensions: 0x16 (must be > 0)");
    }

    #[test]
    fn display_out_of_bounds() {
        let err = DomainError::OutOfBounds {
            x: 20,
            y: 5,
            width: 16,
            height: 16,
        };
        assert_eq!(
            err.to_string(),
            "pixel (20, 5) out of bounds for 16x16 buffer"
        );
    }

    #[test]
    fn display_layer_locked() {
        let err = DomainError::LayerLocked { layer_id: 42 };
        assert_eq!(err.to_string(), "layer 42 is locked");
    }

    #[test]
    fn display_layer_not_found() {
        let err = DomainError::LayerNotFound { layer_id: 99 };
        assert_eq!(err.to_string(), "layer 99 not found");
    }

    #[test]
    fn display_invalid_index() {
        let err = DomainError::InvalidIndex { index: 5, len: 3 };
        assert_eq!(
            err.to_string(),
            "index 5 out of range for stack of length 3"
        );
    }

    #[test]
    fn display_empty_name() {
        let err = DomainError::EmptyName;
        assert_eq!(err.to_string(), "name must not be empty");
    }

    #[test]
    fn display_empty_namespace() {
        let err = DomainError::EmptyNamespace;
        assert_eq!(err.to_string(), "namespace must not be empty");
    }

    #[test]
    fn display_empty_path() {
        let err = DomainError::EmptyPath;
        assert_eq!(err.to_string(), "path must not be empty");
    }

    #[test]
    fn display_io_error() {
        let err = DomainError::IoError {
            reason: "file not found".into(),
        };
        assert_eq!(err.to_string(), "I/O error: file not found");
    }

    #[test]
    fn error_trait_is_implemented() {
        let err: &dyn std::error::Error = &DomainError::EmptyName;
        assert!(err.source().is_none());
    }

    #[test]
    fn error_is_cloneable() {
        let err = DomainError::EmptyName;
        assert_eq!(err.clone(), err);
    }
}
