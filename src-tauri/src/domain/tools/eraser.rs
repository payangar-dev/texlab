use super::{DomainError, Tool, ToolContext, ToolResult};
use crate::domain::color::Color;

pub struct EraserTool {
    last_pos: Option<(u32, u32)>,
}

impl Default for EraserTool {
    fn default() -> Self {
        Self { last_pos: None }
    }
}

impl EraserTool {
    fn stamp(&self, ctx: &mut ToolContext, x: u32, y: u32) {
        let size = ctx.brush_size.value() as u32;
        ctx.buffer.fill_rect(x, y, size, size, Color::TRANSPARENT);
    }
}

impl Tool for EraserTool {
    fn name(&self) -> &str {
        "Eraser"
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
    use super::*;
    use crate::domain::color::Color;
    use crate::domain::pixel_buffer::PixelBuffer;

    fn make_ctx(buf: &mut PixelBuffer) -> ToolContext<'_> {
        ToolContext {
            buffer: buf,
            color: Color::new(255, 0, 0, 255),
            brush_size: BrushSize::DEFAULT,
        }
    }

    fn make_ctx_with_size(buf: &mut PixelBuffer, size: u8) -> ToolContext<'_> {
        ToolContext {
            buffer: buf,
            color: Color::new(255, 0, 0, 255),
            brush_size: BrushSize::new(size).unwrap(),
        }
    }

    #[test]
    fn erased_pixel_is_transparent() {
        let mut buf = PixelBuffer::new(8, 8).unwrap();
        // Paint a red pixel first
        buf.set_pixel(3, 3, Color::new(255, 0, 0, 255)).unwrap();
        assert_eq!(buf.get_pixel(3, 3).unwrap(), Color::new(255, 0, 0, 255));

        let mut eraser = EraserTool::default();
        let mut ctx = make_ctx(&mut buf);
        let result = eraser.on_press(&mut ctx, 3, 3).unwrap();

        assert_eq!(result, ToolResult::PixelsModified);
        assert_eq!(buf.get_pixel(3, 3).unwrap(), Color::TRANSPARENT);
        assert_eq!(buf.get_pixel(3, 3).unwrap().r(), 0);
        assert_eq!(buf.get_pixel(3, 3).unwrap().g(), 0);
        assert_eq!(buf.get_pixel(3, 3).unwrap().b(), 0);
        assert_eq!(buf.get_pixel(3, 3).unwrap().a(), 0);
    }

    #[test]
    fn square_erased_with_anchoring() {
        let mut buf = PixelBuffer::new(8, 8).unwrap();
        // Fill entire buffer with red
        for y in 0..8 {
            for x in 0..8 {
                buf.set_pixel(x, y, Color::new(255, 0, 0, 255)).unwrap();
            }
        }

        let mut eraser = EraserTool::default();
        let mut ctx = make_ctx_with_size(&mut buf, 2);
        eraser.on_press(&mut ctx, 2, 2).unwrap();

        // The 2×2 square at (2,2) should be transparent
        assert_eq!(buf.get_pixel(2, 2).unwrap(), Color::TRANSPARENT);
        assert_eq!(buf.get_pixel(3, 2).unwrap(), Color::TRANSPARENT);
        assert_eq!(buf.get_pixel(2, 3).unwrap(), Color::TRANSPARENT);
        assert_eq!(buf.get_pixel(3, 3).unwrap(), Color::TRANSPARENT);

        // Pixels outside the erased square remain red
        assert_eq!(buf.get_pixel(1, 1).unwrap(), Color::new(255, 0, 0, 255));
        assert_eq!(buf.get_pixel(4, 4).unwrap(), Color::new(255, 0, 0, 255));
    }

    #[test]
    fn continuous_drag_erase_no_gaps() {
        let mut buf = PixelBuffer::new(16, 16).unwrap();
        // Fill buffer with white
        for y in 0..16 {
            for x in 0..16 {
                buf.set_pixel(x, y, Color::WHITE).unwrap();
            }
        }

        let mut eraser = EraserTool::default();
        {
            let mut ctx = make_ctx(&mut buf);
            eraser.on_press(&mut ctx, 0, 0).unwrap();
        }
        {
            let mut ctx = make_ctx(&mut buf);
            eraser.on_drag(&mut ctx, 5, 5).unwrap();
        }

        // All points along the diagonal from (0,0) to (5,5) should be transparent
        let line_pts = super::super::bresenham_line(0, 0, 5, 5);
        for (px, py) in line_pts {
            assert_eq!(
                buf.get_pixel(px as u32, py as u32).unwrap(),
                Color::TRANSPARENT,
                "pixel ({px},{py}) should be transparent"
            );
        }
    }

    #[test]
    fn erasing_transparent_is_harmless() {
        let mut buf = PixelBuffer::new(8, 8).unwrap();
        // Buffer starts fully transparent — no panic expected

        let mut eraser = EraserTool::default();
        {
            let mut ctx = make_ctx(&mut buf);
            let result = eraser.on_press(&mut ctx, 2, 2).unwrap();
            assert_eq!(result, ToolResult::PixelsModified);
        }
        {
            let mut ctx = make_ctx(&mut buf);
            let result = eraser.on_drag(&mut ctx, 4, 4).unwrap();
            assert_eq!(result, ToolResult::PixelsModified);
        }

        // All pixels remain transparent
        for y in 0..8 {
            for x in 0..8 {
                assert_eq!(buf.get_pixel(x, y).unwrap(), Color::TRANSPARENT);
            }
        }
    }

    #[test]
    fn on_release_returns_noop() {
        let mut buf = PixelBuffer::new(8, 8).unwrap();
        let mut eraser = EraserTool::default();

        {
            let mut ctx = make_ctx(&mut buf);
            eraser.on_press(&mut ctx, 2, 2).unwrap();
        }
        {
            let mut ctx = make_ctx(&mut buf);
            let result = eraser.on_release(&mut ctx, 2, 2).unwrap();
            assert_eq!(result, ToolResult::NoOp);
        }
    }

    #[test]
    fn on_release_clears_state_between_strokes() {
        let mut buf = PixelBuffer::new(16, 16).unwrap();
        // Fill buffer with white
        for y in 0..16 {
            for x in 0..16 {
                buf.set_pixel(x, y, Color::WHITE).unwrap();
            }
        }

        let mut eraser = EraserTool::default();

        // First stroke: press → drag → release
        {
            let mut ctx = make_ctx(&mut buf);
            eraser.on_press(&mut ctx, 0, 0).unwrap();
        }
        {
            let mut ctx = make_ctx(&mut buf);
            eraser.on_drag(&mut ctx, 5, 5).unwrap();
        }
        {
            let mut ctx = make_ctx(&mut buf);
            eraser.on_release(&mut ctx, 5, 5).unwrap();
        }

        // Restore white everywhere to isolate second stroke
        for y in 0..16 {
            for x in 0..16 {
                buf.set_pixel(x, y, Color::WHITE).unwrap();
            }
        }

        // Second stroke: only a single press at (12,12)
        {
            let mut ctx = make_ctx(&mut buf);
            eraser.on_press(&mut ctx, 12, 12).unwrap();
        }

        // (12,12) must be erased
        assert_eq!(buf.get_pixel(12, 12).unwrap(), Color::TRANSPARENT);
        // Midpoint (8,8) between old last_pos (5,5) and new press (12,12) must NOT be erased —
        // on_release cleared last_pos so no Bresenham interpolation occurred.
        assert_eq!(buf.get_pixel(8, 8).unwrap(), Color::WHITE);
    }

    #[test]
    fn eraser_ignores_context_color() {
        let mut buf = PixelBuffer::new(8, 8).unwrap();
        // Fill buffer with white
        for y in 0..8 {
            for x in 0..8 {
                buf.set_pixel(x, y, Color::WHITE).unwrap();
            }
        }

        let mut eraser = EraserTool::default();
        // Use a blue context color — the eraser must ignore it
        let mut ctx = ToolContext {
            buffer: &mut buf,
            color: Color::new(0, 0, 255, 255),
            brush_size: BrushSize::DEFAULT,
        };
        eraser.on_press(&mut ctx, 3, 3).unwrap();

        // Pixel must be TRANSPARENT, not blue
        assert_eq!(buf.get_pixel(3, 3).unwrap(), Color::TRANSPARENT);
    }
}
