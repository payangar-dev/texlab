import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useToolStore } from "../../store/toolStore";
import { SwatchGrid } from "./SwatchGrid";

beforeEach(() => {
  useToolStore.setState({
    activeColor: { r: 0, g: 0, b: 0, a: 255 },
    secondaryColor: { r: 255, g: 255, b: 255, a: 255 },
    activeSlot: "primary",
  });
});

afterEach(cleanup);

describe("SwatchGrid", () => {
  it("renders an ordered grid of tiles", () => {
    render(<SwatchGrid colors={["#112233", "#445566", "#778899"]} />);
    const tiles = screen.getAllByRole("button");
    expect(tiles).toHaveLength(3);
    expect((tiles[0] as HTMLElement).dataset.hex).toBe("#112233");
    expect((tiles[2] as HTMLElement).dataset.hex).toBe("#778899");
  });

  it("left-click sets the primary color", () => {
    render(<SwatchGrid colors={["#AABBCC"]} />);
    const tile = screen.getAllByRole("button")[0];
    fireEvent.mouseDown(tile, { button: 0 });
    const state = useToolStore.getState();
    expect(state.activeColor).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc, a: 255 });
  });

  it("right-click sets the secondary color", () => {
    render(<SwatchGrid colors={["#DDEEFF"]} />);
    const tile = screen.getAllByRole("button")[0];
    fireEvent.mouseDown(tile, { button: 2 });
    const state = useToolStore.getState();
    expect(state.secondaryColor).toEqual({ r: 0xdd, g: 0xee, b: 0xff, a: 255 });
  });

  it("renders an empty-state when no swatches", () => {
    render(<SwatchGrid colors={[]} />);
    expect(screen.getByText(/This palette has no swatches/)).toBeDefined();
  });

  it("applies a primary ring when a swatch matches the active color", () => {
    useToolStore.setState({ activeColor: { r: 0x11, g: 0x22, b: 0x33, a: 255 } });
    const { container } = render(<SwatchGrid colors={["#112233"]} />);
    const tile = container.querySelector('[data-hex="#112233"]') as HTMLElement;
    expect(tile.style.boxShadow).toMatch(/2px/);
  });

  it("renders 256 swatches", () => {
    const many: string[] = [];
    for (let i = 0; i < 256; i++) {
      many.push(`#${i.toString(16).padStart(2, "0").toUpperCase()}8080`);
    }
    const { container } = render(<SwatchGrid colors={many} />);
    expect(container.querySelectorAll("[data-hex]")).toHaveLength(256);
  });
});
