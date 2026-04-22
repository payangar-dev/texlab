//! Palette domain types.
//!
//! A palette is a named, ordered, opaque-only, dedup-on-add color list
//! scoped to either the global library or a project. These types are pure:
//! no serde, no uuid, no IO. Persistence is handled by `infrastructure` and
//! transport by `commands/dto.rs`.

use std::collections::HashMap;
use std::path::PathBuf;

use crate::domain::color::Color;
use crate::domain::error::DomainError;

/// Maximum palette name length in Unicode scalar values (chars).
const PALETTE_NAME_MAX_CHARS: usize = 64;

/// Palette name value object — trimmed, NFC-ish, 1..=64 chars, non-empty,
/// non-whitespace-only.
///
/// NFC normalization: we do not import `unicode-normalization` to keep the
/// domain `std`-only. Instead we reject names that contain characters which
/// typically vary across forms (combining marks) by leaving them intact —
/// uniqueness comparison happens by exact string match after trimming, which
/// is a conservative approximation of NFC behavior for practical palette
/// names. If two users type the same-looking name with different composition
/// forms, they remain distinct palettes; this matches the conservative
/// clarification in research.md §4.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct PaletteName(String);

impl PaletteName {
    pub fn new(raw: &str) -> Result<Self, DomainError> {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return Err(DomainError::InvalidInput {
                reason: "palette name must not be empty".to_owned(),
            });
        }
        // Reject names that differ from their trimmed form (outer whitespace).
        if trimmed != raw {
            return Err(DomainError::InvalidInput {
                reason: "palette name must not start or end with whitespace".to_owned(),
            });
        }
        let char_count = trimmed.chars().count();
        if char_count > PALETTE_NAME_MAX_CHARS {
            return Err(DomainError::InvalidInput {
                reason: format!(
                    "palette name too long ({char_count} chars, max {PALETTE_NAME_MAX_CHARS})"
                ),
            });
        }
        Ok(Self(trimmed.to_owned()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Case-insensitive ASCII comparison used for uniqueness detection on
    /// NTFS (Windows). Non-ASCII characters compare verbatim.
    #[cfg(target_os = "windows")]
    pub fn eq_ignore_ascii_case(&self, other: &Self) -> bool {
        self.0.eq_ignore_ascii_case(&other.0)
    }
}

/// Stable, opaque palette identifier. Persisted inside `.texpal` files as a
/// 32-char zero-padded hex string. Survives rename.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct PaletteId(u128);

impl PaletteId {
    pub fn from_value(value: u128) -> Self {
        Self(value)
    }

    pub fn value(self) -> u128 {
        self.0
    }

    /// Parses a 32-char zero-padded lowercase hex string. Shorter inputs are
    /// accepted as a convenience (parsed as `u128`), matching the layer-id
    /// pattern in `commands/dto.rs::parse_layer_id`.
    pub fn from_hex(hex: &str) -> Result<Self, DomainError> {
        u128::from_str_radix(hex, 16)
            .map(Self)
            .map_err(|_| DomainError::InvalidInput {
                reason: format!("invalid palette id hex {hex:?}"),
            })
    }

    pub fn to_hex_string(self) -> String {
        format!("{:032x}", self.0)
    }
}

/// Global (shared across projects) vs. Project (scoped to a single project).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum PaletteScope {
    Global,
    Project,
}

/// Named concept for a palette color entry. Wraps [`Color`] so future
/// per-swatch metadata (tags, notes) can be added without churning callers.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Swatch {
    color: Color,
}

impl Swatch {
    pub fn new(color: Color) -> Self {
        Self { color }
    }

    pub fn color(&self) -> Color {
        self.color
    }
}

/// Outcome of [`Palette::add_color`]. See FR-011.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AddColorOutcome {
    Added { index: usize },
    AlreadyPresent { index: usize },
}

/// Named, ordered, no-duplicates color list. Scope is fixed for the lifetime
/// of the entity (Clarification 2026-04-22 Q7).
#[derive(Clone, Debug)]
pub struct Palette {
    id: PaletteId,
    name: PaletteName,
    scope: PaletteScope,
    colors: Vec<Color>,
}

impl Palette {
    pub fn new(id: PaletteId, name: PaletteName, scope: PaletteScope) -> Self {
        Self {
            id,
            name,
            scope,
            colors: Vec::new(),
        }
    }

