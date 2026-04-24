import type { LucideIcon } from "lucide-react";
import { colors, iconSizes, opacities, radii, sizing } from "../../styles/theme";

export interface IconButtonProps {
  /** Lucide icon component rendered inside the button. */
  icon: LucideIcon;
  /** Hover title and accessible name. */
  title: string;
  "aria-label"?: string;
  onClick?: () => void;
  disabled?: boolean;
  /**
   * Toggle state for buttons that represent an on/off mode (e.g. the
   * pipette in the Palette action bar). When true, renders with accent
   * background and sets `aria-pressed="true"`. Omit for plain action
   * buttons — no ARIA pressed attribute is emitted in that case.
   */
  toggled?: boolean;
}

/**
 * Shared small icon-only button used by panel action bars. Guarantees
 * identical height, width, corner radius, background, and icon size
 * across every panel, preventing per-panel drift in action-bar
 * affordances.
 */
export function IconButton({
  icon: Icon,
  title,
  "aria-label": ariaLabel,
  onClick,
  disabled = false,
  toggled,
}: IconButtonProps) {
  const isOn = toggled === true;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? title}
      aria-pressed={toggled}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: sizing.iconButton,
        height: sizing.iconButton,
        borderRadius: radii.md,
        background: isOn ? colors.accent : colors.inputField,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: 0,
        opacity: disabled ? opacities.dimmed : opacities.full,
      }}
    >
      <Icon size={iconSizes.sm} color={isOn ? colors.white : colors.textSecondary} />
    </button>
  );
}
