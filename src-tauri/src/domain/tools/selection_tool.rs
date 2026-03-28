use super::{DomainError, Tool, ToolContext, ToolResult};
use crate::domain::selection::Selection;

pub struct SelectionTool {
    start_pos: Option<(u32, u32)>,
}

impl Default for SelectionTool {
    fn default() -> Self {
        Self { start_pos: None }
    }
}

impl Tool for SelectionTool {
    fn name(&self) -> &str {
        "Selection"
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
        ctx: &mut ToolContext,
        x: u32,
        y: u32,
    ) -> Result<ToolResult, DomainError> {
        let (sx, sy) = match self.start_pos {
            Some(pos) => pos,
            None => return Ok(ToolResult::NoOp),
        };
        let sel = Selection::new(sx, sy, x, y);
        let clipped = sel.clip(ctx.buffer.width(), ctx.buffer.height());
        Ok(ToolResult::SelectionChanged(clipped))
    }

    fn on_release(
        &mut self,
        ctx: &mut ToolContext,
        x: u32,
        y: u32,
    ) -> Result<ToolResult, DomainError> {
        let (sx, sy) = match self.start_pos.take() {
            Some(pos) => pos,
            None => return Ok(ToolResult::NoOp),
        };
        // Click without drag: clear the selection (FR-014)
        if sx == x && sy == y {
            return Ok(ToolResult::SelectionChanged(None));
        }
        let sel = Selection::new(sx, sy, x, y);
        let clipped = sel.clip(ctx.buffer.width(), ctx.buffer.height());
        Ok(ToolResult::SelectionChanged(clipped))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::{BrushSize, ToolContext, ToolResult};
    use crate::domain::color::Color;
    use crate::domain::pixel_buffer::PixelBuffer;
    use crate::domain::selection::Selection;

    fn make_ctx(width: u32, height: u32) -> PixelBuffer {
        PixelBuffer::new(width, height).unwrap()
    }

    #[test]
    fn drag_creates_normalized_selection() {
        let mut tool = SelectionTool::default();
        let mut buf = make_ctx(16, 16);
        let mut ctx = ToolContext {
            buffer: &mut buf,
            color: Color::new(0, 0, 0, 255),
            brush_size: BrushSize::DEFAULT,
        };

        tool.on_press(&mut ctx, 2, 3).unwrap();
        let result = tool.on_drag(&mut ctx, 8, 7).unwrap();

        let expected = Selection::new(2, 3, 8, 7);
        assert_eq!(result, ToolResult::SelectionChanged(Some(expected)));
        assert_eq!(expected.left(), 2);
        assert_eq!(expected.top(), 3);
        assert_eq!(expected.right(), 8);
        assert_eq!(expected.bottom(), 7);
    }

    #[test]
    fn click_without_drag_clears() {
        let mut tool = SelectionTool::default();
        let mut buf = make_ctx(16, 16);
        let mut ctx = ToolContext {
            buffer: &mut buf,
            color: Color::new(0, 0, 0, 255),
            brush_size: BrushSize::DEFAULT,
        };

        tool.on_press(&mut ctx, 5, 5).unwrap();
        let result = tool.on_release(&mut ctx, 5, 5).unwrap();

        assert_eq!(result, ToolResult::SelectionChanged(None));
    }

    #[test]
    fn selection_clipped_to_canvas() {
        let mut tool = SelectionTool::default();
        let mut buf = make_ctx(8, 8);
        let mut ctx = ToolContext {
            buffer: &mut buf,
            color: Color::new(0, 0, 0, 255),
            brush_size: BrushSize::DEFAULT,
        };

        tool.on_press(&mut ctx, 0, 0).unwrap();
        let result = tool.on_drag(&mut ctx, 20, 20).unwrap();

        if let ToolResult::SelectionChanged(Some(sel)) = result {
            assert_eq!(sel.right(), 7);
            assert_eq!(sel.bottom(), 7);
        } else {
            panic!("expected SelectionChanged(Some(_)), got {:?}", result);
        }
    }

    #[test]
    fn on_drag_without_press_returns_noop() {
        let mut tool = SelectionTool::default();
        let mut buf = make_ctx(16, 16);
        let mut ctx = ToolContext {
            buffer: &mut buf,
            color: Color::new(0, 0, 0, 255),
            brush_size: BrushSize::DEFAULT,
        };

        let result = tool.on_drag(&mut ctx, 4, 4).unwrap();

        assert_eq!(result, ToolResult::NoOp);
    }

    #[test]
    fn on_release_without_press_returns_noop() {
        let mut tool = SelectionTool::default();
        let mut buf = make_ctx(16, 16);
        let mut ctx = ToolContext {
            buffer: &mut buf,
            color: Color::new(0, 0, 0, 255),
            brush_size: BrushSize::DEFAULT,
        };

        let result = tool.on_release(&mut ctx, 4, 4).unwrap();

        assert_eq!(result, ToolResult::NoOp);
    }

    #[test]
    fn reverse_direction_normalizes() {
        let mut tool_fwd = SelectionTool::default();
        let mut tool_rev = SelectionTool::default();
        let mut buf_fwd = make_ctx(16, 16);
        let mut buf_rev = make_ctx(16, 16);

        let mut ctx_fwd = ToolContext {
            buffer: &mut buf_fwd,
            color: Color::new(0, 0, 0, 255),
            brush_size: BrushSize::DEFAULT,
        };
        let mut ctx_rev = ToolContext {
            buffer: &mut buf_rev,
            color: Color::new(0, 0, 0, 255),
            brush_size: BrushSize::DEFAULT,
        };

        tool_fwd.on_press(&mut ctx_fwd, 2, 3).unwrap();
        let fwd = tool_fwd.on_drag(&mut ctx_fwd, 8, 7).unwrap();

        tool_rev.on_press(&mut ctx_rev, 8, 7).unwrap();
        let rev = tool_rev.on_drag(&mut ctx_rev, 2, 3).unwrap();

        assert_eq!(fwd, rev);
    }
}
