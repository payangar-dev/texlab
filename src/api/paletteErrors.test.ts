import { describe, expect, it } from "vitest";
import { classifyPaletteError } from "./paletteErrors";

describe("classifyPaletteError", () => {
  it("classifies collision with id and suggested name", () => {
    const c = classifyPaletteError(
      "palette-name-collision:2f0c1e4b8a1e4cfe9aab04d611ebbe49:Signature (2)",
    );
    expect(c.kind).toBe("collision");
    expect(c.existingId).toBe("2f0c1e4b8a1e4cfe9aab04d611ebbe49");
    expect(c.suggested).toBe("Signature (2)");
  });

  it("handles suggested names that contain colons", () => {
    const c = classifyPaletteError("palette-name-collision:abc:Colon: In Name");
    expect(c.suggested).toBe("Colon: In Name");
  });

  it("classifies malformed file", () => {
    const c = classifyPaletteError("invalid-palette-file:parse:unexpected EOF");
    expect(c.kind).toBe("malformed");
    expect(c.message).toContain("unexpected EOF");
  });

  it("classifies invalid name", () => {
    const c = classifyPaletteError("invalid-palette-name:palette name must not be empty");
    expect(c.kind).toBe("nameInvalid");
  });

  it("classifies duplicate", () => {
    const c = classifyPaletteError("duplicate-palette-name");
    expect(c.kind).toBe("duplicate");
  });

  it("classifies io", () => {
    const c = classifyPaletteError("io-error:permission denied");
    expect(c.kind).toBe("io");
    expect(c.message).toBe("permission denied");
  });

  it("falls back to generic for unknown payloads", () => {
    const c = classifyPaletteError("something unrecognized");
    expect(c.kind).toBe("generic");
    expect(c.message).toBe("something unrecognized");
  });

  it("accepts Error instances", () => {
    const c = classifyPaletteError(new Error("palette-not-found"));
    expect(c.kind).toBe("notFound");
  });
});
