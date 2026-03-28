use super::color::Color;

/// Determines how two colors are combined during compositing.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum BlendMode {
    #[default]
    Normal,
    Multiply,
    Screen,
    Overlay,
}

/// Applies a blend mode formula to a single channel pair.
fn blend_channel(base: u8, top: u8, mode: BlendMode) -> u8 {
    let b = base as u16;
    let t = top as u16;
    let result = match mode {
        BlendMode::Normal => t,
        BlendMode::Multiply => (b * t) / 255,
        BlendMode::Screen => 255 - ((255 - b) * (255 - t)) / 255,
        BlendMode::Overlay => {
            if b < 128 {
                (2 * b * t) / 255
            } else {
                255 - (2 * (255 - b) * (255 - t)) / 255
            }
        }
    };
    result as u8
}

fn lerp_u8(a: u8, b: u8, t: f32) -> u8 {
    let result = (a as f32) + ((b as f32) - (a as f32)) * t;
    result.round().clamp(0.0, 255.0) as u8
}

/// Blends two colors using a blend mode and opacity.
///
/// 1. Applies the blend mode formula per channel to get the blended color.
/// 2. Mixes the result with the base using Porter-Duff "source over" with opacity.
pub fn blend(base: Color, top: Color, mode: BlendMode, opacity: f32) -> Color {
    let opacity = opacity.clamp(0.0, 1.0);
    let effective_alpha = (top.a as f32) * opacity;

    if effective_alpha <= 0.0 {
        return base;
    }

    let factor = effective_alpha / 255.0;

    let blended_r = blend_channel(base.r, top.r, mode);
    let blended_g = blend_channel(base.g, top.g, mode);
    let blended_b = blend_channel(base.b, top.b, mode);

    let result_r = lerp_u8(base.r, blended_r, factor);
    let result_g = lerp_u8(base.g, blended_g, factor);
    let result_b = lerp_u8(base.b, blended_b, factor);
    let result_a = (effective_alpha + (base.a as f32) * (1.0 - factor))
        .round()
        .clamp(0.0, 255.0) as u8;

    Color::new(result_r, result_g, result_b, result_a)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_is_normal() {
        assert_eq!(BlendMode::default(), BlendMode::Normal);
    }

    #[test]
    fn normal_full_opacity_returns_top() {
        let base = Color::new(100, 100, 100, 255);
        let top = Color::new(200, 50, 150, 255);
        let result = blend(base, top, BlendMode::Normal, 1.0);
        assert_eq!(result, top);
    }

    #[test]
    fn normal_half_opacity_lerps() {
        let base = Color::new(0, 0, 0, 255);
        let top = Color::new(200, 100, 50, 255);
        let result = blend(base, top, BlendMode::Normal, 0.5);
        // effective_alpha = 255 * 0.5 = 127.5, factor ≈ 0.5
        // lerp(0, 200, 0.5) = 100, lerp(0, 100, 0.5) = 50, lerp(0, 50, 0.5) = 25
        assert_eq!(result.r, 100);
        assert_eq!(result.g, 50);
        assert_eq!(result.b, 25);
    }

    #[test]
    fn multiply_known_values() {
        let base = Color::new(200, 100, 50, 255);
        let top = Color::new(100, 200, 255, 255);
        let result = blend(base, top, BlendMode::Multiply, 1.0);
        // multiply: (200*100)/255 = 78, (100*200)/255 = 78, (50*255)/255 = 50
        assert_eq!(result.r, 78);
        assert_eq!(result.g, 78);
        assert_eq!(result.b, 50);
    }

    #[test]
    fn screen_known_values() {
        let base = Color::new(100, 150, 200, 255);
        let top = Color::new(100, 150, 200, 255);
        let result = blend(base, top, BlendMode::Screen, 1.0);
        // screen: 255 - ((255-100)*(255-100))/255 = 255 - (155*155)/255 = 255 - 94 = 161
        assert_eq!(result.r, 161);
    }

    #[test]
    fn overlay_dark_base() {
        // base < 128: multiply variant: (2 * base * top) / 255
        let base = Color::new(50, 50, 50, 255);
        let top = Color::new(200, 200, 200, 255);
        let result = blend(base, top, BlendMode::Overlay, 1.0);
        // (2 * 50 * 200) / 255 = 20000/255 = 78
        assert_eq!(result.r, 78);
    }

    #[test]
    fn overlay_light_base() {
        // base >= 128: screen variant: 255 - (2*(255-base)*(255-top))/255
        let base = Color::new(200, 200, 200, 255);
        let top = Color::new(100, 100, 100, 255);
        let result = blend(base, top, BlendMode::Overlay, 1.0);
        // 255 - (2 * 55 * 155)/255 = 255 - 17050/255 = 255 - 66 = 189
        assert_eq!(result.r, 189);
    }

    #[test]
    fn transparent_top_leaves_base_unchanged() {
        let base = Color::new(100, 150, 200, 255);
        let top = Color::TRANSPARENT;
        let result = blend(base, top, BlendMode::Normal, 1.0);
        assert_eq!(result, base);
    }

    #[test]
    fn opacity_zero_leaves_base_unchanged() {
        let base = Color::new(100, 150, 200, 255);
        let top = Color::new(255, 0, 0, 255);
        let result = blend(base, top, BlendMode::Normal, 0.0);
        assert_eq!(result, base);
    }
}
