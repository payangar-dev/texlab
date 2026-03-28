use std::collections::VecDeque;

use super::{DomainError, Tool, ToolContext, ToolResult};

pub struct FillTool;

impl Default for FillTool {
    fn default() -> Self {
        Self
    }
}

impl Tool for FillTool {
    fn name(&self) -> &str {
        "Fill"
    }

    fn on_press(
        &mut self,
        ctx: &mut ToolContext,
        x: u32,
        y: u32,
    ) -> Result<ToolResult, DomainError> {
        // FR-011: silent clip — out-of-bounds is a no-op
        if x >= ctx.buffer.width() || y >= ctx.buffer.height() {
            return Ok(ToolResult::NoOp);
        }

        // Bounds already checked above; unwrap is safe.
        let target = ctx.buffer.get_pixel(x, y).unwrap();

        // FR-012: filling with the same color is a no-op
        if target == ctx.color {
            return Ok(ToolResult::NoOp);
        }

        let width = ctx.buffer.width();
        let height = ctx.buffer.height();
        let mut visited = vec![false; (width as usize) * (height as usize)];

        let mut queue: VecDeque<(u32, u32)> = VecDeque::new();
        visited[(y as usize) * (width as usize) + (x as usize)] = true;
        queue.push_back((x, y));

        while let Some((cx, cy)) = queue.pop_front() {
            // set_pixel cannot fail: cx/cy are always within bounds by construction.
            ctx.buffer.set_pixel(cx, cy, ctx.color).unwrap();

            // 4-connected neighbors: up, down, left, right
            let neighbors: [(i64, i64); 4] = [
                (cx as i64, cy as i64 - 1),
                (cx as i64, cy as i64 + 1),
                (cx as i64 - 1, cy as i64),
                (cx as i64 + 1, cy as i64),
            ];

            for (nx, ny) in neighbors {
                if nx < 0 || ny < 0 || nx >= width as i64 || ny >= height as i64 {
                    continue;
                }
                let (nx, ny) = (nx as u32, ny as u32);
                let idx = (ny as usize) * (width as usize) + (nx as usize);
                if visited[idx] {
                    continue;
                }
                // get_pixel cannot fail: bounds already checked above.
                if ctx.buffer.get_pixel(nx, ny).unwrap() != target {
                    continue;
                }
                visited[idx] = true;
                queue.push_back((nx, ny));
            }
        }

        Ok(ToolResult::PixelsModified)
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
        _ctx: &mut ToolContext,
        _x: u32,
        _y: u32,
    ) -> Result<ToolResult, DomainError> {
        Ok(ToolResult::NoOp)
    }
}

#[cfg(test)]
mod tests {
    use super::super::{BrushSize, ToolContext, ToolResult};
    use super::FillTool;
    use crate::domain::color::Color;
    use crate::domain::pixel_buffer::PixelBuffer;
    use crate::domain::tools::Tool;

    fn red() -> Color {
        Color::new(255, 0, 0, 255)
    }

    fn blue() -> Color {
        Color::new(0, 0, 255, 255)
    }

