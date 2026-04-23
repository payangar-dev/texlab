/**
 * Mirrors the PaletteName constraints enforced by the Rust domain layer
 * (`PaletteName::new`). Keep in sync with `src-tauri/src/domain/palette.rs`.
 */
export function validatePaletteName(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "Name cannot be empty.";
  if (trimmed !== raw) return "Leading or trailing whitespace is not allowed.";
  if (Array.from(trimmed).length > 64) return "Name is too long (max 64 characters).";
  return null;
}
