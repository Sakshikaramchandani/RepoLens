import { http, HttpResponse } from "msw";
import type { AiStatus } from "../api/ai";
import { API_BASE_URL } from "../api/contract";
import type { GithubConnection } from "../api/github";

const url = (path: string) => `${API_BASE_URL}${path}`;

/**
 * Mock-mode answers for the settings/overview widgets. The status honestly says "mock":
 * nothing here pretends a model or a GitHub account is really connected.
 */
const AI_STATUS: AiStatus = {
  chat: [
    {
      role: "primary",
      provider: "ollama",
      model: "qwen2.5-coder:7b",
      configured: false,
      reachable: false,
      detail: "Mock mode — no backend",
    },
  ],
  embedding: {
    role: "embedding",
    provider: "ollama",
    model: "nomic-embed-text",
    configured: false,
    reachable: false,
    detail: "Mock mode — no backend",
  },
};

const GITHUB: GithubConnection = { enabled: false, connected: false, login: null, avatarUrl: null, scopes: null };

export const platformHandlers = [
  http.get(url("/api/ai/status"), () => HttpResponse.json(AI_STATUS)),
  http.get(url("/api/auth/providers"), () => HttpResponse.json({ github: false, google: false })),
  http.get(url("/api/github/connection"), () => HttpResponse.json(GITHUB)),
];
