import {
  type DockviewApi,
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from "dockview";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { loadLayout, resetLayout, saveLayout } from "../../store/layoutStore";
import { CanvasViewportPanel } from "../panels/CanvasViewportPanel";
import { ColorPanel } from "../panels/ColorPanel";
import { ALL_PANEL_IDS, PANEL_IDS } from "../panels/constants";
import { LayersPanel } from "../panels/LayersPanel";
import { ModelPreviewPanel } from "../panels/ModelPreviewPanel";
import { PalettePanel } from "../panels/PalettePanel";
import { PanelHeader } from "../panels/PanelHeader";
import { SourcesPanel } from "../panels/SourcesPanel";

const components: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  [PANEL_IDS.SOURCES]: SourcesPanel,
  [PANEL_IDS.CANVAS]: CanvasViewportPanel,
  [PANEL_IDS.LAYERS]: LayersPanel,
  [PANEL_IDS.COLOR]: ColorPanel,
  [PANEL_IDS.PALETTE]: PalettePanel,
  [PANEL_IDS.MODEL_PREVIEW]: ModelPreviewPanel,
};

export interface DockLayoutHandle {
  resetToDefault: () => void;
}

/** Module-level callback for layout reset (used by layout commands). */
let layoutResetCallback: (() => void) | null = null;

export function setLayoutResetCallback(cb: (() => void) | null): void {
  layoutResetCallback = cb;
}

export function triggerLayoutReset(): void {
  layoutResetCallback?.();
}

export function buildDefaultLayout(api: DockviewApi) {
  const panelConstraints = { minimumWidth: 120, minimumHeight: 80 };

  // Canvas must be added first to establish the center group
  api.addPanel({
    id: PANEL_IDS.CANVAS,
    component: PANEL_IDS.CANVAS,
    title: "",
    minimumWidth: 200,
    minimumHeight: 200,
  });

  api.addPanel({
    id: PANEL_IDS.SOURCES,
    component: PANEL_IDS.SOURCES,
    title: "Sources",
    position: { direction: "left" },
    initialWidth: 240,
    ...panelConstraints,
  });

  api.addPanel({
    id: PANEL_IDS.LAYERS,
    component: PANEL_IDS.LAYERS,
    title: "Layers",
    position: { direction: "right" },
    initialWidth: 280,
    initialHeight: 180,
    ...panelConstraints,
  });

  api.addPanel({
    id: PANEL_IDS.COLOR,
    component: PANEL_IDS.COLOR,
    title: "Color",
    position: { referencePanel: PANEL_IDS.LAYERS, direction: "below" },
    initialHeight: 180,
    ...panelConstraints,
  });

  api.addPanel({
    id: PANEL_IDS.PALETTE,
    component: PANEL_IDS.PALETTE,
    title: "Palette",
    position: { referencePanel: PANEL_IDS.COLOR, direction: "below" },
    initialHeight: 130,
    ...panelConstraints,
  });

  api.addPanel({
    id: PANEL_IDS.MODEL_PREVIEW,
    component: PANEL_IDS.MODEL_PREVIEW,
    title: "Model Preview",
    position: { referencePanel: PANEL_IDS.PALETTE, direction: "below" },
    ...panelConstraints,
  });

  lockCanvasGroup(api);
}

function lockCanvasGroup(api: DockviewApi) {
  const canvasPanel = api.getPanel(PANEL_IDS.CANVAS);
  if (canvasPanel?.group) {
    canvasPanel.group.locked = "no-drop-target";
    canvasPanel.group.header.hidden = true;
  }
}

function hasAllPanels(api: DockviewApi): boolean {
  return ALL_PANEL_IDS.every((id) => api.getPanel(id) !== undefined);
}

export const DockLayout = forwardRef<DockLayoutHandle>(function DockLayout(_props, ref) {
  const apiRef = useRef<DockviewApi | null>(null);
  const layoutChangeDisposable = useRef<{ dispose: () => void } | null>(null);
  const overlayDisposable = useRef<{ dispose: () => void } | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const applyDefaultLayout = useCallback((api: DockviewApi) => {
    api.clear();
    buildDefaultLayout(api);
  }, []);

  const doReset = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    try {
      await resetLayout();
    } catch (err) {
      console.warn("[DockLayout] Failed to clear saved layout:", err);
    }
    applyDefaultLayout(api);
  }, [applyDefaultLayout]);

  useImperativeHandle(ref, () => ({ resetToDefault: doReset }), [doReset]);

  // Register layout reset callback for command system
  useEffect(() => {
    setLayoutResetCallback(doReset);
    return () => setLayoutResetCallback(null);
  }, [doReset]);

  const handleReady = useCallback(
    async (event: DockviewReadyEvent) => {
      const api = event.api;
      apiRef.current = api;

      let layoutRestored = false;

      try {
        const saved = await loadLayout();
        if (saved) {
          api.fromJSON(saved);
          if (hasAllPanels(api)) {
            lockCanvasGroup(api);
            layoutRestored = true;
          }
        }
      } catch (err) {
        console.warn("[DockLayout] Failed to restore layout, using default:", err);
      }

      if (!layoutRestored) {
        applyDefaultLayout(api);
      }

      // Auto-save on layout changes (debounced)
      layoutChangeDisposable.current = api.onDidLayoutChange(() => {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          saveLayout(api).catch((err) =>
            console.warn("[DockLayout] Failed to save layout:", err),
          );
        }, 400);
      });

      // Prevent drops onto the canvas group
      overlayDisposable.current = api.onWillShowOverlay((event) => {
        const canvasPanel = api.getPanel(PANEL_IDS.CANVAS);
        if (canvasPanel && event.options.group === canvasPanel.group) {
          event.preventDefault();
        }
      });
    },
    [applyDefaultLayout],
  );

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      layoutChangeDisposable.current?.dispose();
      overlayDisposable.current?.dispose();
      clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return (
    <DockviewReact
      className="dockview-theme-dark"
      components={components}
      defaultTabComponent={PanelHeader}
      onReady={handleReady}
      disableFloatingGroups={true}
      singleTabMode="fullwidth"
      hideBorders={true}
    />
  );
});
