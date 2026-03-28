use super::{DomainError, Tool, ToolContext, ToolResult};

pub struct LineTool {
    start_pos: Option<(u32, u32)>,
}

impl Default for LineTool {
    fn default() -> Self {
        Self { start_pos: None }
    }
}

impl Tool for LineTool {
    fn name(&self) -> &str {
        "Line"
    }

    fn on_press(
        &mut self,
        _ctx: &mut ToolContext,
        x: u32,
        y: u32,
    ) -> Result<ToolResult, DomainError> {
        self.start_pos = Some((x, y));
        Ok(ToolResult::NoOp)
    }

    fn on_drag(
        &mut self,
        _ctx: &mut ToolContext,
        _x: u32,
        _y: u32,
    ) -> Result<ToolResult, DomainError> {
        Ok(ToolResult::NoOp)
    }

    fn on_release(
        &mut self,
        ctx: &mut ToolContext,
        x: u32,
        y: u32,
    ) -> Result<ToolResult, DomainError> {
        let start = match self.start_pos.take() {
            Some(pos) => pos,
            None => return Ok(ToolResult::NoOp),
        };

        let points = super::bresenham_line(start.0 as i32, start.1 as i32, x as i32, y as i32);
        for (px, py) in points {
            if px >= 0
                && py >= 0
                && (px as u32) < ctx.buffer.width()
                && (py as u32) < ctx.buffer.height()
            {
                ctx.buffer.set_pixel(px as u32, py as u32, ctx.color).unwrap();
            }
        }

        Ok(ToolResult::PixelsModified)
    }
}

#[cfg(test)]
mod tests {
    use super::super::{BrushSize, ToolContext, ToolResult};
    use crate::domain::color::Color;
    use crate::domain::pixel_buffer::PixelBuffer;

    use super::*;

