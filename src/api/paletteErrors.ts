/**
 * Centralized classifier for palette-related `AppError::Validation`
 * payloads. The Rust side encodes each error as a stable
 * `<kind>[:<arg>...]` string so the frontend can pattern-match without
 * regex gymnastics.
 */

export type PaletteErrorKind =
  | "collision"
  | "malformed"
  | "nameInvalid"
  | "duplicate"
  | "notFound"
  | "noProject"
  | "io"
  | "generic";

export interface ClassifiedPaletteError {
  kind: PaletteErrorKind;
  /** A human-facing message suitable for a toast or inline form error. */
  message: string;
  /** Present when kind === "collision" — the existing palette id. */
  existingId?: string;
  /** Present when kind === "collision" — the backend-suggested unique name. */
  suggested?: string;
}

function asString(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "toString" in err) {
    return String(err);
  }
  return "unknown error";
}

export function classifyPaletteError(err: unknown): ClassifiedPaletteError {
  const raw = asString(err);

  if (raw.includes("palette-name-collision:")) {
    const after = raw.slice(
      raw.indexOf("palette-name-collision:") + "palette-name-collision:".length,
    );
    const [existingId, ...nameParts] = after.split(":");
    const suggested = nameParts.join(":").trim();
    return {
      kind: "collision",
      message: "A palette with this name already exists.",
      existingId: existingId.trim(),
      suggested,
    };
  }

  if (raw.includes("invalid-palette-file")) {
    const reason = raw.split("invalid-palette-file:")[1]?.trim() ?? "parse error";
    return {
      kind: "malformed",
      message: reason,
    };
  }

  if (raw.includes("invalid-palette-name")) {
    const reason = raw.split("invalid-palette-name:")[1]?.trim() ?? "invalid name";
    return { kind: "nameInvalid", message: reason };
  }

  if (raw.includes("duplicate-palette-name")) {
    return { kind: "duplicate", message: "A palette with this name already exists." };
  }

  if (raw.includes("palette-not-found")) {
    return { kind: "notFound", message: "Palette not found." };
  }

  if (raw.includes("no-project-open")) {
    return {
      kind: "noProject",
      message: "Open a project to use project-scoped palettes.",
    };
  }

  if (raw.includes("io-error")) {
    const reason = raw.split("io-error:")[1]?.trim() ?? "I/O error";
    return { kind: "io", message: reason };
  }

  return { kind: "generic", message: raw };
}
