use super::{BrushSize, DomainError, Tool, ToolContext, ToolResult};

#[derive(Default)]
pub struct BrushTool {
    last_pos: Option<(u32, u32)>,
}

impl BrushTool {
    fn stamp(&self, ctx: &mut ToolContext, x: u32, y: u32) {
        let size = ctx.brush_size.value() as u32;
        ctx.buffer.fill_rect(x, y, size, size, ctx.color);
    }
}

impl Tool for BrushTool {
    fn name(&self) -> &str {
        "Brush"
    }

    fn on_press(
        &mut self,
        ctx: &mut ToolContext,
        x: u32,
        y: u32,
    ) -> Result<ToolResult, DomainError> {
        self.stamp(ctx, x, y);
        self.last_pos = Some((x, y));
        Ok(ToolResult::PixelsModified)
    }

    fn on_drag(
        &mut self,
        ctx: &mut ToolContext,
        x: u32,
        y: u32,
    ) -> Result<ToolResult, DomainError> {
        let (x0, y0) = match self.last_pos {
            Some(pos) => pos,
            None => {
                self.stamp(ctx, x, y);
                self.last_pos = Some((x, y));
                return Ok(ToolResult::PixelsModified);
            }
        };

        let points = super::bresenham_line(x0 as i32, y0 as i32, x as i32, y as i32);
        for (px, py) in points {
            if px >= 0 && py >= 0 {
                self.stamp(ctx, px as u32, py as u32);
            }
        }

        self.last_pos = Some((x, y));
        Ok(ToolResult::PixelsModified)
    }

    fn on_release(
        &mut self,
        _ctx: &mut ToolContext,
        _x: u32,
        _y: u32,
    ) -> Result<ToolResult, DomainError> {
        self.last_pos = None;
        Ok(ToolResult::NoOp)
    }
}

#[cfg(test)]
mod tests {
    use super::super::{BrushSize, ToolContext, ToolResult};
    use crate::domain::color::Color;
    use crate::domain::pixel_buffer::PixelBuffer;

    use super::*;

