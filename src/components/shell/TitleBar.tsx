import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  colors,
  fontSizes,
  fonts,
  fontWeights,
  iconSizes,
  sizing,
  spacing,
} from "../../styles/theme";

const MENU_ITEMS = ["File", "Edit", "View", "Tools", "Help"] as const;

const appWindow = getCurrentWindow();

export function TitleBar({ onResetLayout }: { onResetLayout?: () => void }) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let cancel = false;
    appWindow
      .isMaximized()
      .then((m) => {
        if (!cancel) setIsMaximized(m);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  const handleMinimize = useCallback(() => {
    appWindow.minimize().catch(() => {});
  }, []);

  const handleToggleMaximize = useCallback(async () => {
    try {
      await appWindow.toggleMaximize();
      setIsMaximized(await appWindow.isMaximized());
    } catch {
      // Window operation failed — ignore silently
    }
  }, []);

  const handleClose = useCallback(() => {
    appWindow.close().catch(() => {});
  }, []);

  return (
    <div
      data-tauri-drag-region
      style={{
        height: sizing.titleBarHeight,
        minHeight: sizing.titleBarHeight,
        background: colors.titleBar,
        display: "flex",
        alignItems: "center",
        padding: `0 ${spacing.xl}px`,
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <span
        data-tauri-drag-region
        style={{
          fontFamily: fonts.ui,
          fontSize: fontSizes.lg,
          fontWeight: fontWeights.semibold,
          color: colors.textPrimary,
          marginRight: spacing["3xl"],
        }}
      >
        TexLab
      </span>

      <div
        data-tauri-drag-region
        style={{ display: "flex", gap: spacing["2xl"], flex: 1 }}
      >
        {MENU_ITEMS.map((item) => {
          const isView = item === "View" && onResetLayout;
          return isView ? (
            <button
              key={item}
              type="button"
              onClick={onResetLayout}
              style={{
                fontFamily: fonts.ui,
                fontSize: fontSizes.md,
                color: colors.textSecondary,
                cursor: "pointer",
                background: "none",
                border: "none",
                padding: 0,
              }}
            >
              {item}
            </button>
          ) : (
            <span
              key={item}
              data-tauri-drag-region
              style={{
                fontFamily: fonts.ui,
                fontSize: fontSizes.md,
                color: colors.textSecondary,
                cursor: "default",
              }}
            >
              {item}
            </span>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center" }}>
        <WindowButton onClick={handleMinimize}>
          <Minus size={iconSizes.md} />
        </WindowButton>
        <WindowButton onClick={handleToggleMaximize}>
          {isMaximized ? <Copy size={iconSizes.sm} /> : <Square size={iconSizes.sm} />}
        </WindowButton>
        <WindowButton onClick={handleClose} hoverColor={colors.closeHover}>
          <X size={iconSizes.md} />
        </WindowButton>
      </div>
    </div>
  );
}

function WindowButton({
  children,
  onClick,
  hoverColor,
}: {
  children: React.ReactNode;
  onClick: () => void;
  hoverColor?: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: sizing.windowButton.width,
        height: sizing.windowButton.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: hovered ? (hoverColor ?? colors.overlayHover) : colors.transparent,
        border: "none",
        color: colors.textTitle,
        cursor: "pointer",
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}