    /// Rebuilds a palette from persisted fields, used by the file codec.
    /// Deduplicates colors preserving first occurrence (FR-011 invariant +
    /// research.md §2 — silent dedupe on read with a warning logged by the
    /// codec, not here).
    pub fn from_parts(
        id: PaletteId,
        name: PaletteName,
        scope: PaletteScope,
        colors: Vec<Color>,
    ) -> Self {
        let mut deduped: Vec<Color> = Vec::with_capacity(colors.len());
        for raw in colors {
            let color = Color::new(raw.r(), raw.g(), raw.b(), 255);
            if !deduped.contains(&color) {
                deduped.push(color);
            }
        }
        Self {
            id,
            name,
            scope,
            colors: deduped,
        }
    }

    pub fn id(&self) -> PaletteId {
        self.id
    }

    pub fn name(&self) -> &PaletteName {
        &self.name
    }

    pub fn scope(&self) -> PaletteScope {
        self.scope
    }

    pub fn colors(&self) -> &[Color] {
        &self.colors
    }

    pub fn len(&self) -> usize {
        self.colors.len()
    }

    pub fn is_empty(&self) -> bool {
        self.colors.is_empty()
    }

    /// Appends a color at the end, forcing `a = 255`. Returns
    /// [`AddColorOutcome::AlreadyPresent`] with the existing index when the
    /// color is already in the palette (FR-011).
    pub fn add_color(&mut self, color: Color) -> AddColorOutcome {
        let opaque = Color::new(color.r(), color.g(), color.b(), 255);
        if let Some(index) = self.colors.iter().position(|c| *c == opaque) {
            return AddColorOutcome::AlreadyPresent { index };
        }
        self.colors.push(opaque);
        AddColorOutcome::Added {
            index: self.colors.len() - 1,
        }
    }

    pub fn remove_color_at(&mut self, index: usize) -> Result<Color, DomainError> {
        if index >= self.colors.len() {
            return Err(DomainError::InvalidIndex {
                index,
                len: self.colors.len(),
            });
        }
        Ok(self.colors.remove(index))
    }

    /// Removes the first swatch whose RGB equals the given color. Returns the
    /// removed index. Used by the Delete-key flow (FR-012).
    pub fn remove_color(&mut self, color: Color) -> Result<usize, DomainError> {
        let opaque = Color::new(color.r(), color.g(), color.b(), 255);
        match self.colors.iter().position(|c| *c == opaque) {
            Some(index) => {
                self.colors.remove(index);
                Ok(index)
            }
            None => Err(DomainError::InvalidInput {
                reason: "color not present in palette".to_owned(),
            }),
        }
    }

    pub fn rename(&mut self, new_name: PaletteName) {
        self.name = new_name;
    }
}

