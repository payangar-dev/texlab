/// Rectangular selection region with normalized coordinates.
/// Invariant: left ≤ right, top ≤ bottom.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Selection {
    left: u32,
    top: u32,
    right: u32,
    bottom: u32,
}

impl Selection {
    /// Creates a new selection, normalizing coordinates so (left, top) is always the min corner.
    pub fn new(x1: u32, y1: u32, x2: u32, y2: u32) -> Self {
        Self {
            left: x1.min(x2),
            top: y1.min(y2),
            right: x1.max(x2),
            bottom: y1.max(y2),
        }
    }

    pub fn left(&self) -> u32 {
        self.left
    }
    pub fn top(&self) -> u32 {
        self.top
    }
    pub fn right(&self) -> u32 {
        self.right
    }
    pub fn bottom(&self) -> u32 {
        self.bottom
    }

    /// Width in pixels (inclusive).
    pub fn width(&self) -> u32 {
        self.right - self.left + 1
    }

    /// Height in pixels (inclusive).
    pub fn height(&self) -> u32 {
        self.bottom - self.top + 1
    }

    /// Returns true if (x, y) is within the selection bounds (inclusive).
    pub fn contains(&self, x: u32, y: u32) -> bool {
        x >= self.left && x <= self.right && y >= self.top && y <= self.bottom
    }

    /// Clips this selection to canvas dimensions. Returns None if fully outside.
    /// canvas_width and canvas_height define the valid pixel range [0, w-1] and [0, h-1].
    pub fn clip(self, canvas_width: u32, canvas_height: u32) -> Option<Self> {
        if canvas_width == 0 || canvas_height == 0 {
            return None;
        }
        let max_x = canvas_width - 1;
        let max_y = canvas_height - 1;

        if self.left > max_x || self.top > max_y {
            return None;
        }

        Some(Self {
            left: self.left,
            top: self.top,
            right: self.right.min(max_x),
            bottom: self.bottom.min(max_y),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalization() {
        let sel = Selection::new(5, 10, 2, 3);
        assert_eq!(sel.left(), 2);
        assert_eq!(sel.top(), 3);
        assert_eq!(sel.right(), 5);
        assert_eq!(sel.bottom(), 10);
    }

    #[test]
    fn accessors() {
        let sel = Selection::new(1, 2, 4, 6);
        assert_eq!(sel.left(), 1);
        assert_eq!(sel.top(), 2);
        assert_eq!(sel.right(), 4);
        assert_eq!(sel.bottom(), 6);
        assert_eq!(sel.width(), 4);  // 4 - 1 + 1 = 4
        assert_eq!(sel.height(), 5); // 6 - 2 + 1 = 5
    }

    #[test]
    fn contains_inside() {
        let sel = Selection::new(2, 3, 8, 7);
        assert!(sel.contains(5, 5));
    }

    #[test]
    fn contains_edge() {
        let sel = Selection::new(2, 3, 8, 7);
        assert!(sel.contains(2, 3));   // top-left corner
        assert!(sel.contains(8, 7));   // bottom-right corner
        assert!(sel.contains(2, 7));   // bottom-left corner
        assert!(sel.contains(8, 3));   // top-right corner
    }

    #[test]
    fn contains_outside() {
        let sel = Selection::new(2, 3, 8, 7);
        assert!(!sel.contains(1, 5));  // left of selection
        assert!(!sel.contains(9, 5));  // right of selection
        assert!(!sel.contains(5, 2));  // above selection
        assert!(!sel.contains(5, 8));  // below selection
    }

    #[test]
    fn clip_fully_inside() {
        let sel = Selection::new(2, 3, 8, 7);
        let clipped = sel.clip(16, 16).unwrap();
        assert_eq!(clipped.left(), 2);
        assert_eq!(clipped.top(), 3);
        assert_eq!(clipped.right(), 8);
        assert_eq!(clipped.bottom(), 7);
    }

    #[test]
    fn clip_partial() {
        let sel = Selection::new(6, 6, 20, 20);
        let clipped = sel.clip(16, 16).unwrap();
        assert_eq!(clipped.left(), 6);
        assert_eq!(clipped.top(), 6);
        assert_eq!(clipped.right(), 15); // clamped to canvas_width - 1
        assert_eq!(clipped.bottom(), 15); // clamped to canvas_height - 1
    }

    #[test]
    fn clip_fully_outside() {
        let sel = Selection::new(20, 20, 30, 30);
        assert!(sel.clip(16, 16).is_none());
    }

    #[test]
    fn zero_area_selection() {
        let sel = Selection::new(3, 3, 3, 3);
        assert_eq!(sel.width(), 1);
        assert_eq!(sel.height(), 1);
        assert!(sel.contains(3, 3));
        assert!(!sel.contains(4, 3));
    }

    #[test]
    fn clip_zero_width_canvas() {
        assert!(Selection::new(0, 0, 5, 5).clip(0, 16).is_none());
    }

    #[test]
    fn clip_zero_height_canvas() {
        assert!(Selection::new(0, 0, 5, 5).clip(16, 0).is_none());
    }
}
