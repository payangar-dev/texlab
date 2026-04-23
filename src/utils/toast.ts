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
    "bottom:12px",
    "right:12px",
    "z-index:2000",
    "display:flex",
    "flex-direction:column",
    "gap:6px",
    "pointer-events:none",
    "font-family:Inter, system-ui, sans-serif",
  ].join(";");
  document.body.appendChild(el);
  return el;
}

export function showToast(message: string): void {
  const container = ensureContainer();
  if (!container) return;
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.cssText = [
    "background:#2A2A2A",
    "color:#E0E0E0",
    "padding:8px 12px",
    "border-radius:4px",
    "font-size:12px",
    "border:1px solid #3A3A3A",
    "box-shadow:0 2px 8px rgba(0,0,0,0.4)",
    "opacity:0",
    "transition:opacity 150ms ease-out",
    "max-width:320px",
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
