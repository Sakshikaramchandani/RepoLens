import { apiClient } from "./client";

/** Same shape as IndexDtos.IndexJobResponse (Apoorv's Swagger contract). */
/** NOT_INDEXED = the backend has no job for this project yet (jobId is null). */
export type IndexStatus = "NOT_INDEXED" | "QUEUED" | "RUNNING" | "DONE" | "FAILED";

export interface IndexJob {
  jobId: number | null;
  projectId: number;
  status: IndexStatus;
  progress: number; // 0-100
  totalFiles: number;
  processedFiles: number;
  errorMessage: string | null;
}

export const INDEX_ENDPOINTS = {
  start: (projectId: number) => `/api/projects/${projectId}/index`,
  status: (projectId: number) => `/api/projects/${projectId}/index/status`,
} as const;

/** QUEUED / RUNNING → keep polling. DONE / FAILED → stop. */
export function isIndexing(status: IndexStatus | undefined): boolean {
  return status === "QUEUED" || status === "RUNNING";
}

export const indexingApi = {
  /** POST → 202 Accepted. The job runs in the background; poll status() to follow it. */
  async start(projectId: number): Promise<IndexJob> {
    const { data } = await apiClient.post<IndexJob>(INDEX_ENDPOINTS.start(projectId));
    return data;
  },

  /** Latest job of the project. 404 = the project has never been indexed. */
  async status(projectId: number): Promise<IndexJob> {
    const { data } = await apiClient.get<IndexJob>(INDEX_ENDPOINTS.status(projectId));
    return data;
  },
};
