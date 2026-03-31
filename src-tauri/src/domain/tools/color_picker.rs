use super::{DomainError, Tool, ToolContext, ToolResult};

pub struct ColorPickerTool;

impl Default for ColorPickerTool {
    fn default() -> Self {
        Self
    }
}

impl Tool for ColorPickerTool {
    fn name(&self) -> &str {
        "Color Picker"
    }

    fn on_press(
        &mut self,
        ctx: &mut ToolContext,
        x: u32,
        y: u32,
    ) -> Result<ToolResult, DomainError> {
        if x >= ctx.buffer.width() || y >= ctx.buffer.height() {
            return Ok(ToolResult::NoOp);
        }
        let color = ctx.buffer.get_pixel(x, y)?;
        Ok(ToolResult::ColorPicked(color))
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
#[allow(clippy::unwrap_used)]
mod tests {
    use super::super::{BrushSize, ToolContext, ToolResult};
    use super::ColorPickerTool;
    use crate::domain::color::Color;
    use crate::domain::pixel_buffer::PixelBuffer;
    use crate::domain::tools::Tool;

    fn make_ctx(buffer: &mut PixelBuffer) -> ToolContext<'_> {
        ToolContext::new(buffer, Color::TRANSPARENT, BrushSize::DEFAULT, 1.0)
    }

    #[test]
    fn picks_correct_color() {
        let red = Color::new(255, 0, 0, 255);
        let mut buffer = PixelBuffer::new(8, 8).unwrap();
        buffer.set_pixel(2, 3, red).unwrap();
        let mut ctx = make_ctx(&mut buffer);
        let result = ColorPickerTool.on_press(&mut ctx, 2, 3).unwrap();
        assert_eq!(result, ToolResult::ColorPicked(red));
    }

    #[test]
    fn picks_transparent() {
        let mut buffer = PixelBuffer::new(8, 8).unwrap();
        let mut ctx = make_ctx(&mut buffer);
        let result = ColorPickerTool.on_press(&mut ctx, 0, 0).unwrap();
        assert_eq!(result, ToolResult::ColorPicked(Color::TRANSPARENT));
    }

    #[test]
    fn out_of_bounds_noop() {
        let mut buffer = PixelBuffer::new(8, 8).unwrap();
        let mut ctx = make_ctx(&mut buffer);
        let result = ColorPickerTool.on_press(&mut ctx, 100, 100).unwrap();
        assert_eq!(result, ToolResult::NoOp);
    }

    #[test]
    fn on_drag_returns_noop() {
        let mut buffer = PixelBuffer::new(8, 8).unwrap();
        let mut ctx = make_ctx(&mut buffer);
        let result = ColorPickerTool.on_drag(&mut ctx, 2, 3).unwrap();
        assert_eq!(result, ToolResult::NoOp);
    }

    #[test]
    fn on_release_returns_noop() {
        let mut buffer = PixelBuffer::new(8, 8).unwrap();
        let mut ctx = make_ctx(&mut buffer);
        let result = ColorPickerTool.on_release(&mut ctx, 2, 3).unwrap();
        assert_eq!(result, ToolResult::NoOp);
    }
}
