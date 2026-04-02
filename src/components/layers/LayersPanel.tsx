import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BlendMode, LayerInfoDto } from "../../api/commands";
import {
  addLayer,
  duplicateLayer,
  moveLayer,
  removeLayer,
  setLayerBlendMode,
} from "../../api/commands";
import { useEditorStore } from "../../store/editorStore";
import { colors, fontSizes, fonts } from "../../styles/theme";
import { BlendModeSelect } from "./BlendModeSelect";
import { LayerRow, LayerRowContent } from "./LayerRow";

/** Monotonic counter for unique default layer names across additions/deletions. */
let layerNameCounter = 0;

export function LayersPanel() {
  const layers = useEditorStore((s) => s.layers);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const texture = useEditorStore((s) => s.texture);
  const [draggedLayer, setDraggedLayer] = useState<LayerInfoDto | null>(null);
  const isPending = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" && !e.repeat) {
        // Don't trigger if user is typing in an input (e.g. rename)
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        handleRemoveLayer();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Intentional frontend-only state: active layer selection is latency-sensitive
  // and does not require a backend round-trip. The backend's active_layer_id is
  // synchronized on every mutation command response and state-changed event.
  const setActiveLayer = (id: string) => {
    useEditorStore.setState({ activeLayerId: id });
  };

  const textureWidth = texture?.width ?? 0;
  const textureHeight = texture?.height ?? 0;
  const hasTexture = texture !== null;

  // Reverse layers for display (topmost first)
  const displayLayers = [...layers].reverse();
  const sortableIds = displayLayers.map((l) => l.id);

  const handleAddLayer = async () => {
    if (!hasTexture || isPending.current) return;
    isPending.current = true;
    try {
      layerNameCounter++;
      const state = await addLayer(`Layer ${layerNameCounter}`);
      useEditorStore.setState(state);
    } catch (err) {
      console.error("[LayersPanel] addLayer failed:", err);
    } finally {
      isPending.current = false;
    }
  };

  const handleRemoveLayer = async () => {
    if (!activeLayerId || layers.length <= 1 || isPending.current) return;
    isPending.current = true;
    try {
      const state = await removeLayer(activeLayerId);
      useEditorStore.setState(state);
    } catch (err) {
      console.error("[LayersPanel] removeLayer failed:", err);
    } finally {
      isPending.current = false;
    }
  };

  const handleDuplicateLayer = async () => {
    if (!activeLayerId || isPending.current) return;
    isPending.current = true;
    try {
      const state = await duplicateLayer(activeLayerId);
      useEditorStore.setState(state);
    } catch (err) {
      console.error("[LayersPanel] duplicateLayer failed:", err);
    } finally {
      isPending.current = false;
    }
  };

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const layer = displayLayers.find((l) => l.id === event.active.id);
      setDraggedLayer(layer ?? null);
    },
    [displayLayers],
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggedLayer(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const visualFromIndex = displayLayers.findIndex((l) => l.id === active.id);
    const visualToIndex = displayLayers.findIndex((l) => l.id === over.id);
    if (visualFromIndex === -1 || visualToIndex === -1) return;

    // Optimistic update: reorder locally before the backend responds
    const reordered = arrayMove(displayLayers, visualFromIndex, visualToIndex);
    useEditorStore.setState({ layers: [...reordered].reverse() });

    // Convert visual indices (0=top) to backend indices (0=bottom)
    const len = layers.length;
    const backendFrom = len - 1 - visualFromIndex;
    const backendTo = len - 1 - visualToIndex;

    try {
      const state = await moveLayer(backendFrom, backendTo);
      useEditorStore.setState(state);
    } catch (err) {
      console.error("[LayersPanel] moveLayer failed:", err);
      useEditorStore.getState().refreshState();
    }
  };

  const handleDragCancel = useCallback(() => {
    setDraggedLayer(null);
  }, []);

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  const handleBlendModeChange = async (mode: BlendMode) => {
    if (!activeLayerId || isPending.current) return;
    isPending.current = true;
    try {
      const state = await setLayerBlendMode(activeLayerId, mode);
      useEditorStore.setState(state);
    } catch (err) {
      console.error("[LayersPanel] setLayerBlendMode failed:", err);
    } finally {
      isPending.current = false;
    }
  };

  return (
    <div style={containerStyle}>
      {/* Layer list */}
      <div style={listStyle}>
        {!hasTexture ? (
          <span style={emptyStyle}>No texture open</span>
        ) : (
          <DndContext
            sensors={sensors}
            modifiers={[restrictToVerticalAxis]}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {displayLayers.map((layer) => (
                <LayerRow
                  key={layer.id}
                  layer={layer}
                  textureWidth={textureWidth}
                  textureHeight={textureHeight}
                  isActive={layer.id === activeLayerId}
                  onSelect={setActiveLayer}
                />
              ))}
            </SortableContext>
            {createPortal(
              <DragOverlay dropAnimation={null}>
                {draggedLayer ? (
                  <LayerRowContent
                    layer={draggedLayer}
                    textureWidth={textureWidth}
                    textureHeight={textureHeight}
                    isActive
                    isDragOverlay
                  />
                ) : null}
              </DragOverlay>,
              document.body,
            )}
          </DndContext>
        )}
      </div>

      {/* Blend mode */}
      {hasTexture && activeLayer && (
        <BlendModeSelect value={activeLayer.blendMode} onChange={handleBlendModeChange} />
      )}

      {/* Action bar */}
      {hasTexture && (
        <div style={actionBarStyle}>
          <button
            type="button"
            style={actionButtonStyle}
            onClick={handleAddLayer}
            title="Add layer"
          >
            <Plus size={12} color={colors.textSecondary} />
          </button>
          <button
            type="button"
            style={{
              ...actionButtonStyle,
              opacity: layers.length <= 1 ? 0.4 : 1,
              cursor: layers.length <= 1 ? "not-allowed" : "pointer",
            }}
            onClick={handleRemoveLayer}
            disabled={layers.length <= 1}
            title={layers.length <= 1 ? "Cannot delete the last layer" : "Delete layer"}
          >
            <Trash2 size={12} color={colors.textSecondary} />
          </button>
          <button
            type="button"
            style={actionButtonStyle}
            onClick={handleDuplicateLayer}
            title="Duplicate layer"
          >
            <Copy size={12} color={colors.textSecondary} />
          </button>
        </div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: colors.panelBody,
  overflow: "hidden",
};

const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: 4,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const emptyStyle: React.CSSProperties = {
  color: colors.textMuted,
  fontFamily: fonts.ui,
  fontSize: fontSizes.sm,
  textAlign: "center",
  marginTop: 16,
  userSelect: "none",
};

const actionBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  height: 28,
  padding: "0 6px",
  flexShrink: 0,
};

const actionButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 22,
  borderRadius: 4,
  background: colors.inputField,
  border: "none",
  cursor: "pointer",
  padding: 0,
};
