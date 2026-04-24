import { ChevronDown, FolderClosed, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PaletteDto } from "../../api/commands";
import {
  colors,
  fontSizes,
  fonts,
  iconSizes,
  radii,
  shadows,
  sizing,
  spacing,
  zIndices,
} from "../../styles/theme";

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
        <ChevronDown size={iconSizes.sm} color={colors.textSecondary} />
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
                  background: isActive ? colors.selectedItem : colors.transparent,
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
        <Globe size={iconSizes.sm} color={colors.textSecondary} />
      ) : (
        <FolderClosed size={iconSizes.sm} color={colors.textSecondary} />
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
  height: sizing.input.sm,
  padding: `0 ${spacing.md}px`,
  background: colors.inputField,
  color: colors.textTitle,
  border: "none",
  borderRadius: radii.md,
  fontFamily: fonts.ui,
  fontSize: fontSizes.xs,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.md,
  textAlign: "left",
};

const triggerInnerStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: spacing.md,
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
  top: `calc(100% + ${spacing.xs}px)`,
  left: 0,
  right: 0,
  background: colors.panelHeader,
  border: `1px solid ${colors.separator}`,
  borderRadius: radii.md,
  listStyle: "none",
  margin: 0,
  padding: spacing.xs,
  maxHeight: sizing.dropdownMaxHeight,
  overflowY: "auto",
  zIndex: zIndices.dropdown,
  boxShadow: shadows.dropdownElevation,
  fontFamily: fonts.ui,
  fontSize: fontSizes.xs,
  color: colors.textPrimary,
};

const optionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing.md,
  padding: `${spacing.sm}px ${spacing.md}px`,
  borderRadius: radii.xs,
  cursor: "pointer",
};
