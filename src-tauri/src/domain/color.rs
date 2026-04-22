use crate::domain::error::DomainError;

/// RGBA color value object.
///
/// Each channel is a `u8` (0-255), making invalid values unrepresentable.
/// Fields are private — use [`Color::new`] to construct and accessor methods to read.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Color {
    r: u8,
    g: u8,
    b: u8,
    a: u8,
}

impl Color {
    pub const TRANSPARENT: Self = Self {
        r: 0,
        g: 0,
        b: 0,
        a: 0,
    };
    pub const BLACK: Self = Self {
        r: 0,
        g: 0,
        b: 0,
        a: 255,
    };
    pub const WHITE: Self = Self {
        r: 255,
        g: 255,
        b: 255,
        a: 255,
    };

    pub fn new(r: u8, g: u8, b: u8, a: u8) -> Self {
        Self { r, g, b, a }
    }

    pub fn r(&self) -> u8 {
        self.r
    }

    pub fn g(&self) -> u8 {
        self.g
    }

    pub fn b(&self) -> u8 {
        self.b
    }

    pub fn a(&self) -> u8 {
        self.a
    }

    /// Parses an opaque `#RRGGBB` hex string into a `Color` with `a = 255`.
    /// Case-insensitive. Rejects anything that is not exactly 7 bytes with a
    /// leading `#` and six hex digits.
    pub fn from_hex_rgb(raw: &str) -> Result<Self, DomainError> {
        let bytes = raw.as_bytes();
        if bytes.len() != 7 || bytes[0] != b'#' {
            return Err(DomainError::InvalidInput {
                reason: format!("expected \"#RRGGBB\", got {raw:?}"),
            });
        }
        let parse = |i: usize| -> Result<u8, DomainError> {
            u8::from_str_radix(&raw[i..i + 2], 16).map_err(|_| DomainError::InvalidInput {
                reason: format!("invalid hex digits in {raw:?}"),
            })
        };
        Ok(Self {
            r: parse(1)?,
            g: parse(3)?,
            b: parse(5)?,
            a: 255,
        })
    }

    /// Formats this color as an uppercase `#RRGGBB` hex string.
    /// Alpha is dropped — the palette layer is opaque-only (v1).
    #[allow(clippy::wrong_self_convention)]
    pub fn to_hex_rgb(&self) -> String {
        format!("#{:02X}{:02X}{:02X}", self.r, self.g, self.b)
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn new_stores_correct_values() {
        let c = Color::new(10, 20, 30, 255);
        assert_eq!(c.r(), 10);
        assert_eq!(c.g(), 20);
        assert_eq!(c.b(), 30);
        assert_eq!(c.a(), 255);
    }

    #[test]
    fn equality_same_values() {
        let a = Color::new(100, 150, 200, 128);
        let b = Color::new(100, 150, 200, 128);
        assert_eq!(a, b);
    }

    #[test]
    fn inequality_different_values() {
        let a = Color::new(100, 150, 200, 128);
        let b = Color::new(100, 150, 200, 127);
        assert_ne!(a, b);
    }

    #[test]
    fn transparent_constant() {
        assert_eq!(Color::TRANSPARENT, Color::new(0, 0, 0, 0));
    }

    #[test]
    fn black_constant() {
        assert_eq!(Color::BLACK, Color::new(0, 0, 0, 255));
    }

    #[test]
    fn white_constant() {
        assert_eq!(Color::WHITE, Color::new(255, 255, 255, 255));
    }

    #[test]
    fn copy_semantics() {
        let a = Color::new(1, 2, 3, 4);
        let b = a;
        assert_eq!(a, b);
    }

    #[test]
    fn hash_is_consistent_with_equality() {
        use std::collections::HashSet;
        let mut set = HashSet::new();
        set.insert(Color::new(10, 20, 30, 255));
        assert!(set.contains(&Color::new(10, 20, 30, 255)));
        assert!(!set.contains(&Color::new(10, 20, 30, 254)));
    }

    #[test]
    fn from_hex_rgb_uppercase_roundtrip() {
        let c = Color::from_hex_rgb("#1A2B3C").unwrap();
        assert_eq!(c, Color::new(0x1A, 0x2B, 0x3C, 255));
        assert_eq!(c.to_hex_rgb(), "#1A2B3C");
    }

    #[test]
    fn from_hex_rgb_accepts_lowercase() {
        let c = Color::from_hex_rgb("#abcdef").unwrap();
        assert_eq!(c, Color::new(0xAB, 0xCD, 0xEF, 255));
    }

    #[test]
    fn from_hex_rgb_forces_opaque_alpha() {
        let c = Color::from_hex_rgb("#000000").unwrap();
        assert_eq!(c.a(), 255);
    }

    #[test]
    fn from_hex_rgb_rejects_missing_hash() {
        let err = Color::from_hex_rgb("FFFFFF").unwrap_err();
        assert!(matches!(err, DomainError::InvalidInput { .. }));
    }

    #[test]
    fn from_hex_rgb_rejects_short_form() {
        assert!(Color::from_hex_rgb("#FFF").is_err());
    }

    #[test]
    fn from_hex_rgb_rejects_rgba_form() {
        assert!(Color::from_hex_rgb("#FFFFFFFF").is_err());
    }

    #[test]
    fn from_hex_rgb_rejects_non_hex() {
        assert!(Color::from_hex_rgb("#GGGGGG").is_err());
    }

    #[test]
    fn to_hex_rgb_drops_alpha() {
        let c = Color::new(0x10, 0x20, 0x30, 0x40);
        assert_eq!(c.to_hex_rgb(), "#102030");
    }
}
