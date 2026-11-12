import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
// Inter is bundled with the app (no Google Fonts request); one variable file
// covers every weight the styles use.
import "@fontsource-variable/inter/wght.css";
import "./style.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
