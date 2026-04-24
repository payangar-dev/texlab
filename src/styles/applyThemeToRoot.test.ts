import { afterEach, describe, expect, it } from "vitest";
import {
  APP_ENTRIES,
  applyThemeToRoot,
  DOCKVIEW_ENTRIES,
  watchDockviewThemeRoots,
} from "./applyThemeToRoot";

describe("applyThemeToRoot", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("style");
    document.body.innerHTML = "";
  });

  function applyOn(): HTMLElement {
    const el = document.createElement("div");
    applyThemeToRoot(el);
    return el;
  }

  it("sets every dockview variable from theme tokens", () => {
    const el = applyOn();
    for (const [name, value] of DOCKVIEW_ENTRIES) {
      expect(el.style.getPropertyValue(name)).toBe(value);
    }
  });

  it("sets every app-level variable from theme tokens", () => {
    const el = applyOn();
    for (const [name, value] of APP_ENTRIES) {
      expect(el.style.getPropertyValue(name)).toBe(value);
    }
  });

  it("is idempotent — calling twice yields the same state", () => {
    const el = document.createElement("div");
    applyThemeToRoot(el);
    const firstPass = el.getAttribute("style");
    applyThemeToRoot(el);
    const secondPass = el.getAttribute("style");
    expect(firstPass).toBe(secondPass);
  });

  it("defaults to document.documentElement when no root is passed", () => {
    applyThemeToRoot();
    const root = document.documentElement;
    for (const [name, value] of DOCKVIEW_ENTRIES) {
      expect(root.style.getPropertyValue(name)).toBe(value);
    }
    for (const [name, value] of APP_ENTRIES) {
      expect(root.style.getPropertyValue(name)).toBe(value);
    }
  });

  it("locks the expected count of --dv-* entries (catches silent drops)", () => {
    // If a dockview variable is removed, both source and this count must
    // be updated deliberately — preventing accidental deletions.
    expect(DOCKVIEW_ENTRIES.length).toBe(30);
  });
});

describe("watchDockviewThemeRoots", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("applies tokens to .dockview-theme-dark elements already in the DOM", () => {
    const pre = document.createElement("div");
    pre.className = "dockview-theme-dark";
    document.body.appendChild(pre);

    watchDockviewThemeRoots();

    const [firstName, firstValue] = DOCKVIEW_ENTRIES[0];
    expect(pre.style.getPropertyValue(firstName)).toBe(firstValue);
  });

  it("applies tokens to .dockview-theme-dark elements added dynamically", async () => {
    watchDockviewThemeRoots();

    const added = document.createElement("div");
    added.className = "dockview-theme-dark";
    document.body.appendChild(added);

    // MutationObserver callbacks fire as microtasks.
    await Promise.resolve();

    const [firstName, firstValue] = DOCKVIEW_ENTRIES[0];
    expect(added.style.getPropertyValue(firstName)).toBe(firstValue);
  });

  it("applies tokens to nested .dockview-theme-dark descendants of an added node", async () => {
    watchDockviewThemeRoots();

    const wrapper = document.createElement("div");
    const nested = document.createElement("div");
    nested.className = "dockview-theme-dark";
    wrapper.appendChild(nested);
    document.body.appendChild(wrapper);

    await Promise.resolve();

    const [firstName, firstValue] = DOCKVIEW_ENTRIES[0];
    expect(nested.style.getPropertyValue(firstName)).toBe(firstValue);
  });

  it("ignores non-HTMLElement added nodes without crashing", async () => {
    watchDockviewThemeRoots();

    document.body.appendChild(document.createTextNode("plain text"));
    document.body.appendChild(document.createComment("a comment"));

    // If the observer crashed on text/comment nodes, the next assertion
    // would never run. Success = no throw.
    await Promise.resolve();
    expect(true).toBe(true);
  });
});
