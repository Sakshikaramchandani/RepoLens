import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** Vendor groups that change rarely: separate chunks load in parallel and stay cached across deploys. */
const VENDOR_CHUNKS: Record<string, string[]> = {
  react: ["react", "react-dom", "react-router", "react-router-dom", "scheduler"],
  motion: ["gsap", "@gsap/react"],
  forms: ["react-hook-form", "@hookform/resolvers", "zod"],
  ui: ["sonner", "lucide-react", "axios"],
};

function vendorChunk(id: string): string | undefined {
  const match = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(id);
  if (!match) return undefined;
  return Object.keys(VENDOR_CHUNKS).find((chunk) => VENDOR_CHUNKS[chunk].includes(match[1]));
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: { manualChunks: vendorChunk },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    restoreMocks: true,
  },
});
