import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { initEditorListener } from "./store/editorStore";
import { applyThemeToRoot, watchDockviewThemeRoots } from "./styles/applyThemeToRoot";

applyThemeToRoot();
watchDockviewThemeRoots();
initEditorListener();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
