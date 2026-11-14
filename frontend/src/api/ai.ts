import { apiClient } from "./client";

export interface ModelStatus {
  role: "primary" | "embedding";
  /** Server-side detail; the UI shows only the role and the model name. */
  provider: string;
  model: string;
  configured: boolean;
  reachable: boolean;
  detail: string;
}

export interface AiStatus {
  chat: ModelStatus[];
  embedding: ModelStatus;
}

export const aiApi = {
  async status(): Promise<AiStatus> {
    const { data } = await apiClient.get<AiStatus>("/api/ai/status");
    return data;
  },
};
