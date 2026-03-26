import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// import App from './App.tsx'
import FullSetupPage from "./pages/full-setup/page";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FullSetupPage />
  </StrictMode>,
);
