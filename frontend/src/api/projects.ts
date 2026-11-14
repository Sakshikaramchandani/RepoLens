import { apiClient } from "./client";

/** Same shapes as ProjectDtos.java (Apoorv's Swagger contract). */
export type SourceType = "NONE" | "ZIP" | "GITHUB";

export interface Project {
  id: number;
  name: string;
  description: string | null;
  sourceType: SourceType;
  createdAt: string; // ISO date-time from the backend
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface UploadResponse {
  filesSaved: number;
  filesSkipped: number;
}

export interface GithubImportRequest {
  repoUrl: string;
  branch?: string;
  token?: string;
}

export interface GithubImportResponse {
  branch: string;
  latestCommitSha: string;
  latestCommitMessage: string;
  filesSaved: number;
}

export const PROJECT_ENDPOINTS = {
  list: "/api/projects",
  one: (id: number) => `/api/projects/${id}`,
  upload: (id: number) => `/api/projects/${id}/upload`,
  github: (id: number) => `/api/projects/${id}/github`,
} as const;

/** Cloning / unzipping can take a while, so imports get a longer timeout. */
const IMPORT_TIMEOUT_MS = 120_000;

export const projectsApi = {
  async list(): Promise<Project[]> {
    const { data } = await apiClient.get<Project[]>(PROJECT_ENDPOINTS.list);
    return data;
  },

  async get(id: number): Promise<Project> {
    const { data } = await apiClient.get<Project>(PROJECT_ENDPOINTS.one(id));
    return data;
  },

  async create(body: CreateProjectRequest): Promise<Project> {
    const { data } = await apiClient.post<Project>(PROJECT_ENDPOINTS.list, body);
    return data;
  },

  async remove(id: number): Promise<void> {
    await apiClient.delete(PROJECT_ENDPOINTS.one(id));
  },

  /** multipart/form-data with field "file". Axios sets the Content-Type + boundary itself. */
  async uploadZip(id: number, file: File, onProgress?: (percent: number) => void): Promise<UploadResponse> {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post<UploadResponse>(PROJECT_ENDPOINTS.upload(id), form, {
      timeout: IMPORT_TIMEOUT_MS,
      onUploadProgress: (event) => {
        if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
      },
    });
    return data;
  },

  async importGithub(id: number, body: GithubImportRequest): Promise<GithubImportResponse> {
    const { data } = await apiClient.post<GithubImportResponse>(PROJECT_ENDPOINTS.github(id), body, {
      timeout: IMPORT_TIMEOUT_MS,
    });
    return data;
  },
};
