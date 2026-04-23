import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PaletteDto } from "../../api/commands";
import { PaletteDropdown } from "./PaletteDropdown";

afterEach(cleanup);

function samplePalettes(): PaletteDto[] {
  return [
    { id: "aa", name: "Alpha", scope: "global", colors: [] },
    { id: "bb", name: "Bravo", scope: "project", colors: [] },
  ];
}

describe("PaletteDropdown", () => {
  it("renders the active palette name in the trigger", () => {
    render(
      <PaletteDropdown
        palettes={samplePalettes()}
        activePaletteId="aa"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Alpha")).toBeDefined();
  });

  it("opens the menu on click and renders all options", () => {
    render(
      <PaletteDropdown
        palettes={samplePalettes()}
        activePaletteId={null}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("Active palette"));
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeDefined();
    expect(screen.getAllByText("Alpha")).toHaveLength(1);
    expect(screen.getAllByText("Bravo")).toHaveLength(1);
  });

  it("fires onSelect when a row is clicked", () => {
    const onSelect = vi.fn();
    render(
      <PaletteDropdown
        palettes={samplePalettes()}
        activePaletteId={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByLabelText("Active palette"));
    fireEvent.mouseDown(screen.getByText("Bravo"));
    expect(onSelect).toHaveBeenCalledWith("bb");
  });

  it("renders a global scope icon for each global row", () => {
    const { container } = render(
      <PaletteDropdown
        palettes={samplePalettes()}
        activePaletteId="aa"
        onSelect={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("Active palette"));
    const icons = container.querySelectorAll('[aria-label="Global palette"]');
    expect(icons.length).toBeGreaterThan(0);
  });

  it("renders a project scope icon for each project row", () => {
    const { container } = render(
      <PaletteDropdown
        palettes={samplePalettes()}
        activePaletteId="bb"
        onSelect={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("Active palette"));
    const icons = container.querySelectorAll('[aria-label="Project palette"]');
    expect(icons.length).toBeGreaterThan(0);
  });
});
