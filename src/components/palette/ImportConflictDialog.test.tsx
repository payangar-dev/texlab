import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportConflictDialog } from "./ImportConflictDialog";

afterEach(cleanup);

describe("ImportConflictDialog", () => {
  it("focuses the Rename button by default and pre-fills the suggested name", () => {
    render(<ImportConflictDialog suggestedName="Blues (2)" onStrategy={vi.fn()} />);
    expect(document.activeElement?.textContent).toBe("Rename");
    expect(screen.getByDisplayValue("Blues (2)")).toBeDefined();
  });

  it("Rename fires with the edited name", () => {
    const onStrategy = vi.fn();
    render(<ImportConflictDialog suggestedName="Blues (2)" onStrategy={onStrategy} />);
    fireEvent.change(screen.getByLabelText("New palette name"), {
      target: { value: "Blues backup" },
    });
    fireEvent.click(screen.getByText("Rename"));
    expect(onStrategy).toHaveBeenCalledWith({
      action: "rename",
      newName: "Blues backup",
    });
  });

  it("Overwrite fires with overwrite strategy", () => {
    const onStrategy = vi.fn();
    render(<ImportConflictDialog suggestedName="X" onStrategy={onStrategy} />);
    fireEvent.click(screen.getByText("Overwrite"));
    expect(onStrategy).toHaveBeenCalledWith({ action: "overwrite" });
  });

  it("Cancel fires with cancel strategy", () => {
    const onStrategy = vi.fn();
    render(<ImportConflictDialog suggestedName="X" onStrategy={onStrategy} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onStrategy).toHaveBeenCalledWith({ action: "cancel" });
  });
});
