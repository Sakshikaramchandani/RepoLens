import { apiClient } from "./client";

/** Same shapes as FileNode / FileContentResponse in ProjectDtos.java. */
export type FileNodeType = "FILE" | "DIR";

export interface FileNode {
  name: string;
  path: string;
  type: FileNodeType;
  /** null for folders */
  fileId: number | null;
  /** null for files */
  children: FileNode[] | null;
}

export interface FileContent {
  fileId: number;
  path: string;
  extension: string;
  content: string;
}

export const FILE_ENDPOINTS = {
  tree: (projectId: number) => `/api/projects/${projectId}/files`,
  content: (fileId: number) => `/api/files/${fileId}/content`,
} as const;

export const filesApi = {
  async tree(projectId: number): Promise<FileNode[]> {
    const { data } = await apiClient.get<FileNode[]>(FILE_ENDPOINTS.tree(projectId));
    return data;
  },

  async content(fileId: number): Promise<FileContent> {
    const { data } = await apiClient.get<FileContent>(FILE_ENDPOINTS.content(fileId));
    return data;
  },
};
