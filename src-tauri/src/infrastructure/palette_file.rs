//! `.texpal` codec — serde-powered JSON read/write for palette files.
//!
//! Exposed to `use_cases/` only via the [`PaletteCodec`] port.

use serde::{Deserialize, Serialize};

use crate::domain::{
    Color, DomainError, Palette, PaletteCodec, PaletteId, PaletteName, PaletteScope,
};

const TEXPAL_VERSION: u32 = 1;

/// Wire representation — never crosses the domain boundary.
#[derive(Serialize, Deserialize)]
struct TexpalFile {
    version: u32,
    id: String,
    name: String,
    colors: Vec<String>,
}

fn rule(reason: impl Into<String>) -> DomainError {
    DomainError::RuleViolation(format!("invalid-palette-file:{}", reason.into()))
}

/// Serializes a palette to pretty JSON.
pub fn encode(palette: &Palette) -> Result<String, DomainError> {
    let file = TexpalFile {
        version: TEXPAL_VERSION,
        id: palette.id().to_hex_string(),
        name: palette.name().as_str().to_owned(),
        colors: palette.colors().iter().map(Color::to_hex_rgb).collect(),
    };
    serde_json::to_string_pretty(&file).map_err(|e| DomainError::IoError {
        reason: format!("texpal encode: {e}"),
    })
}

/// Parses a `.texpal` payload. `scope` is supplied by the caller because
/// the file does not encode it (scope is derived from the directory that
/// holds the file).
pub fn decode(raw: &str, scope: PaletteScope) -> Result<Palette, DomainError> {
    let file: TexpalFile = serde_json::from_str(raw).map_err(|e| rule(format!("parse:{e}")))?;

    if file.version != TEXPAL_VERSION {
        return Err(rule(format!("unsupported-version:{}", file.version)));
    }

    let id = PaletteId::from_hex(&file.id).map_err(|e| rule(format!("bad-id:{e}")))?;
    let name = PaletteName::new(&file.name).map_err(|e| rule(format!("bad-name:{e}")))?;

    let mut colors = Vec::with_capacity(file.colors.len());
    let mut duplicates = 0usize;
    for hex in &file.colors {
        let color = Color::from_hex_rgb(hex).map_err(|e| rule(format!("bad-color:{e}")))?;
        if colors.contains(&color) {
            duplicates += 1;
            continue;
        }
        colors.push(color);
    }
    if duplicates > 0 {
        eprintln!(
            "[texpal] warn: ignored {duplicates} duplicate color(s) while decoding palette {}",
            file.name
        );
    }

    Ok(Palette::from_parts(id, name, scope, colors))
}

/// Default implementation of [`PaletteCodec`]. Stateless: the codec struct
/// holds no configuration, so a single instance is shared by
/// `PaletteService`.
pub struct TexpalCodec;

impl PaletteCodec for TexpalCodec {
    fn encode(&self, palette: &Palette) -> Result<String, DomainError> {
        encode(palette)
    }

    fn decode(&self, raw: &str, scope: PaletteScope) -> Result<Palette, DomainError> {
        decode(raw, scope)
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    const FIXTURE_DIR: &str = "tests/fixtures";

    fn load(name: &str) -> String {
        let path = std::path::Path::new(FIXTURE_DIR).join(name);
        std::fs::read_to_string(path).expect("fixture read")
    }

    #[test]
    fn decode_valid_fixture_roundtrips() {
        let raw = load("palette_valid.texpal");
        let p = decode(&raw, PaletteScope::Global).unwrap();
        assert_eq!(p.name().as_str(), "Nether Tones");
        assert_eq!(p.colors().len(), 4);
        let reencoded = encode(&p).unwrap();
        let again = decode(&reencoded, PaletteScope::Global).unwrap();
        assert_eq!(again.colors(), p.colors());
        assert_eq!(again.id(), p.id());
        assert_eq!(again.name(), p.name());
    }

    #[test]
    fn decode_malformed_fixture_rejected() {
        let raw = load("palette_malformed.texpal");
        let err = decode(&raw, PaletteScope::Global).unwrap_err();
        assert!(
            err.to_string().contains("invalid-palette-file"),
            "unexpected error: {err}"
        );
    }

    #[test]
    fn decode_wrong_version_fixture_rejected() {
        let raw = load("palette_wrong_version.texpal");
        let err = decode(&raw, PaletteScope::Global).unwrap_err();
        assert!(
            err.to_string().contains("unsupported-version"),
            "unexpected error: {err}"
        );
    }

    #[test]
    fn decode_dedupes_colors_without_error() {
        let raw = r##"{
            "version": 1,
            "id": "2f0c1e4b8a1e4cfe9aab04d611ebbe49",
            "name": "Dupes",
            "colors": ["#FF0000", "#ff0000", "#00FF00"]
        }"##;
        let p = decode(raw, PaletteScope::Global).unwrap();
        assert_eq!(p.colors().len(), 2);
    }

    #[test]
    fn decode_rejects_bad_color_hex() {
        let raw = r##"{"version":1,"id":"2f0c1e4b8a1e4cfe9aab04d611ebbe49","name":"Bad","colors":["red"]}"##;
        assert!(decode(raw, PaletteScope::Global).is_err());
    }

    #[test]
    fn decode_rejects_empty_name() {
        let raw =
            r##"{"version":1,"id":"2f0c1e4b8a1e4cfe9aab04d611ebbe49","name":"","colors":[]}"##;
        assert!(decode(raw, PaletteScope::Global).is_err());
    }

    #[test]
    fn decode_rejects_long_name() {
        let long_name = "a".repeat(65);
        let raw = format!(
            r##"{{"version":1,"id":"2f0c1e4b8a1e4cfe9aab04d611ebbe49","name":"{long_name}","colors":[]}}"##
        );
        assert!(decode(&raw, PaletteScope::Global).is_err());
    }

    #[test]
    fn encode_emits_uppercase_hex() {
        let mut p = Palette::new(
            PaletteId::from_value(0x1234_5678),
            PaletteName::new("Case").unwrap(),
            PaletteScope::Global,
        );
        p.add_color(Color::new(0xAB, 0xCD, 0xEF, 255));
        let json = encode(&p).unwrap();
        assert!(json.contains("#ABCDEF"), "json: {json}");
    }

    #[test]
    fn codec_trait_roundtrips() {
        let codec = TexpalCodec;
        let raw = load("palette_valid.texpal");
        let p = codec.decode(&raw, PaletteScope::Global).unwrap();
        let re = codec.encode(&p).unwrap();
        let again = codec.decode(&re, PaletteScope::Global).unwrap();
        assert_eq!(again.colors(), p.colors());
    }
}
