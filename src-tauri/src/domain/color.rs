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
}
