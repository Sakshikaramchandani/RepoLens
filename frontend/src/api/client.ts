import axios from "axios";
import { API_BASE_URL, AUTH_HEADER_NAME, AUTH_SCHEME, PUBLIC_ENDPOINTS } from "./contract";
import { toApiError } from "./errors";
import { tokenStorage } from "./tokenStorage";

/** Called when a protected request returns 401 (expired/invalid token). Set by AuthProvider. */
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

/** For requests that do not go through Axios (the chat stream uses fetch): same 401 handling. */
export function handleUnauthorized(): void {
  tokenStorage.clear();
  unauthorizedHandler?.();
}
function toPath(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url, API_BASE_URL).pathname;
  } catch {
    return url;
  }
}

export function isPublicEndpoint(url: string | undefined): boolean {
  const path = toPath(url);
  return PUBLIC_ENDPOINTS.some((endpoint) => path === endpoint);
}

export function buildAuthHeaderValue(token: string): string {
  return AUTH_SCHEME ? `${AUTH_SCHEME} ${token}` : token;
}

/** The single Axios instance every API call in RepoLens must use. */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { Accept: "application/json" },
});

// REQUEST: attach the JWT to every protected endpoint (never to login/register).
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token && !isPublicEndpoint(config.url)) {
    config.headers.set(AUTH_HEADER_NAME, buildAuthHeaderValue(token));
  }
  return config;
});

// RESPONSE: convert every failure into ApiError; handle expired sessions once, centrally.
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error);
    const url = axios.isAxiosError(error) ? error.config?.url : undefined;

    if (apiError.kind === "unauthorized" && !isPublicEndpoint(url)) {
      tokenStorage.clear();
      unauthorizedHandler?.();
    }
    return Promise.reject(apiError);
  },
);
