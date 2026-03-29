import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import type { EditorStateDto } from "../api/commands";
import { getEditorState } from "../api/commands";

interface EditorStore extends EditorStateDto {
  refreshState: () => Promise<void>;
}

export const useEditorStore = create<EditorStore>((set) => ({
  texture: null,
  layers: [],
  activeLayerId: null,
  canUndo: false,
  canRedo: false,

  refreshState: async () => {
    try {
      const state = await getEditorState();
      set(state);
    } catch (err) {
      console.error("[editorStore] failed to refresh state:", err);
    }
  },
}));

// Auto-refresh on "state-changed" events from the Rust backend.
// This handles MCP mutations and ensures the frontend stays in sync.
let listenerInitialized = false;

export function initEditorListener(): void {
  if (listenerInitialized) return;
  listenerInitialized = true;

  listen("state-changed", () => {
    useEditorStore.getState().refreshState().catch((err) => {
      console.error("[editorStore] state-changed handler failed:", err);
    });
  });
}
