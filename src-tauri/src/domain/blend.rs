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
    // u8 range guarantees (b-a) fits in f32 without precision issues.
    let result = (a as f32) + ((b as f32) - (a as f32)) * t;
    result.round().clamp(0.0, 255.0) as u8
}

/// Blends two colors using a blend mode and opacity.
///
/// 1. Applies the blend mode formula per channel to get the blended color.
/// 2. Composites using Porter-Duff "source over" with correct straight-alpha weighting.
pub fn blend(base: Color, top: Color, mode: BlendMode, opacity: f32) -> Color {
    let opacity = opacity.clamp(0.0, 1.0);
    let src_a = (top.a() as f32) * opacity;

    if src_a <= 0.0 {
        return base;
    }

    let dst_a = base.a() as f32;
    let out_a = src_a + dst_a * (1.0 - src_a / 255.0);

    if out_a <= 0.0 {
        return Color::TRANSPARENT;
    }

    let blend_weight = src_a / out_a;

    let blended_r = blend_channel(base.r(), top.r(), mode);
    let blended_g = blend_channel(base.g(), top.g(), mode);
    let blended_b = blend_channel(base.b(), top.b(), mode);

    let result_r = lerp_u8(base.r(), blended_r, blend_weight);
    let result_g = lerp_u8(base.g(), blended_g, blend_weight);
    let result_b = lerp_u8(base.b(), blended_b, blend_weight);
    let result_a = out_a.round().clamp(0.0, 255.0) as u8;

    Color::new(result_r, result_g, result_b, result_a)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
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
        // effective src_a = 127.5, dst_a = 255
        // out_a = 127.5 + 255*(1 - 127.5/255) = 127.5 + 127.5 = 255
        // blend_weight = 127.5 / 255 = 0.5
        assert_eq!(result.r(), 100);
        assert_eq!(result.g(), 50);
        assert_eq!(result.b(), 25);
    }

    #[test]
    fn multiply_known_values() {
        let base = Color::new(200, 100, 50, 255);
        let top = Color::new(100, 200, 255, 255);
        let result = blend(base, top, BlendMode::Multiply, 1.0);
        // multiply: (200*100)/255 = 78, (100*200)/255 = 78, (50*255)/255 = 50
        assert_eq!(result.r(), 78);
        assert_eq!(result.g(), 78);
        assert_eq!(result.b(), 50);
    }

    #[test]
    fn screen_known_values() {
        let base = Color::new(100, 150, 200, 255);
        let top = Color::new(100, 150, 200, 255);
        let result = blend(base, top, BlendMode::Screen, 1.0);
        // screen: 255 - ((255-100)*(255-100))/255 = 255 - 94 = 161
        assert_eq!(result.r(), 161);
    }

    #[test]
    fn overlay_dark_base() {
        let base = Color::new(50, 50, 50, 255);
        let top = Color::new(200, 200, 200, 255);
        let result = blend(base, top, BlendMode::Overlay, 1.0);
        // (2 * 50 * 200) / 255 = 78
        assert_eq!(result.r(), 78);
    }

    #[test]
    fn overlay_light_base() {
        let base = Color::new(200, 200, 200, 255);
        let top = Color::new(100, 100, 100, 255);
        let result = blend(base, top, BlendMode::Overlay, 1.0);
        // 255 - (2 * 55 * 155)/255 = 255 - 66 = 189
        assert_eq!(result.r(), 189);
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

    #[test]
    fn opacity_above_one_is_clamped() {
        let base = Color::new(100, 100, 100, 255);
        let top = Color::new(200, 50, 150, 255);
        let at_one = blend(base, top, BlendMode::Normal, 1.0);
        let at_two = blend(base, top, BlendMode::Normal, 2.0);
        assert_eq!(at_one, at_two);
    }

    #[test]
    fn multiply_half_transparent_top() {
        let base = Color::new(200, 200, 200, 255);
        let top = Color::new(100, 100, 100, 128);
        let result = blend(base, top, BlendMode::Multiply, 1.0);
        // blended_r = (200*100)/255 = 78
        // src_a = 128, dst_a = 255, out_a = 128 + 255*(1-128/255) ≈ 255
        // blend_weight = 128/255 ≈ 0.502
        // result_r = lerp(200, 78, 0.502) ≈ 139
        // Result should be between base (200) and full multiply (78)
        assert!(result.r() > 78 && result.r() < 200);
    }

    #[test]
    fn semi_transparent_over_semi_transparent() {
        // Porter-Duff correctness: compositing semi-transparent over semi-transparent
        let base = Color::new(255, 0, 0, 128);
        let top = Color::new(0, 0, 255, 128);
        let result = blend(base, top, BlendMode::Normal, 1.0);
        // src_a = 128, dst_a = 128
        // out_a = 128 + 128*(1 - 128/255) ≈ 128 + 63.75 ≈ 192
        // blend_weight = 128/192 ≈ 0.667
        // result_r = lerp(255, 0, 0.667) ≈ 85
        // result_b = lerp(0, 255, 0.667) ≈ 170
        assert!(result.a() > 128); // combined alpha is higher
        assert!(result.b() > result.r()); // top blue dominates (higher blend weight)
    }
}
