import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { bootstrapJarvis } from "@/lib/bootstrap";

createRoot(document.getElementById("root")!).render(<App />);

// Fire-and-forget boot: hydrate IDB, register SW, pull remote skills, install marketplace.
bootstrapJarvis().catch((e) => console.warn("[bootstrap]", e));
