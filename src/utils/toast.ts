import {
  colors,
  fontSizes,
  fonts,
  radii,
  shadows,
  sizing,
  spacing,
  zIndices,
} from "../styles/theme";

/**
 * Minimal toast helper — no external library. Surfaces a short message in a
 * bottom-right overlay for ~3 seconds. Multiple toasts stack.
 */

const TOAST_DURATION_MS = 3000;
const CONTAINER_ID = "texlab-toast-container";

function ensureContainer(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(CONTAINER_ID);
  if (el) return el;
  el = document.createElement("div");
  el.id = CONTAINER_ID;
  el.style.cssText = [
    "position:fixed",
    `bottom:${spacing.xl}px`,
    `right:${spacing.xl}px`,
    `z-index:${zIndices.toast}`,
    "display:flex",
    "flex-direction:column",
    `gap:${spacing.md}px`,
    "pointer-events:none",
    `font-family:${fonts.ui}`,
  ].join(";");
  document.body.appendChild(el);
  return el;
}

export function showToast(message: string): void {
  const container = ensureContainer();
  if (!container) {
    // Fires when a toast is requested before the DOM is ready (e.g. an
    // error during early boot). We can't surface the message visually —
    // at least leave a trail in the console so the debug loop is possible.
    console.warn("[toast] showToast called before DOM ready:", message);
    return;
  }
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.cssText = [
    `background:${colors.panelHeader}`,
    `color:${colors.textPrimary}`,
    `padding:${spacing.lg}px ${spacing.xl}px`,
    `border-radius:${radii.md}px`,
    `font-size:${fontSizes.sm}px`,
    `border:1px solid ${colors.separator}`,
    `box-shadow:${shadows.toastElevation}`,
    "opacity:0",
    "transition:opacity 150ms ease-out",
    `max-width:${sizing.dialog.minWidth}px`,
    "pointer-events:auto",
  ].join(";");
  container.appendChild(toast);
  // Trigger fade-in on next frame.
  window.requestAnimationFrame(() => {
    toast.style.opacity = "1";
  });
  window.setTimeout(() => {
    toast.style.opacity = "0";
    window.setTimeout(() => toast.remove(), 200);
  }, TOAST_DURATION_MS);
}
