import { apiClient } from "./client";
import {
  API_BASE_URL,
  AUTH_ENDPOINTS,
  AUTH_HEADER_NAME,
  AUTH_SCHEME,
  TOKEN_RESPONSE_FIELD,
  type CurrentUser,
  type LoginRequest,
  type LoginResponse,
  type RegisterRequest,
  type RegisterResponse,
} from "./contract";
import { ApiError } from "./errors";

export interface AuthProviders {
  github: boolean;
  google: boolean;
}

/** Frontend page the backend forwards Google's redirect to (see GoogleCallbackForwarder). */
export const GOOGLE_CALLBACK_PATH = "/auth/google/callback";

function extractToken(data: LoginResponse): string | null {
  if (typeof data === "string") return data.trim() || null;
  const value = data?.[TOKEN_RESPONSE_FIELD];
  return typeof value === "string" && value ? value : null;
}

export const authApi = {
  async register(body: RegisterRequest): Promise<RegisterResponse> {
    const { data } = await apiClient.post<RegisterResponse>(AUTH_ENDPOINTS.register, body);
    return data;
  },

  /** Returns the JWT. Throws if the response does not contain one. */
  async login(body: LoginRequest): Promise<string> {
    const { data } = await apiClient.post<LoginResponse>(AUTH_ENDPOINTS.login, body);
    const token = extractToken(data);
    if (!token) {
      throw new ApiError(
        "unknown",
        undefined,
        `Login response has no "${TOKEN_RESPONSE_FIELD}" field. Update TOKEN_RESPONSE_FIELD in src/api/contract.ts.`,
      );
    }
    return token;
  },

  /** Which sign-in methods the server offers (each needs an OAuth app configured). */
  async providers(): Promise<AuthProviders> {
    const { data } = await apiClient.get<Partial<AuthProviders>>(AUTH_ENDPOINTS.providers);
    return { github: data?.github === true, google: data?.google === true };
  },

  /** "Continue with Google": the authorize URL to send the browser to. */
  async googleStart(): Promise<string> {
    const { data } = await apiClient.post<{ url: string }>(AUTH_ENDPOINTS.googleStart);
    return data.url;
  },

  /** Back from Google (via the backend redirect URI): code + state → JWT. */
  async googleCallback(code: string, state: string): Promise<string> {
    const { data } = await apiClient.post<LoginResponse>(
      AUTH_ENDPOINTS.googleCallback,
      { code, state },
      { timeout: 30_000 },
    );
    const token = extractToken(data);
    if (!token) throw new ApiError("unknown", undefined, "Google sign-in response has no token.");
    return token;
  },

  /** "Continue with GitHub": the authorize URL to send the browser to. */
  async githubStart(): Promise<string> {
    const { data } = await apiClient.post<{ url: string }>(AUTH_ENDPOINTS.githubStart);
    return data.url;
  },

  /** Back from GitHub: code + state → JWT (the GitHub account is connected in the same step). */
  async githubCallback(code: string, state: string): Promise<string> {
    const { data } = await apiClient.post<LoginResponse>(
      AUTH_ENDPOINTS.githubCallback,
      { code, state },
      { timeout: 30_000 },
    );
    const token = extractToken(data);
    if (!token) throw new ApiError("unknown", undefined, "GitHub sign-in response has no token.");
    return token;
  },

  /**
   * Revokes every token issued to this user so far (server side). Sent with an explicit token because
   * the caller has usually cleared local storage already; failures are ignored — signing out locally
   * must never depend on the network.
   */
  async logout(token: string): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}${AUTH_ENDPOINTS.logout}`, {
        method: "POST",
        headers: { [AUTH_HEADER_NAME]: `${AUTH_SCHEME} ${token}` },
        keepalive: true,
      });
    } catch {
      /* offline / server down: the token still expires on its own */
    }
  },

  async me(): Promise<CurrentUser> {
    const { data } = await apiClient.get<CurrentUser>(AUTH_ENDPOINTS.me);
    return data;
  },
};
