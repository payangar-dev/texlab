export const PANEL_IDS = {
  SOURCES: "sources",
  CANVAS: "canvas",
  LAYERS: "layers",
  COLOR: "color",
  PALETTE: "palette",
  MODEL_PREVIEW: "model-preview",
} as const;

export type PanelId = (typeof PANEL_IDS)[keyof typeof PANEL_IDS];

export const ALL_PANEL_IDS: readonly PanelId[] = Object.values(PANEL_IDS);
