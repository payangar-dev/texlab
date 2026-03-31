use std::sync::Mutex;

use tauri::{AppHandle, State};

use crate::commands::dto::{parse_layer_id, tool_result_to_dto, ColorDto, ToolResultDto};
use crate::commands::emit_state_changed;
use crate::domain::tools::{
    BrushTool, ColorPickerTool, EraserTool, FillTool, LineTool, SelectionTool, Tool,
};
use crate::domain::{BrushSize, Color, ToolResult};
use crate::error::AppError;
use crate::state::AppState;

fn create_tool(name: &str) -> Result<Box<dyn Tool + Send>, AppError> {
    match name {
        "brush" => Ok(Box::new(BrushTool::default())),
        "eraser" => Ok(Box::new(EraserTool::default())),
        "fill" => Ok(Box::<FillTool>::default()),
        "color_picker" | "eyedropper" => Ok(Box::<ColorPickerTool>::default()),
        "line" => Ok(Box::new(LineTool::default())),
        "selection" => Ok(Box::new(SelectionTool::default())),
        _ => Err(AppError::Internal(format!("unknown tool: {name}"))),
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn tool_press(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    tool: String,
    layer_id: String,
    x: u32,
    y: u32,
    color: ColorDto,
    brush_size: u8,
    opacity: f32,
    pipette_mode: String,
) -> Result<ToolResultDto, AppError> {
    let parsed_layer_id = parse_layer_id(&layer_id)?;
    let brush = BrushSize::new(brush_size)?;
    let domain_color = Color::from(&color);
    let mut tool_instance = create_tool(&tool)?;

    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    state.active_layer_id = Some(parsed_layer_id);

    let editor = state.editor_mut()?;

    // Pipette mode handling
    let is_pipette = tool == "color_picker" || tool == "eyedropper";
    if is_pipette {
        if pipette_mode != "composite" && pipette_mode != "active_layer" {
            return Err(AppError::Internal(format!(
                "unknown pipette mode: {pipette_mode}"
            )));
        }
        if pipette_mode == "composite" {
            let picked = editor.pick_color_composite(x, y)?;
            let result = ToolResult::ColorPicked(picked);
            state.active_tool = Some(tool_instance);
            return Ok(tool_result_to_dto(result, None));
        }
    }

    let result = editor.apply_tool_press(
        &mut *tool_instance,
        parsed_layer_id,
        x,
        y,
        domain_color,
        brush,
        opacity,
    )?;

    let composite = if result == ToolResult::PixelsModified {
        Some(editor.texture().composite()?)
    } else {
        None
    };

    state.active_tool = Some(tool_instance);

    if result == ToolResult::PixelsModified {
        emit_state_changed(&app);
    }
    Ok(tool_result_to_dto(result, composite))
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn tool_drag(
    _app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    layer_id: String,
    x: u32,
    y: u32,
    color: ColorDto,
    brush_size: u8,
    opacity: f32,
) -> Result<ToolResultDto, AppError> {
    let parsed_layer_id = parse_layer_id(&layer_id)?;
    let brush = BrushSize::new(brush_size)?;
    let domain_color = Color::from(&color);

    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    let mut tool_instance = state
        .active_tool
        .take()
        .ok_or_else(|| AppError::Internal("no active tool (call tool_press first)".to_owned()))?;

    let result = {
        let editor = state.editor_mut()?;
        editor.apply_tool_drag(
            &mut *tool_instance,
            parsed_layer_id,
            x,
            y,
            domain_color,
            brush,
            opacity,
        )
    };

    // Always restore tool mid-stroke, even on error
    state.active_tool = Some(tool_instance);
    let result = result?;

    // No emit_state_changed during drag — the composite is returned directly
    // in the result. Emitting here would trigger a secondary getEditorState IPC
    // call on every pointermove, flooding the IPC bridge.
    let composite = if result == ToolResult::PixelsModified {
        let editor = state.editor_ref()?;
        Some(editor.texture().composite()?)
    } else {
        None
    };

    Ok(tool_result_to_dto(result, composite))
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn tool_release(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    layer_id: String,
    x: u32,
    y: u32,
    color: ColorDto,
    brush_size: u8,
    opacity: f32,
) -> Result<ToolResultDto, AppError> {
    let parsed_layer_id = parse_layer_id(&layer_id)?;
    let brush = BrushSize::new(brush_size)?;
    let domain_color = Color::from(&color);

    let mut state = state
        .lock()
        .map_err(|_| AppError::Internal("state lock poisoned".into()))?;

    let mut tool_instance = state
        .active_tool
        .take()
        .ok_or_else(|| AppError::Internal("no active tool (call tool_press first)".to_owned()))?;

    let editor = state.editor_mut()?;
    let result = editor.apply_tool_release(
        &mut *tool_instance,
        parsed_layer_id,
        x,
        y,
        domain_color,
        brush,
        opacity,
    )?;

    // Stroke complete — tool intentionally dropped

    let composite = if result == ToolResult::PixelsModified {
        emit_state_changed(&app);
        Some(editor.texture().composite()?)
    } else {
        None
    };

    Ok(tool_result_to_dto(result, composite))
}
