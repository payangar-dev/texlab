import type { DockviewApi, SerializedDockview } from "dockview-core";
import { loadWorkspaceLayout, saveWorkspaceLayout } from "../api/commands";

const WORKSPACE_VERSION = 1;

interface WorkspaceFile {
  version: number;
  dockview: SerializedDockview;
}

export async function saveLayout(api: DockviewApi): Promise<void> {
  const workspace: WorkspaceFile = {
    version: WORKSPACE_VERSION,
    dockview: api.toJSON(),
  };
  await saveWorkspaceLayout(JSON.stringify(workspace));
}

export async function loadLayout(): Promise<SerializedDockview | null> {
  const raw = await loadWorkspaceLayout();
  if (!raw) return null;

  try {
    const parsed: WorkspaceFile = JSON.parse(raw);
    if (parsed.version !== WORKSPACE_VERSION) {
      console.warn("[layoutStore] Incompatible workspace version:", parsed.version);
      return null;
    }
    if (!parsed.dockview) {
      console.warn("[layoutStore] Workspace file missing dockview data");
      return null;
    }
    return parsed.dockview;
  } catch (err) {
    console.warn("[layoutStore] Failed to parse workspace file:", err);
    return null;
  }
}

export async function resetLayout(): Promise<void> {
  // Write a valid JSON with version 0 so loadLayout rejects it cleanly
  // instead of relying on JSON.parse("") throwing
  await saveWorkspaceLayout(JSON.stringify({ version: 0 }));
}
