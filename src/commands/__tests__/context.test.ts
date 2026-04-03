import { afterEach, describe, expect, it } from "vitest";
import { getContext, initContext } from "../context";

describe("initContext and getContext", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("sets inputFocused to true when an INPUT receives focus", () => {
    cleanup = initContext();

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const ctx = getContext();
    expect(ctx.get("inputFocused")).toBe(true);

    document.body.removeChild(input);
  });

  it("sets inputFocused to true when a TEXTAREA receives focus", () => {
    cleanup = initContext();

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();

    const ctx = getContext();
    expect(ctx.get("inputFocused")).toBe(true);

    document.body.removeChild(textarea);
  });

  // jsdom does not fully support isContentEditable on focused elements.
  // This behavior is verified manually in the real browser.
  it.skip("sets inputFocused to true for contentEditable elements", () => {
    cleanup = initContext();

    const div = document.createElement("div");
    div.contentEditable = "true";
    document.body.appendChild(div);
    div.focus();

    const ctx = getContext();
    expect(ctx.get("inputFocused")).toBe(true);

    document.body.removeChild(div);
  });

  it("resets inputFocused when focus moves to a non-input element", () => {
    cleanup = initContext();

    const input = document.createElement("input");
    const button = document.createElement("button");
    document.body.appendChild(input);
    document.body.appendChild(button);

    input.focus();
    expect(getContext().get("inputFocused")).toBe(true);

    button.focus();
    expect(getContext().get("inputFocused")).toBe(false);

    document.body.removeChild(input);
    document.body.removeChild(button);
  });

  it("keeps inputFocused true when focus moves between two inputs", () => {
    cleanup = initContext();

    const input1 = document.createElement("input");
    const input2 = document.createElement("input");
    document.body.appendChild(input1);
    document.body.appendChild(input2);

    input1.focus();
    expect(getContext().get("inputFocused")).toBe(true);

    input2.focus();
    expect(getContext().get("inputFocused")).toBe(true);

    document.body.removeChild(input1);
    document.body.removeChild(input2);
  });

  it("detects dialogOpen via lazy DOM query", () => {
    cleanup = initContext();

    const ctx = getContext();
    expect(ctx.get("dialogOpen")).toBe(false);

    // jsdom doesn't support <dialog> show/showModal natively,
    // but we can add the open attribute directly
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    document.body.appendChild(dialog);

    expect(getContext().get("dialogOpen")).toBe(true);

    dialog.removeAttribute("open");
    expect(getContext().get("dialogOpen")).toBe(false);

    document.body.removeChild(dialog);
  });

  it("cleans up listeners on cleanup call", () => {
    cleanup = initContext();
    cleanup();
    cleanup = undefined;

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    // After cleanup, context should not track focus changes
    // getContext still works but inputFocused is cleared
    const ctx = getContext();
    expect(ctx.get("inputFocused")).toBeUndefined();

    document.body.removeChild(input);
  });
});
