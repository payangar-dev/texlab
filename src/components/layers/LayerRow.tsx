import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import type { LayerInfoDto } from "../../api/commands";
import { setLayerName, setLayerVisibility } from "../../api/commands";
import { useEditorStore } from "../../store/editorStore";
import { colors, fontSizes, fonts } from "../../styles/theme";

// --- Presentational component (used by both sortable row and DragOverlay) ---

interface LayerRowContentProps {
  layer: LayerInfoDto;
  textureWidth: number;
  textureHeight: number;
  isActive: boolean;
  isDragOverlay?: boolean;
}

export function LayerRowContent({
  layer,
  textureWidth,
  textureHeight,
  isActive,
  isDragOverlay,
}: LayerRowContentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const thumbnailData = useMemo(
    () => (layer.thumbnail.length > 0 ? new Uint8ClampedArray(layer.thumbnail) : null),
    [layer.thumbnail],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || textureWidth === 0 || textureHeight === 0 || !thumbnailData) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = new ImageData(thumbnailData, textureWidth, textureHeight);
    createImageBitmap(imageData)
      .then((bitmap) => {
        ctx.clearRect(0, 0, 18, 18);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bitmap, 0, 0, 18, 18);
        bitmap.close();
      })
      .catch((err) => console.warn("[LayerRow] thumbnail render failed:", err));
  }, [thumbnailData, textureWidth, textureHeight]);

  const opacityPercent = `${Math.round(layer.opacity * 100)}%`;
  const VisibilityIcon = layer.visible ? Eye : EyeOff;
  const iconColor = layer.visible ? colors.accent : colors.textSecondary;

  const style: CSSProperties = {
    ...rowStyle,
    backgroundColor: isActive ? colors.selectedItem : "transparent",
    opacity: layer.visible ? 1 : 0.4,
    ...(isDragOverlay && {
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      cursor: "grabbing",
    }),
  };

  return (
    <div style={style}>
      <div style={visibilityButtonStyle}>
        <VisibilityIcon size={12} color={iconColor} />
      </div>
      <canvas ref={canvasRef} width={18} height={18} style={thumbnailStyle} />
      <span style={nameStyle}>{layer.name}</span>
      <span style={opacityStyle}>{opacityPercent}</span>
    </div>
  );
}

// --- Sortable wrapper (used in the list) ---

interface LayerRowProps {
  layer: LayerInfoDto;
  textureWidth: number;
  textureHeight: number;
  isActive: boolean;
  onSelect: (id: string) => void;
}

export function LayerRow({
  layer,
  textureWidth,
  textureHeight,
  isActive,
  onSelect,
}: LayerRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const isSubmitting = useRef(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: layer.id });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const thumbnailData = useMemo(
    () => (layer.thumbnail.length > 0 ? new Uint8ClampedArray(layer.thumbnail) : null),
    [layer.thumbnail],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || textureWidth === 0 || textureHeight === 0 || !thumbnailData) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = new ImageData(thumbnailData, textureWidth, textureHeight);
    createImageBitmap(imageData)
      .then((bitmap) => {
        ctx.clearRect(0, 0, 18, 18);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bitmap, 0, 0, 18, 18);
        bitmap.close();
      })
      .catch((err) => console.warn("[LayerRow] thumbnail render failed:", err));
  }, [thumbnailData, textureWidth, textureHeight]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const opacityPercent = `${Math.round(layer.opacity * 100)}%`;

  const handleToggleVisibility = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const state = await setLayerVisibility(layer.id, !layer.visible);
      useEditorStore.setState(state);
    } catch (err) {
      console.error("[LayerRow] setLayerVisibility failed:", err);
    }
  };

  const startRename = () => {
    setRenameValue(layer.name);
    setIsRenaming(true);
  };

  const confirmRename = async () => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setIsRenaming(false);
    try {
      const trimmed = renameValue.trim();
      if (trimmed.length === 0 || trimmed === layer.name) return;
      const state = await setLayerName(layer.id, trimmed);
      useEditorStore.setState(state);
    } catch (err) {
      console.error("[LayerRow] setLayerName failed:", err);
    } finally {
      isSubmitting.current = false;
    }
  };

  const cancelRename = () => {
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      confirmRename();
    } else if (e.key === "Escape") {
      cancelRename();
    }
  };

  const handleRowKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "F2" && isActive && !isRenaming) {
      e.preventDefault();
      startRename();
    }
  };

  const VisibilityIcon = layer.visible ? Eye : EyeOff;
  const iconColor = layer.visible ? colors.accent : colors.textSecondary;

  const style: CSSProperties = {
    ...rowStyle,
    backgroundColor: isActive ? colors.selectedItem : "transparent",
    opacity: isDragging ? 0.4 : layer.visible ? 1 : 0.4,
    transform: CSS.Translate.toString(transform),
    transition: transition ?? undefined,
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dnd-kit manages keyboard interaction via listeners/attributes spread
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(layer.id)}
      onKeyDown={handleRowKeyDown}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        style={visibilityButtonStyle}
        onClick={handleToggleVisibility}
      >
        <VisibilityIcon size={12} color={iconColor} />
      </button>
      <canvas ref={canvasRef} width={18} height={18} style={thumbnailStyle} />
      {isRenaming ? (
        <input
          ref={inputRef}
          style={renameInputStyle}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={handleRenameKeyDown}
          onBlur={confirmRename}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        // biome-ignore lint/a11y/useSemanticElements: inline rename activator, not a true textbox
        <span
          role="textbox"
          tabIndex={-1}
          style={nameStyle}
          onDoubleClick={(e) => {
            e.stopPropagation();
            startRename();
          }}
        >
          {layer.name}
        </span>
      )}
      <span style={opacityStyle}>{opacityPercent}</span>
    </div>
  );
}

// --- Styles ---

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  height: 30,
  borderRadius: 4,
  padding: "0 6px",
  cursor: "pointer",
  flexShrink: 0,
};

const visibilityButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 20,
  flexShrink: 0,
  cursor: "pointer",
  borderRadius: 3,
  background: "transparent",
  border: "none",
  padding: 0,
};

const thumbnailStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 3,
  flexShrink: 0,
  imageRendering: "pixelated",
};

const nameStyle: CSSProperties = {
  color: colors.textPrimary,
  fontFamily: fonts.ui,
  fontSize: fontSizes.xs,
  fontWeight: "normal",
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  userSelect: "none",
};

const renameInputStyle: CSSProperties = {
  color: colors.textPrimary,
  fontFamily: fonts.ui,
  fontSize: fontSizes.xs,
  fontWeight: "normal",
  flex: 1,
  background: colors.inputField,
  border: `1px solid ${colors.accent}`,
  borderRadius: 2,
  padding: "1px 3px",
  outline: "none",
  minWidth: 0,
};

const opacityStyle: CSSProperties = {
  color: colors.textSecondary,
  fontFamily: fonts.mono,
  fontSize: 8,
  fontWeight: "normal",
  flexShrink: 0,
  userSelect: "none",
};
