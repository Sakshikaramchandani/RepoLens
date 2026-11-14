/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  AUTH API CONTRACT — the ONE file to edit if the backend contract changes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  STATUS: VERIFIED against Apoorv's Spring Boot backend (Week 1):
 *    • AuthController  @RequestMapping("/api/auth")
 *    • POST /register → 201  { token, user: { id, email, role } }
 *    • POST /login    → 200  { token, user: { id, email, role } }
 *    • GET  /me       → 200  { id, email, role }   (needs Authorization: Bearer <jwt>)
 *    • Errors         → { "message": "...", "errors"?: { field: msg } }
 *                       400 validation · 401 bad login / no token · 409 email taken
 *    • RegisterRequest: email + password (8–72 characters, hashed with BCrypt)
 *
 *  If the backend changes, update this file AND src/mocks/handlers.ts.
 */

/** Backend address, from VITE_API_BASE_URL (.env.real / .env.local). */
export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");

/** Endpoint paths (AuthController). */
export const AUTH_ENDPOINTS = {
  register: "/api/auth/register",
  login: "/api/auth/login",
  me: "/api/auth/me",
  logout: "/api/auth/logout",
  providers: "/api/auth/providers",
  githubStart: "/api/auth/github/start",
  githubCallback: "/api/auth/github/callback",
  googleStart: "/api/auth/google/start",
  googleCallback: "/api/auth/google/callback",
} as const;

/** Endpoints that must NEVER receive the Authorization header. */
export const PUBLIC_ENDPOINTS: readonly string[] = [
  AUTH_ENDPOINTS.register,
  AUTH_ENDPOINTS.login,
  AUTH_ENDPOINTS.providers,
  AUTH_ENDPOINTS.githubStart,
  AUTH_ENDPOINTS.githubCallback,
  AUTH_ENDPOINTS.googleStart,
  AUTH_ENDPOINTS.googleCallback,
];

/** Field holding the JWT in AuthResponse. */
export const TOKEN_RESPONSE_FIELD = "token";

/** Header + scheme JwtAuthFilter reads: `Authorization: Bearer <jwt>`. */
export const AUTH_HEADER_NAME = "Authorization";
export const AUTH_SCHEME = "Bearer";

/** Same as RegisterRequest @Size(min = 8, max = 72). 72 = BCrypt input limit. */
export const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 72,
} as const;

/* ── Request / response shapes ─────────────────────────────────────────────── */

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** /me response (UserResponse). Backend roles today: "USER" | "ADMIN". */
export interface CurrentUser {
  id: number | string;
  email: string;
  role: string;
  /** Unique, editable on the Profile page (older mocks may not send it). */
  username?: string;
  /** External (GitHub / Google) URL, "/api/avatars/{token}" (uploaded, relative to the API) or null. */
  avatarUrl?: string | null;
}

/** Register and login both return the JWT plus the public user (AuthResponse). */
export interface AuthResponse {
  token: string;
  user: CurrentUser;
}

/** The UI only needs register to succeed; it then asks the user to sign in. */
export type RegisterResponse = AuthResponse;

/** The JWT is read from `response[TOKEN_RESPONSE_FIELD]` ("token"). */
export type LoginResponse = Record<string, unknown> | string;

/** Error body produced by the backend's GlobalExceptionHandler. */
export interface ApiErrorBody {
  message: string;
  errors?: Record<string, string>;
}
