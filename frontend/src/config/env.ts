/**
 * Mock mode is ONLY possible in development (`npm run dev`).
 * A production build (`npm run build`) always talks to the real backend,
 * even if VITE_USE_MOCKS=true is set by mistake.
 */
export const USE_MOCKS: boolean = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === "true";

/** Demo account that exists in mock mode only (see src/mocks/db.ts). */
export const MOCK_DEMO_USER = {
  email: "demo@repolens.dev",
  password: "Password@123",
} as const;