    fn make_ctx(buf: &mut PixelBuffer, color: Color, size: u8) -> ToolContext<'_> {
        ToolContext {
            buffer: buf,
            color,
            brush_size: BrushSize::new(size).unwrap(),
        }
    }

    #[test]
    fn single_pixel_1px_brush() {
        let mut buf = PixelBuffer::new(10, 10).unwrap();
        let color = Color::new(255, 0, 0, 255);
        let mut tool = BrushTool::default();
        let result = tool
            .on_press(&mut make_ctx(&mut buf, color, 1), 2, 3)
            .unwrap();

        assert_eq!(result, ToolResult::PixelsModified);
        assert_eq!(buf.get_pixel(2, 3).unwrap(), color);
        // Adjacent pixels should be untouched
        assert_eq!(buf.get_pixel(1, 3).unwrap(), Color::TRANSPARENT);
        assert_eq!(buf.get_pixel(3, 3).unwrap(), Color::TRANSPARENT);
        assert_eq!(buf.get_pixel(2, 2).unwrap(), Color::TRANSPARENT);
        assert_eq!(buf.get_pixel(2, 4).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn continuous_drag_no_gaps() {
        let mut buf = PixelBuffer::new(20, 20).unwrap();
        let color = Color::new(0, 255, 0, 255);
        let mut tool = BrushTool::default();

        tool.on_press(&mut make_ctx(&mut buf, color, 1), 0, 0)
            .unwrap();
        tool.on_drag(&mut make_ctx(&mut buf, color, 1), 5, 5)
            .unwrap();

        // Verify every point along the bresenham path from (0,0) to (5,5) is painted
        let path = super::super::bresenham_line(0, 0, 5, 5);
        for (px, py) in path {
            assert_eq!(
                buf.get_pixel(px as u32, py as u32).unwrap(),
                color,
                "pixel ({px},{py}) should be painted"
            );
        }
    }

    #[test]
    fn square_stamp_2px() {
        let mut buf = PixelBuffer::new(10, 10).unwrap();
        let color = Color::new(0, 0, 255, 255);
        let mut tool = BrushTool::default();

        tool.on_press(&mut make_ctx(&mut buf, color, 2), 3, 3)
            .unwrap();

        // 2x2 square at top-left (3,3): covers (3,3), (4,3), (3,4), (4,4)
        assert_eq!(buf.get_pixel(3, 3).unwrap(), color);
        assert_eq!(buf.get_pixel(4, 3).unwrap(), color);
        assert_eq!(buf.get_pixel(3, 4).unwrap(), color);
        assert_eq!(buf.get_pixel(4, 4).unwrap(), color);
        // Outside the stamp
        assert_eq!(buf.get_pixel(2, 3).unwrap(), Color::TRANSPARENT);
        assert_eq!(buf.get_pixel(5, 3).unwrap(), Color::TRANSPARENT);
        assert_eq!(buf.get_pixel(3, 2).unwrap(), Color::TRANSPARENT);
        assert_eq!(buf.get_pixel(3, 5).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn square_stamp_4px() {
        let mut buf = PixelBuffer::new(20, 20).unwrap();
        let color = Color::new(128, 64, 32, 255);
        let mut tool = BrushTool::default();

        tool.on_press(&mut make_ctx(&mut buf, color, 4), 5, 5)
            .unwrap();

        // 4x4 square at top-left (5,5): corners are (5,5), (8,5), (5,8), (8,8)
        assert_eq!(buf.get_pixel(5, 5).unwrap(), color, "top-left corner");
        assert_eq!(buf.get_pixel(8, 5).unwrap(), color, "top-right corner");
        assert_eq!(buf.get_pixel(5, 8).unwrap(), color, "bottom-left corner");
        assert_eq!(buf.get_pixel(8, 8).unwrap(), color, "bottom-right corner");
        // Just outside
        assert_eq!(buf.get_pixel(4, 5).unwrap(), Color::TRANSPARENT);
        assert_eq!(buf.get_pixel(9, 5).unwrap(), Color::TRANSPARENT);
        assert_eq!(buf.get_pixel(5, 4).unwrap(), Color::TRANSPARENT);
        assert_eq!(buf.get_pixel(5, 9).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn stroke_clips_outside_canvas() {
        // Buffer is 4x4, press at (3,3) with a 4px brush (would overflow bounds)
        let mut buf = PixelBuffer::new(4, 4).unwrap();
        let color = Color::new(255, 255, 0, 255);
        let mut tool = BrushTool::default();

        // Should not panic
        let result = tool
            .on_press(&mut make_ctx(&mut buf, color, 4), 3, 3)
            .unwrap();

        assert_eq!(result, ToolResult::PixelsModified);
        // (3,3) is within bounds and should be painted
        assert_eq!(buf.get_pixel(3, 3).unwrap(), color);
    }

    #[test]
    fn fast_diagonal_drag_gap_free() {
        let mut buf = PixelBuffer::new(20, 20).unwrap();
        let color = Color::new(200, 100, 50, 255);
        let mut tool = BrushTool::default();

        tool.on_press(&mut make_ctx(&mut buf, color, 1), 0, 0)
            .unwrap();
        tool.on_drag(&mut make_ctx(&mut buf, color, 1), 10, 7)
            .unwrap();

        // Every point along the bresenham path must be painted
        let path = super::super::bresenham_line(0, 0, 10, 7);
        for (px, py) in &path {
            assert_eq!(
                buf.get_pixel(*px as u32, *py as u32).unwrap(),
                color,
                "pixel ({px},{py}) should be painted"
            );
        }

        // Verify no gaps: consecutive points must be at most 1 pixel apart
        for i in 1..path.len() {
            let (px, py) = path[i - 1];
            let (cx, cy) = path[i];
            let dx = (cx - px).abs();
            let dy = (cy - py).abs();
            assert!(
                dx <= 1 && dy <= 1,
                "gap between ({px},{py}) and ({cx},{cy})"
            );
        }
    }

    #[test]
    fn on_release_returns_noop() {
        let mut buf = PixelBuffer::new(10, 10).unwrap();
        let color = Color::new(255, 0, 0, 255);
        let mut tool = BrushTool::default();

        tool.on_press(&mut make_ctx(&mut buf, color, 1), 2, 2)
            .unwrap();
        let result = tool
            .on_release(&mut make_ctx(&mut buf, color, 1), 2, 2)
            .unwrap();

        assert_eq!(result, ToolResult::NoOp);
    }

    #[test]
    fn on_release_clears_state_between_strokes() {
        let color1 = Color::new(255, 0, 0, 255);
        let color2 = Color::new(0, 0, 255, 255);
        let mut tool = BrushTool::default();

        // First stroke: (0,0) → drag(5,5) → release(5,5)
        let mut buf1 = PixelBuffer::new(20, 20).unwrap();
        tool.on_press(&mut make_ctx(&mut buf1, color1, 1), 0, 0)
            .unwrap();
        tool.on_drag(&mut make_ctx(&mut buf1, color1, 1), 5, 5)
            .unwrap();
        tool.on_release(&mut make_ctx(&mut buf1, color1, 1), 5, 5)
            .unwrap();

        // Second stroke on a fresh buffer: press at (15,15) — no drag
        let mut buf2 = PixelBuffer::new(20, 20).unwrap();
        tool.on_press(&mut make_ctx(&mut buf2, color2, 1), 15, 15)
            .unwrap();

        // The target pixel must be painted
        assert_eq!(
            buf2.get_pixel(15, 15).unwrap(),
            color2,
            "pixel (15,15) should be painted by the second stroke"
        );

        // No stale interpolation from (5,5): pixels along the ghost path must be unpainted
        let ghost_path = super::super::bresenham_line(5, 5, 15, 15);
        for (px, py) in ghost_path {
            // Skip the actual press point itself
            if px == 15 && py == 15 {
                continue;
            }
            assert_eq!(
                buf2.get_pixel(px as u32, py as u32).unwrap(),
                Color::TRANSPARENT,
                "pixel ({px},{py}) must NOT be painted — stale interpolation from previous stroke"
            );
        }
    }

    #[test]
    fn full_press_drag_drag_release_lifecycle() {
        let mut buf = PixelBuffer::new(10, 10).unwrap();
        let color = Color::new(0, 200, 0, 255);
        let mut tool = BrushTool::default();

        // Horizontal line: press(0,0) → drag(3,0) → drag(6,0) → release(6,0)
        tool.on_press(&mut make_ctx(&mut buf, color, 1), 0, 0)
            .unwrap();
        tool.on_drag(&mut make_ctx(&mut buf, color, 1), 3, 0)
            .unwrap();
        tool.on_drag(&mut make_ctx(&mut buf, color, 1), 6, 0)
            .unwrap();
        tool.on_release(&mut make_ctx(&mut buf, color, 1), 6, 0)
            .unwrap();

        // Every pixel from x=0 to x=6 on row y=0 must be painted
        for x in 0u32..=6 {
            assert_eq!(
                buf.get_pixel(x, 0).unwrap(),
                color,
                "pixel ({x},0) should be painted as part of the continuous horizontal line"
            );
        }

        // Pixels beyond x=6 on the same row must be untouched
        for x in 7u32..10 {
            assert_eq!(
                buf.get_pixel(x, 0).unwrap(),
                Color::TRANSPARENT,
                "pixel ({x},0) should NOT be painted"
            );
        }
    }
}
