pub mod brush;
pub mod color_picker;
pub mod eraser;
pub mod fill;
pub mod line;
pub mod selection_tool;

use super::color::Color;
use super::error::DomainError;
use super::pixel_buffer::PixelBuffer;
use super::selection::Selection;

/// Validated brush size (1..=16). Invalid values are unrepresentable.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BrushSize(u8);

impl BrushSize {
    pub const DEFAULT: Self = Self(1);

    pub fn new(size: u8) -> Result<Self, DomainError> {
        if size < 1 || size > 16 {
            return Err(DomainError::InvalidBrushSize { size });
        }
        Ok(Self(size))
    }

    pub fn value(self) -> u8 {
        self.0
    }
}

/// Parameters available to a tool during an interaction.
pub struct ToolContext<'a> {
    pub buffer: &'a mut PixelBuffer,
    pub color: Color,
    pub brush_size: BrushSize,
}

/// Outcome of a tool operation.
#[derive(Clone, Debug, PartialEq)]
pub enum ToolResult {
    PixelsModified,
    ColorPicked(Color),
    SelectionChanged(Option<Selection>),
    NoOp,
}

/// Unified interaction contract for all drawing tools.
pub trait Tool {
    fn name(&self) -> &str;
    fn on_press(
        &mut self,
        ctx: &mut ToolContext,
        x: u32,
        y: u32,
    ) -> Result<ToolResult, DomainError>;
    fn on_drag(
        &mut self,
        ctx: &mut ToolContext,
        x: u32,
        y: u32,
    ) -> Result<ToolResult, DomainError>;
    fn on_release(
        &mut self,
        ctx: &mut ToolContext,
        x: u32,
        y: u32,
    ) -> Result<ToolResult, DomainError>;
}

/// All-octant Bresenham's line algorithm, inclusive of both endpoints.
pub fn bresenham_line(x0: i32, y0: i32, x1: i32, y1: i32) -> Vec<(i32, i32)> {
    let mut points = Vec::new();

    let dx = (x1 - x0).abs();
    let dy = (y1 - y0).abs();
    let sx = if x0 < x1 { 1 } else { -1 };
    let sy = if y0 < y1 { 1 } else { -1 };
    let mut err = dx - dy;

    let mut cx = x0;
    let mut cy = y0;

    loop {
        points.push((cx, cy));
        if cx == x1 && cy == y1 {
            break;
        }
        let e2 = 2 * err;
        if e2 > -dy {
            err -= dy;
            cx += sx;
        }
        if e2 < dx {
            err += dx;
            cy += sy;
        }
    }

    points
}

pub use brush::BrushTool;
pub use color_picker::ColorPickerTool;
pub use eraser::EraserTool;
pub use fill::FillTool;
pub use line::LineTool;
pub use selection_tool::SelectionTool;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn brush_size_valid_min() {
        let bs = BrushSize::new(1).unwrap();
        assert_eq!(bs.value(), 1);
    }

    #[test]
    fn brush_size_valid_max() {
        let bs = BrushSize::new(16).unwrap();
        assert_eq!(bs.value(), 16);
    }

    #[test]
    fn brush_size_invalid_zero() {
        let err = BrushSize::new(0).unwrap_err();
        assert_eq!(err, DomainError::InvalidBrushSize { size: 0 });
    }

    #[test]
    fn brush_size_invalid_too_large() {
        let err = BrushSize::new(17).unwrap_err();
        assert_eq!(err, DomainError::InvalidBrushSize { size: 17 });
    }

    #[test]
    fn brush_size_default() {
        assert_eq!(BrushSize::DEFAULT.value(), 1);
    }

    #[test]
    fn bresenham_horizontal() {
        let pts = bresenham_line(0, 0, 5, 0);
        assert_eq!(pts.len(), 6);
        for (i, &(x, y)) in pts.iter().enumerate() {
            assert_eq!(x, i as i32);
            assert_eq!(y, 0);
        }
    }

    #[test]
    fn bresenham_vertical() {
        let pts = bresenham_line(3, 0, 3, 4);
        assert_eq!(pts.len(), 5);
        for (i, &(x, y)) in pts.iter().enumerate() {
            assert_eq!(x, 3);
            assert_eq!(y, i as i32);
        }
    }

    #[test]
    fn bresenham_diagonal() {
        let pts = bresenham_line(0, 0, 4, 4);
        assert_eq!(pts.len(), 5);
        for (i, &(x, y)) in pts.iter().enumerate() {
            assert_eq!(x, i as i32);
            assert_eq!(y, i as i32);
        }
    }

    #[test]
    fn bresenham_single_point() {
        let pts = bresenham_line(3, 7, 3, 7);
        assert_eq!(pts, vec![(3, 7)]);
    }

    #[test]
    fn bresenham_steep_slope() {
        let pts = bresenham_line(0, 0, 1, 5);
        assert_eq!(pts.len(), 6);
        assert_eq!(pts[0], (0, 0));
        assert_eq!(pts[pts.len() - 1], (1, 5));
    }

    #[test]
    fn bresenham_all_points_connected() {
        let pts = bresenham_line(0, 0, 7, 3);
        for i in 1..pts.len() {
            let (px, py) = pts[i - 1];
            let (cx, cy) = pts[i];
            let dx = (cx - px).abs();
            let dy = (cy - py).abs();
            assert!(
                dx <= 1 && dy <= 1,
                "gap between ({px},{py}) and ({cx},{cy})"
            );
        }
    }

    #[test]
    fn bresenham_reverse_direction() {
        let forward = bresenham_line(0, 0, 5, 3);
        let reverse = bresenham_line(5, 3, 0, 0);
        let mut rev_sorted = reverse.clone();
        rev_sorted.reverse();
        assert_eq!(forward, rev_sorted);
    }

    #[test]
    fn bresenham_negative_coordinates() {
        let pts = bresenham_line(-3, -2, 2, 1);
        assert_eq!(pts[0], (-3, -2));
        assert_eq!(pts[pts.len() - 1], (2, 1));
        for i in 1..pts.len() {
            let (px, py) = pts[i - 1];
            let (cx, cy) = pts[i];
            let dx = (cx - px).abs();
            let dy = (cy - py).abs();
            assert!(
                dx <= 1 && dy <= 1,
                "gap between ({px},{py}) and ({cx},{cy})"
            );
        }
    }
}
