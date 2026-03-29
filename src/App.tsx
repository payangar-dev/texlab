import CanvasViewport from "./components/canvas/CanvasViewport";
import StatusBar from "./components/status-bar/StatusBar";

export default function App() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "#1e1e1e",
      }}
    >
      <CanvasViewport />
      <StatusBar />
    </div>
  );
}
