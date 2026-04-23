import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewPaletteDialog } from "./NewPaletteDialog";

afterEach(cleanup);

describe("NewPaletteDialog", () => {
  it("submits a valid name with the selected scope", () => {
    const onSubmit = vi.fn();
    render(
      <NewPaletteDialog canCreateProjectPalette onSubmit={onSubmit} onCancel={vi.fn()} />,
    );
    const input = screen.getByLabelText("Palette name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Nether" } });
    fireEvent.click(screen.getByText("Create"));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Nether", scope: "global" });
  });

  it("surfaces a validation error inline on empty name", () => {
    const onSubmit = vi.fn();
    render(
      <NewPaletteDialog canCreateProjectPalette onSubmit={onSubmit} onCancel={vi.fn()} />,
    );
    fireEvent.click(screen.getByText("Create"));
    expect(screen.getByRole("alert")).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the project radio when no project is open", () => {
    render(
      <NewPaletteDialog
        canCreateProjectPalette={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const radios = document.querySelectorAll<HTMLInputElement>('input[name="scope"]');
    const projectRadio = Array.from(radios).find((r) => r.value === "project");
    expect(projectRadio?.disabled).toBe(true);
  });

  it("lets project scope be selected when available", () => {
    const onSubmit = vi.fn();
    render(
      <NewPaletteDialog canCreateProjectPalette onSubmit={onSubmit} onCancel={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("Palette name"), {
      target: { value: "Proj" },
    });
    const radios = document.querySelectorAll<HTMLInputElement>('input[name="scope"]');
    const projectRadio = Array.from(radios).find((r) => r.value === "project");
    if (!projectRadio) throw new Error("project radio missing");
    fireEvent.click(projectRadio);
    fireEvent.click(screen.getByText("Create"));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Proj", scope: "project" });
  });

  it("Escape cancels", () => {
    const onCancel = vi.fn();
    render(
      <NewPaletteDialog canCreateProjectPalette onSubmit={vi.fn()} onCancel={onCancel} />,
    );
    fireEvent.keyDown(screen.getByLabelText("Palette name"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
