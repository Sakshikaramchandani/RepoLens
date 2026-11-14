import { apiClient } from "./client";

export interface GithubConnection {
  /** false = the server has no OAuth app configured (GITHUB_CLIENT_ID / SECRET). */
  enabled: boolean;
  connected: boolean;
  login: string | null;
  avatarUrl: string | null;
  scopes: string | null;
}

export interface GithubRepo {
  fullName: string;
  name: string;
  owner: string;
  isPrivate: boolean;
  description: string | null;
  defaultBranch: string;
  htmlUrl: string;
  language: string | null;
  pushedAt: string | null;
  sizeKb: number;
  stars: number;
}

/** Where to come back to after GitHub (the OAuth app's callback URL must match). */
export const GITHUB_CALLBACK_PATH = "/integrations/github/callback";
/** Remembers where the user started connecting, so the callback can send them back. */
export const GITHUB_RETURN_KEY = "repolens.github.returnTo";
/** "login" (Continue with GitHub) or "connect" (already signed in) — the callback URL is shared. */
export const GITHUB_INTENT_KEY = "repolens.github.intent";

export const githubApi = {
  async connection(): Promise<GithubConnection> {
    const { data } = await apiClient.get<GithubConnection>("/api/github/connection");
    return data;
  },
  async startUrl(): Promise<string> {
    const { data } = await apiClient.post<{ url: string }>("/api/github/oauth/start");
    return data.url;
  },
  async complete(code: string, state: string): Promise<GithubConnection> {
    const { data } = await apiClient.post<GithubConnection>(
      "/api/github/oauth/callback",
      { code, state },
      { timeout: 30_000 },
    );
    return data;
  },
  async disconnect(): Promise<void> {
    await apiClient.delete("/api/github/connection");
  },
  async repos(query?: string): Promise<GithubRepo[]> {
    const { data } = await apiClient.get<GithubRepo[]>("/api/github/repos", {
      params: query?.trim() ? { q: query.trim() } : undefined,
      timeout: 30_000,
    });
    return data;
  },
};
