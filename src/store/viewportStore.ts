import { create } from "zustand";
import { ZOOM_LEVELS } from "../components/canvas/constants";
import { clampPan, fitToViewportZoom, zoomToCursorPan } from "../components/canvas/math";

interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
  containerWidth: number;
  containerHeight: number;
}

interface ViewportActions {
  setZoom: (zoom: number, cursorX?: number, cursorY?: number) => void;
  setPan: (panX: number, panY: number, textureW?: number, textureH?: number) => void;
  zoomIn: (cursorX?: number, cursorY?: number) => void;
  zoomOut: (cursorX?: number, cursorY?: number) => void;
  fitToViewport: (textureWidth: number, textureHeight: number) => void;
  resetZoom: () => void;
  setContainerSize: (width: number, height: number) => void;
}

export type ViewportStore = ViewportState & ViewportActions;

function getNextZoomIndex(currentZoom: number, direction: 1 | -1): number {
  let currentIndex = ZOOM_LEVELS.indexOf(currentZoom);
  if (currentIndex === -1) {
    currentIndex = ZOOM_LEVELS.findIndex((z) => z >= currentZoom);
    if (currentIndex === -1) currentIndex = ZOOM_LEVELS.length - 1;
  }
  const nextIndex = currentIndex + direction;
  return Math.max(0, Math.min(ZOOM_LEVELS.length - 1, nextIndex));
}

function applyZoom(
  state: ViewportState,
  newZoom: number,
  cursorX?: number,
  cursorY?: number,
): Partial<ViewportState> {
  if (cursorX !== undefined && cursorY !== undefined) {
    const { panX, panY } = zoomToCursorPan(
      cursorX,
      cursorY,
      state.panX,
      state.panY,
      state.zoom,
      newZoom,
    );
    return { zoom: newZoom, panX, panY };
  }
  return { zoom: newZoom };
}

export const useViewportStore = create<ViewportStore>((set, get) => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  containerWidth: 0,
  containerHeight: 0,

  setZoom: (zoom, cursorX, cursorY) => {
    set(applyZoom(get(), zoom, cursorX, cursorY));
  },

  setPan: (panX, panY, textureW, textureH) => {
    if (textureW !== undefined && textureH !== undefined) {
      const state = get();
      const clamped = clampPan(
        panX,
        panY,
        state.zoom,
        textureW,
        textureH,
        state.containerWidth,
        state.containerHeight,
      );
      set({ panX: clamped.panX, panY: clamped.panY });
    } else {
      set({ panX, panY });
    }
  },

  zoomIn: (cursorX, cursorY) => {
    const state = get();
    const nextIndex = getNextZoomIndex(state.zoom, 1);
    const newZoom = ZOOM_LEVELS[nextIndex];
    if (newZoom === state.zoom) return;
    set(applyZoom(state, newZoom, cursorX, cursorY));
  },

  zoomOut: (cursorX, cursorY) => {
    const state = get();
    const nextIndex = getNextZoomIndex(state.zoom, -1);
    const newZoom = ZOOM_LEVELS[nextIndex];
    if (newZoom === state.zoom) return;
    set(applyZoom(state, newZoom, cursorX, cursorY));
  },

  fitToViewport: (textureWidth, textureHeight) => {
    const state = get();
    const zoom = fitToViewportZoom(
      textureWidth,
      textureHeight,
      state.containerWidth,
      state.containerHeight,
    );
    const panX = (state.containerWidth - textureWidth * zoom) / 2;
    const panY = (state.containerHeight - textureHeight * zoom) / 2;
    set({ zoom, panX, panY });
  },

  resetZoom: () => {
    const state = get();
    // Center pan at new zoom level based on current center point
    const centerX = state.containerWidth / 2;
    const centerY = state.containerHeight / 2;
    set(applyZoom(state, 1, centerX, centerY));
  },

  setContainerSize: (width, height) => {
    set({ containerWidth: width, containerHeight: height });
  },
}));
