import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BlendModeSelect } from "./BlendModeSelect";

afterEach(cleanup);

describe("BlendModeSelect", () => {
  it("renders all four blend modes", () => {
    render(<BlendModeSelect value="normal" onChange={() => {}} />);
    const select = screen.getByRole("combobox");
    const options = select.querySelectorAll("option");
    expect(options).toHaveLength(4);
    expect(options[0].textContent).toBe("Normal");
    expect(options[1].textContent).toBe("Multiply");
    expect(options[2].textContent).toBe("Screen");
    expect(options[3].textContent).toBe("Overlay");
  });

  it("reflects the current value", () => {
    render(<BlendModeSelect value="multiply" onChange={() => {}} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("multiply");
  });

  it("calls onChange when user selects a different mode", () => {
    const onChange = vi.fn();
    render(<BlendModeSelect value="normal" onChange={onChange} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "screen" } });
    expect(onChange).toHaveBeenCalledWith("screen");
  });

  it("displays the Blend label", () => {
    render(<BlendModeSelect value="normal" onChange={() => {}} />);
    expect(screen.getByText("Blend")).toBeDefined();
  });
});