/// Per-context active-palette memory (FR-023a). Persistence lives behind
/// the [`crate::domain::ports::ActiveMemoryStore`] port; this struct is
/// the domain's view.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct ActiveMemory {
    pub global: Option<PaletteId>,
    pub projects: HashMap<PathBuf, PaletteId>,
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    fn pid(n: u128) -> PaletteId {
        PaletteId::from_value(n)
    }

    fn pname(s: &str) -> PaletteName {
        PaletteName::new(s).unwrap()
    }

    fn palette(name: &str) -> Palette {
        Palette::new(pid(1), pname(name), PaletteScope::Global)
    }

    // --- PaletteName ---

    #[test]
    fn palette_name_rejects_empty() {
        assert!(PaletteName::new("").is_err());
    }

    #[test]
    fn palette_name_rejects_whitespace_only() {
        assert!(PaletteName::new("   ").is_err());
    }

    #[test]
    fn palette_name_rejects_leading_trailing_whitespace() {
        assert!(PaletteName::new(" Blues").is_err());
        assert!(PaletteName::new("Blues ").is_err());
    }

    #[test]
    fn palette_name_accepts_1_char() {
        assert_eq!(PaletteName::new("A").unwrap().as_str(), "A");
    }

    #[test]
    fn palette_name_accepts_64_chars() {
        let s: String = "a".repeat(64);
        assert_eq!(PaletteName::new(&s).unwrap().as_str(), s);
    }

    #[test]
    fn palette_name_rejects_65_chars() {
        let s: String = "a".repeat(65);
        assert!(PaletteName::new(&s).is_err());
    }

    #[test]
    fn palette_name_equality_case_sensitive() {
        assert_ne!(pname("Blues"), pname("blues"));
    }

    // --- PaletteId ---

    #[test]
    fn palette_id_hex_roundtrip() {
        let id = pid(0xdead_beef);
        assert_eq!(id.to_hex_string().len(), 32);
        assert_eq!(PaletteId::from_hex(&id.to_hex_string()).unwrap(), id);
    }

    #[test]
    fn palette_id_rejects_non_hex() {
        assert!(PaletteId::from_hex("zzz").is_err());
    }

    #[test]
    fn palette_id_short_hex_accepted() {
        assert_eq!(PaletteId::from_hex("2a").unwrap().value(), 42);
    }

    // --- PaletteScope ---

    #[test]
    fn palette_scope_eq_hash() {
        use std::collections::HashSet;
        let mut set = HashSet::new();
        set.insert(PaletteScope::Global);
        assert!(set.contains(&PaletteScope::Global));
        assert!(!set.contains(&PaletteScope::Project));
    }

    // --- Palette ordering + dedupe ---

    #[test]
    fn new_palette_is_empty() {
        let p = palette("P");
        assert!(p.is_empty());
        assert_eq!(p.len(), 0);
    }

    #[test]
    fn add_color_preserves_insertion_order() {
        let mut p = palette("P");
        p.add_color(Color::new(1, 2, 3, 255));
        p.add_color(Color::new(4, 5, 6, 255));
        p.add_color(Color::new(7, 8, 9, 255));
        assert_eq!(
            p.colors(),
            &[
                Color::new(1, 2, 3, 255),
                Color::new(4, 5, 6, 255),
                Color::new(7, 8, 9, 255),
            ]
        );
    }

    #[test]
    fn add_color_dedupes_on_exact_rgb() {
        let mut p = palette("P");
        let first = p.add_color(Color::new(10, 20, 30, 255));
        let second = p.add_color(Color::new(10, 20, 30, 255));
        assert!(matches!(first, AddColorOutcome::Added { index: 0 }));
        assert!(matches!(
            second,
            AddColorOutcome::AlreadyPresent { index: 0 }
        ));
        assert_eq!(p.len(), 1);
    }

    #[test]
    fn add_color_forces_opaque_alpha() {
        let mut p = palette("P");
        p.add_color(Color::new(10, 20, 30, 0));
        p.add_color(Color::new(10, 20, 30, 255));
        assert_eq!(p.len(), 1, "alpha must be normalized for dedupe");
        assert_eq!(p.colors()[0].a(), 255);
    }

    #[test]
    fn remove_color_at_in_range() {
        let mut p = palette("P");
        p.add_color(Color::new(1, 2, 3, 255));
        p.add_color(Color::new(4, 5, 6, 255));
        let removed = p.remove_color_at(0).unwrap();
        assert_eq!(removed, Color::new(1, 2, 3, 255));
        assert_eq!(p.len(), 1);
    }

    #[test]
    fn remove_color_at_out_of_range() {
        let mut p = palette("P");
        let err = p.remove_color_at(0).unwrap_err();
        assert!(matches!(err, DomainError::InvalidIndex { .. }));
    }

    #[test]
    fn remove_color_by_value_found() {
        let mut p = palette("P");
        p.add_color(Color::new(1, 2, 3, 255));
        p.add_color(Color::new(4, 5, 6, 255));
        let index = p.remove_color(Color::new(4, 5, 6, 128)).unwrap();
        assert_eq!(index, 1);
        assert_eq!(p.len(), 1);
    }

    #[test]
    fn remove_color_by_value_not_found() {
        let mut p = palette("P");
        p.add_color(Color::new(1, 2, 3, 255));
        assert!(p.remove_color(Color::new(9, 9, 9, 255)).is_err());
    }

    #[test]
    fn rename_changes_name() {
        let mut p = palette("Old");
        p.rename(pname("New"));
        assert_eq!(p.name().as_str(), "New");
    }

    #[test]
    fn from_parts_dedupes_silently() {
        let p = Palette::from_parts(
            pid(1),
            pname("P"),
            PaletteScope::Global,
            vec![
                Color::new(1, 2, 3, 128),
                Color::new(1, 2, 3, 64),
                Color::new(4, 5, 6, 255),
            ],
        );
        assert_eq!(p.len(), 2);
    }

    // --- Swatch ---

    #[test]
    fn swatch_wraps_color() {
        let s = Swatch::new(Color::new(1, 2, 3, 255));
        assert_eq!(s.color(), Color::new(1, 2, 3, 255));
    }

    // --- AddColorOutcome ---

    #[test]
    fn outcome_added_carries_index() {
        let o = AddColorOutcome::Added { index: 4 };
        assert!(matches!(o, AddColorOutcome::Added { index: 4 }));
    }
}
