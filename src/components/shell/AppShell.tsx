import { useRef } from "react";
import StatusBar from "../status-bar/StatusBar";
import type { DockLayoutHandle } from "./DockLayout";
import { DockLayout } from "./DockLayout";
import { TitleBar } from "./TitleBar";
import { ToolsSidebar } from "./ToolsSidebar";

export function AppShell() {
  const dockRef = useRef<DockLayoutHandle>(null);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "#1E1E1E",
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
