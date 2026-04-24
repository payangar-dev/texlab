import type { ReactNode } from "react";
import {
  colors,
  fontSizes,
  fonts,
  opacities,
  radii,
  sizing,
  spacing,
  zIndices,
} from "../../styles/theme";

export type DialogSize = "sm" | "md" | "lg";

interface DialogProps {
  /** Accessible name for the dialog (used as `aria-label`). */
  ariaLabel: string;
  /** ARIA role — defaults to `"dialog"`; use `"alertdialog"` for confirms. */
  role?: "dialog" | "alertdialog";
  /** Width variant — `sm` for confirm popovers, `md` default, `lg` for multi-action dialogs. */
  size?: DialogSize;
  /** Called when the user presses Escape on the backdrop or dialog card. */
  onEscape?: () => void;
  /** Rendered as a `<form>` when provided, so Enter submits and browsers handle validation. */
  onSubmit?: (e: React.FormEvent) => void;
  children: ReactNode;
}

const MIN_WIDTHS: Record<DialogSize, number> = {
  sm: sizing.dialog.minWidthSm,
  md: sizing.dialog.minWidth,
  lg: sizing.dialog.minWidthLg,
};

/**
 * Modal dialog shell — scrim backdrop, centred card, keyboard-escape wiring.
 * The single primitive behind `NewPaletteDialog`, `RenamePaletteDialog`,
 * `ImportScopeDialog`, `ImportConflictDialog`, and `ConfirmPopover`. Consumers
 * supply `DialogTitle`, any form controls, and `DialogActions` as children.
 */
export function Dialog({
  ariaLabel,
  role = "dialog",
  size = "md",
  onEscape,
  onSubmit,
  children,
}: DialogProps) {
  const cardStyle: React.CSSProperties = {
    background: colors.panelHeader,
    color: colors.textPrimary,
    padding: sizing.dialog.padding,
    borderRadius: radii.lg,
    minWidth: MIN_WIDTHS[size],
    fontFamily: fonts.ui,
    fontSize: fontSizes.sm,
    display: "flex",
    flexDirection: "column",
    gap: sizing.dialog.cardGap,
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && onEscape) {
      e.preventDefault();
      onEscape();
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: keyboard-only escape on a modal dialog is part of the dialog role contract, not a click-vs-keyboard issue
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is always "dialog" or "alertdialog" (prop-constrained), both of which accept aria-label — Biome can't trace the union
    <div
      style={backdropStyle}
      role={role}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      {onSubmit ? (
        <form style={cardStyle} onSubmit={onSubmit}>
          {children}
        </form>
      ) : (
        <div style={cardStyle}>{children}</div>
      )}
    </div>
  );
}

export function DialogTitle({ children }: { children: ReactNode }) {
  return <h2 style={titleStyle}>{children}</h2>;
}

export function DialogActions({ children }: { children: ReactNode }) {
  return <div style={actionsStyle}>{children}</div>;
}

type DialogButtonVariant = "default" | "primary" | "danger";

interface DialogButtonProps {
  variant?: DialogButtonVariant;
  type?: "button" | "submit";
  disabled?: boolean;
  autoFocus?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export function DialogButton({
  variant = "default",
  type = "button",
  disabled = false,
  autoFocus = false,
  onClick,
  children,
}: DialogButtonProps) {
  const variantStyle = VARIANT_STYLES[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      // biome-ignore lint/a11y/noAutofocus: focusing the default action inside a just-opened modal dialog is the expected a11y behaviour (WAI-ARIA Authoring Practices)
      autoFocus={autoFocus}
      onClick={onClick}
      style={{
        ...buttonStyle,
        ...variantStyle,
        opacity: disabled ? opacities.halfDimmed : opacities.full,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

interface DialogInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onEscape?: () => void;
  ariaLabel: string;
  inputRef?: React.Ref<HTMLInputElement>;
  autoSelect?: boolean;
}

export function DialogInput({
  id,
  value,
  onChange,
  onEscape,
  ariaLabel,
  inputRef,
  autoSelect,
}: DialogInputProps) {
  return (
    <input
      id={id}
      ref={inputRef}
      type="text"
      style={inputStyle}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={autoSelect ? (e) => e.currentTarget.select() : undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape" && onEscape) {
          e.preventDefault();
          onEscape();
        }
      }}
      aria-label={ariaLabel}
    />
  );
}

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: colors.backdropScrim,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: zIndices.dialog,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: fontSizes.md,
  color: colors.textTitle,
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: spacing.lg,
  marginTop: spacing.md,
};

const buttonStyle: React.CSSProperties = {
  padding: `${spacing.md}px ${sizing.dialog.actionPadX}px`,
  borderRadius: radii.md,
  border: "none",
  fontSize: fontSizes.sm,
};

const VARIANT_STYLES: Record<DialogButtonVariant, React.CSSProperties> = {
  default: {
    background: colors.inputField,
    color: colors.textPrimary,
  },
  primary: {
    background: colors.accent,
    color: colors.white,
  },
  danger: {
    background: colors.errorText,
    color: colors.white,
  },
};

const inputStyle: React.CSSProperties = {
  background: colors.inputField,
  border: `1px solid ${colors.separator}`,
  color: colors.textPrimary,
  padding: `${spacing.md}px ${spacing.lg}px`,
  borderRadius: radii.md,
  fontSize: fontSizes.sm,
};
