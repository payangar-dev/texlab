import { ChevronDown, FolderClosed, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PaletteDto } from "../../api/commands";
import { colors, fontSizes, fonts } from "../../styles/theme";

interface PaletteDropdownProps {
  palettes: PaletteDto[];
  activePaletteId: string | null;
  onSelect: (paletteId: string | null) => void;
}

/**
 * Custom listbox so each row shows its scope icon (a native `<select>` can
 * not host icons per option). Keyboard-accessible: Space/Enter opens, Escape
 * closes, arrow keys would be a nice-to-have but aren't required by v1.
 */
export function PaletteDropdown({
  palettes,
  activePaletteId,
  onSelect,
}: PaletteDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = palettes.find((p) => p.id === activePaletteId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div style={containerStyle} ref={rootRef}>
      <button
        type="button"
        style={triggerStyle}
        aria-label="Active palette"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={triggerInnerStyle}>
          {active ? <ScopeIcon scope={active.scope} /> : null}
          <span style={nameStyle}>{active?.name ?? "— Select a palette —"}</span>
        </span>
        <ChevronDown size={12} color={colors.textSecondary} />
      </button>
      {open && (
        <div role="listbox" style={menuStyle}>
          {palettes.map((p) => {
            const isActive = p.id === activePaletteId;
            return (
              <div
                key={p.id}
                role="option"
                tabIndex={0}
                aria-selected={isActive}
                style={{
                  ...optionStyle,
                  background: isActive ? colors.selectedItem : "transparent",
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(p.id);
                  setOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(p.id);
                    setOpen(false);
                  }
                }}
              >
                <ScopeIcon scope={p.scope} />
                <span style={nameStyle}>{p.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScopeIcon({ scope }: { scope: "global" | "project" }) {
  const label = scope === "global" ? "Global palette" : "Project palette";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
    >
      {scope === "global" ? (
        <Globe size={12} color={colors.textSecondary} />
      ) : (
        <FolderClosed size={12} color={colors.textSecondary} />
      )}
    </span>
  );
}

const containerStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
};

const triggerStyle: React.CSSProperties = {
  width: "100%",
  height: 26,
  padding: "0 8px",
  background: colors.inputField,
  color: colors.textPrimary,
  border: "none",
  borderRadius: 4,
  fontFamily: fonts.ui,
  fontSize: fontSizes.sm,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  textAlign: "left",
};

const triggerInnerStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
  flex: 1,
};

const nameStyle: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const menuStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 2px)",
  left: 0,
  right: 0,
  background: colors.panelHeader,
  border: `1px solid ${colors.separator}`,
  borderRadius: 4,
  listStyle: "none",
  margin: 0,
  padding: 2,
  maxHeight: 320,
  overflowY: "auto",
  zIndex: 10,
  boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
  fontFamily: fonts.ui,
  fontSize: fontSizes.sm,
  color: colors.textPrimary,
};

const optionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 8px",
  borderRadius: 3,
  cursor: "pointer",
};
