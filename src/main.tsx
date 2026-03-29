import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initEditorListener } from "./store/editorStore";

initEditorListener();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
