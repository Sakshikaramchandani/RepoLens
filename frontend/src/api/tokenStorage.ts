/**
 * Where the JWT lives in the browser.
 *
 * Week 1 uses localStorage because the plan sends the token in the
 * Authorization header. Trade-off: any injected script could read it, so the
 * backend must stay the real security boundary. If Apoorv later switches to
 * HttpOnly cookies, only this file and the Axios client need to change.
 */
const TOKEN_KEY = "repolens.token";

export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable (private mode) — session will not survive reload */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};
