import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaletteActionBar } from "./PaletteActionBar";

afterEach(cleanup);

function renderBar(
  overrides: Partial<React.ComponentProps<typeof PaletteActionBar>> = {},
) {
  const handlers = {
    onNew: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onTogglePipette: vi.fn(),
    onAddPrimary: vi.fn(),
    onSave: vi.fn(),
    onLoad: vi.fn(),
  };
  const result = render(
    <PaletteActionBar
      hasActivePalette
      pipetteActive={false}
      saveLoadEnabled
      {...handlers}
      {...overrides}
    />,
  );
  return { ...result, handlers };
}

describe("PaletteActionBar", () => {
  it("fires onNew when New is clicked", () => {
    const { handlers } = renderBar();
    fireEvent.click(screen.getByLabelText("New palette"));
    expect(handlers.onNew).toHaveBeenCalled();
  });

  it("disables Rename/Delete/Pipette/AddPrimary when no active palette", () => {
    renderBar({ hasActivePalette: false });
    expect((screen.getByLabelText("Rename palette") as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByLabelText("Delete palette") as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByLabelText("Toggle pipette mode") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Add primary color") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("marks Pipette button as pressed when pipetteActive", () => {
    renderBar({ pipetteActive: true });
    const btn = screen.getByLabelText("Toggle pipette mode") as HTMLButtonElement;
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("disables Save/Load when saveLoadEnabled is false", () => {
    renderBar({ saveLoadEnabled: false });
    expect((screen.getByLabelText("Save palette") as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByLabelText("Load palette") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