    fn make_ctx(buf: &mut PixelBuffer, color: Color) -> ToolContext<'_> {
        ToolContext {
            buffer: buf,
            color,
            brush_size: BrushSize::DEFAULT,
        }
    }

    #[test]
    fn line_diagonal() {
        let mut buf = PixelBuffer::new(16, 16).unwrap();
        let color = Color::new(255, 0, 0, 255);
        let mut tool = LineTool::default();

        tool.on_press(&mut make_ctx(&mut buf, color), 0, 0).unwrap();
        let result = tool
            .on_release(&mut make_ctx(&mut buf, color), 5, 5)
            .unwrap();

        assert_eq!(result, ToolResult::PixelsModified);
        // All pixels along the diagonal (0,0)–(5,5) must be painted
        for i in 0..=5u32 {
            assert_eq!(
                buf.get_pixel(i, i).unwrap(),
                color,
                "pixel ({i},{i}) should be painted"
            );
        }
    }

    #[test]
    fn line_horizontal() {
        let mut buf = PixelBuffer::new(16, 16).unwrap();
        let color = Color::new(0, 255, 0, 255);
        let mut tool = LineTool::default();

        tool.on_press(&mut make_ctx(&mut buf, color), 0, 5).unwrap();
        tool.on_release(&mut make_ctx(&mut buf, color), 10, 5)
            .unwrap();

        // Exactly 11 pixels, all at y=5
        let painted: Vec<u32> = (0..16)
            .filter(|&x| buf.get_pixel(x, 5).unwrap() == color)
            .collect();
        assert_eq!(painted.len(), 11, "expected exactly 11 painted pixels");
        for x in 0..=10u32 {
            assert_eq!(
                buf.get_pixel(x, 5).unwrap(),
                color,
                "pixel ({x},5) should be painted"
            );
        }
        // All painted pixels must be at y=5
        for y in 0..16u32 {
            if y != 5 {
                for x in 0..16u32 {
                    assert_eq!(
                        buf.get_pixel(x, y).unwrap(),
                        Color::TRANSPARENT,
                        "pixel ({x},{y}) outside the line should be transparent"
                    );
                }
            }
        }
    }

    #[test]
    fn line_vertical() {
        let mut buf = PixelBuffer::new(16, 16).unwrap();
        let color = Color::new(0, 0, 255, 255);
        let mut tool = LineTool::default();

        tool.on_press(&mut make_ctx(&mut buf, color), 3, 0).unwrap();
        tool.on_release(&mut make_ctx(&mut buf, color), 3, 8)
            .unwrap();

        // Exactly 9 pixels, all at x=3
        let painted: Vec<u32> = (0..16)
            .filter(|&y| buf.get_pixel(3, y).unwrap() == color)
            .collect();
        assert_eq!(painted.len(), 9, "expected exactly 9 painted pixels");
        for y in 0..=8u32 {
            assert_eq!(
                buf.get_pixel(3, y).unwrap(),
                color,
                "pixel (3,{y}) should be painted"
            );
        }
    }

    #[test]
    fn line_same_start_end() {
        let mut buf = PixelBuffer::new(16, 16).unwrap();
        let color = Color::new(128, 128, 0, 255);
        let mut tool = LineTool::default();

        tool.on_press(&mut make_ctx(&mut buf, color), 4, 4).unwrap();
        let result = tool
            .on_release(&mut make_ctx(&mut buf, color), 4, 4)
            .unwrap();

        assert_eq!(result, ToolResult::PixelsModified);
        assert_eq!(buf.get_pixel(4, 4).unwrap(), color);
        // Only (4,4) should be painted — count all painted pixels
        let total_painted = (0..16u32)
            .flat_map(|x| (0..16u32).map(move |y| (x, y)))
            .filter(|&(x, y)| buf.get_pixel(x, y).unwrap() == color)
            .count();
        assert_eq!(total_painted, 1, "only a single pixel should be painted");
    }

    #[test]
    fn line_clips_outside_canvas() {
        let mut buf = PixelBuffer::new(8, 8).unwrap();
        let color = Color::new(255, 128, 0, 255);
        let mut tool = LineTool::default();

        tool.on_press(&mut make_ctx(&mut buf, color), 0, 0).unwrap();
        // Release at (20,20) which is outside the 8×8 canvas — must not panic
        let result = tool
            .on_release(&mut make_ctx(&mut buf, color), 20, 20)
            .unwrap();

        assert_eq!(result, ToolResult::PixelsModified);
        // All painted pixels must be within the 8×8 canvas (guaranteed by no panic)
        // At minimum the origin (0,0) must be painted
        assert_eq!(buf.get_pixel(0, 0).unwrap(), color);
    }

    #[test]
    fn on_release_without_press_returns_noop() {
        let mut buf = PixelBuffer::new(16, 16).unwrap();
        let color = Color::new(255, 0, 0, 255);
        let mut tool = LineTool::default();

        // Call on_release without a preceding on_press
        let result = tool
            .on_release(&mut make_ctx(&mut buf, color), 5, 5)
            .unwrap();

        assert_eq!(result, ToolResult::NoOp);
        // No pixels should have been painted
        let total_painted = (0..16u32)
            .flat_map(|x| (0..16u32).map(move |y| (x, y)))
            .filter(|&(x, y)| buf.get_pixel(x, y).unwrap() != Color::TRANSPARENT)
            .count();
        assert_eq!(total_painted, 0, "no pixels should be painted");
    }

    #[test]
    fn on_drag_returns_noop() {
        let mut buf = PixelBuffer::new(16, 16).unwrap();
        let color = Color::new(0, 255, 0, 255);
        let mut tool = LineTool::default();

        tool.on_press(&mut make_ctx(&mut buf, color), 0, 0).unwrap();
        let result = tool
            .on_drag(&mut make_ctx(&mut buf, color), 5, 5)
            .unwrap();

        assert_eq!(result, ToolResult::NoOp);
    }

    #[test]
    fn diagonal_no_gaps() {
        let mut buf = PixelBuffer::new(16, 16).unwrap();
        let color = Color::new(64, 192, 255, 255);
        let mut tool = LineTool::default();

        tool.on_press(&mut make_ctx(&mut buf, color), 0, 0).unwrap();
        tool.on_release(&mut make_ctx(&mut buf, color), 7, 3)
            .unwrap();

        // Collect painted pixels along expected bresenham path and verify connectivity
        let path = super::super::bresenham_line(0, 0, 7, 3);
        for (px, py) in &path {
            assert_eq!(
                buf.get_pixel(*px as u32, *py as u32).unwrap(),
                color,
                "pixel ({px},{py}) should be painted"
            );
        }
        // All adjacent points in the path must be at most 1 pixel apart (no gaps)
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
}