    fn make_ctx(buffer: &mut PixelBuffer, color: Color) -> ToolContext<'_> {
        ToolContext {
            buffer,
            color,
            brush_size: BrushSize::DEFAULT,
        }
    }

    // 1. Fill a contiguous 4×4 region inside an 8×8 buffer.
    #[test]
    fn fill_contiguous_region() {
        let mut buf = PixelBuffer::new(8, 8).unwrap();
        // Paint 4×4 top-left square red()
        buf.fill_rect(0, 0, 4, 4, red());

        let mut tool = FillTool;
        let result = tool
            .on_press(&mut make_ctx(&mut buf, blue()), 1, 1)
            .unwrap();

        assert_eq!(result, ToolResult::PixelsModified);

        // All 16 pixels of the 4×4 region must now be blue()
        for y in 0..4 {
            for x in 0..4 {
                assert_eq!(
                    buf.get_pixel(x, y).unwrap(),
                    blue(),
                    "pixel ({x},{y}) should be blue()"
                );
            }
        }

        // The rest must remain transparent
        for y in 0..8u32 {
            for x in 0..8u32 {
                if x < 4 && y < 4 {
                    continue;
                }
                assert_eq!(
                    buf.get_pixel(x, y).unwrap(),
                    Color::TRANSPARENT,
                    "pixel ({x},{y}) should be TRANSPARENT"
                );
            }
        }
    }

    // 2. Fill a single isolated pixel.
    #[test]
    fn fill_single_pixel() {
        let mut buf = PixelBuffer::new(4, 4).unwrap();
        buf.set_pixel(2, 2, red()).unwrap();

        let mut tool = FillTool;
        let result = tool
            .on_press(&mut make_ctx(&mut buf, blue()), 2, 2)
            .unwrap();

        assert_eq!(result, ToolResult::PixelsModified);
        assert_eq!(buf.get_pixel(2, 2).unwrap(), blue());

        // Every other pixel must remain transparent
        for y in 0..4u32 {
            for x in 0..4u32 {
                if x == 2 && y == 2 {
                    continue;
                }
                assert_eq!(
                    buf.get_pixel(x, y).unwrap(),
                    Color::TRANSPARENT,
                    "pixel ({x},{y}) should be TRANSPARENT"
                );
            }
        }
    }

    // 3. Filling a pixel with the same color it already has → NoOp.
    #[test]
    fn fill_same_color_noop() {
        let mut buf = PixelBuffer::new(4, 4).unwrap();
        buf.fill_rect(0, 0, 4, 4, red());

        let mut tool = FillTool;
        let result = tool.on_press(&mut make_ctx(&mut buf, red()), 0, 0).unwrap();

        assert_eq!(result, ToolResult::NoOp);

        // Buffer must be completely unchanged
        for y in 0..4u32 {
            for x in 0..4u32 {
                assert_eq!(buf.get_pixel(x, y).unwrap(), red());
            }
        }
    }

    // 4. Fill the entire 64×64 transparent canvas.
    #[test]
    fn fill_large_area() {
        let mut buf = PixelBuffer::new(64, 64).unwrap();

        let mut tool = FillTool;
        let result = tool.on_press(&mut make_ctx(&mut buf, red()), 0, 0).unwrap();

        assert_eq!(result, ToolResult::PixelsModified);

        assert!(
            buf.pixels().chunks(4).all(|px| px == [255, 0, 0, 255]),
            "all 4096 pixels should be red()"
        );
    }

    // 5. Fill stops at a red() border ring; transparent interior changes, ring stays.
    #[test]
    fn fill_stops_at_boundary() {
        let mut buf = PixelBuffer::new(6, 6).unwrap();

        // Draw a 1-pixel-thick red() ring around the whole buffer
        buf.fill_rect(0, 0, 6, 1, red()); // top row
        buf.fill_rect(0, 5, 6, 1, red()); // bottom row
        buf.fill_rect(0, 0, 1, 6, red()); // left column
        buf.fill_rect(5, 0, 1, 6, red()); // right column

        // Interior is transparent: x in 1..5, y in 1..5 (16 pixels)

        let mut tool = FillTool;
        let result = tool
            .on_press(&mut make_ctx(&mut buf, blue()), 2, 2)
            .unwrap();

        assert_eq!(result, ToolResult::PixelsModified);

        // Interior must be blue()
        for y in 1..5u32 {
            for x in 1..5u32 {
                assert_eq!(
                    buf.get_pixel(x, y).unwrap(),
                    blue(),
                    "interior pixel ({x},{y}) should be blue()"
                );
            }
        }

        // The red() ring must be untouched
        for x in 0..6u32 {
            assert_eq!(
                buf.get_pixel(x, 0).unwrap(),
                red(),
                "top row ({x},0) should stay red()"
            );
            assert_eq!(
                buf.get_pixel(x, 5).unwrap(),
                red(),
                "bottom row ({x},5) should stay red()"
            );
        }
        for y in 1..5u32 {
            assert_eq!(
                buf.get_pixel(0, y).unwrap(),
                red(),
                "left col (0,{y}) should stay red()"
            );
            assert_eq!(
                buf.get_pixel(5, y).unwrap(),
                red(),
                "right col (5,{y}) should stay red()"
            );
        }
    }

    // 6. Clicking outside the buffer bounds → NoOp.
    #[test]
    fn fill_out_of_bounds_noop() {
        let mut buf = PixelBuffer::new(16, 16).unwrap();

        let mut tool = FillTool;
        let result = tool
            .on_press(&mut make_ctx(&mut buf, red()), 100, 100)
            .unwrap();

        assert_eq!(result, ToolResult::NoOp);

        // Buffer must be completely unchanged (all transparent)
        assert!(buf.pixels().iter().all(|&b| b == 0));
    }

    // 7. on_drag always returns NoOp.
    #[test]
    fn on_drag_returns_noop() {
        let mut buf = PixelBuffer::new(8, 8).unwrap();
        let mut tool = FillTool;
        let result = tool.on_drag(&mut make_ctx(&mut buf, red()), 0, 0).unwrap();
        assert_eq!(result, ToolResult::NoOp);
    }

    // 8. on_release always returns NoOp.
    #[test]
    fn on_release_returns_noop() {
        let mut buf = PixelBuffer::new(8, 8).unwrap();
        let mut tool = FillTool;
        let result = tool
            .on_release(&mut make_ctx(&mut buf, red()), 0, 0)
            .unwrap();
        assert_eq!(result, ToolResult::NoOp);
    }
}
