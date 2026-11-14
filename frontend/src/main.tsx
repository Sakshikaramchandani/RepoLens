import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { USE_MOCKS } from "./config/env";
import "./styles/index.css";

/**
 * Start Mock Service Worker before rendering — but only in `npm run dev`
 * with VITE_USE_MOCKS=true. In production this whole block is removed.
 */
async function enableMocking(): Promise<void> {
  if (!USE_MOCKS) return;
  const { worker } = await import("./mocks/browser");
  await worker.start({
    onUnhandledRequest: "bypass",
    quiet: false,
  });
  console.info("%c[RepoLens] Mock API is ON — no real backend is used.", "color:#6C151E;font-weight:bold");
}

enableMocking()
  .catch((error: unknown) => {
    console.error("[RepoLens] Could not start the mock API. Run `npx msw init public` and restart.", error);
  })
  .finally(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
