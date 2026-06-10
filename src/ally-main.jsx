import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AllyIRCommandCenter from "../ally-ir-command-center/AllyIRCommandCenter.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AllyIRCommandCenter />
  </StrictMode>
);
