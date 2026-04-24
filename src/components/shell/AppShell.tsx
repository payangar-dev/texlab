import { useEffect, useRef } from "react";
import { useCommandDispatcher } from "../../commands/dispatcher";
import { initializeCommands } from "../../commands/index";
import { initPaletteListener, usePaletteStore } from "../../store/paletteStore";
import { colors } from "../../styles/theme";
import StatusBar from "../status-bar/StatusBar";
import type { DockLayoutHandle } from "./DockLayout";
import { DockLayout } from "./DockLayout";
import { TitleBar } from "./TitleBar";
import { ToolsSidebar } from "./ToolsSidebar";

initializeCommands();

export function AppShell() {
  const dockRef = useRef<DockLayoutHandle>(null);
  useCommandDispatcher();

  useEffect(() => {
    initPaletteListener();
    usePaletteStore
      .getState()
      .refreshState()
      .catch(() => {});
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: colors.shellBackground,
      }}
    >
      <TitleBar onResetLayout={() => dockRef.current?.resetToDefault()} />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <ToolsSidebar />
        <div style={{ flex: 1, overflow: "hidden" }}>
          <DockLayout ref={dockRef} />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
