import { apiClient } from "./client";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type IssueCategory = "BUG" | "SECURITY" | "PERFORMANCE" | "MAINTAINABILITY";

/** line 0 = the whole file. Same shape as ReviewDtos.java. */
export interface ReviewIssue {
  severity: Severity;
  category: IssueCategory;
  fileId: number;
  file: string;
  line: number;
  issue: string;
  suggestion: string;
}

export interface ReviewResponse {
  projectId: number;
  totalIssues: number;
  issues: ReviewIssue[];
  summary: string;
  files: Array<{ fileId: number; path: string; truncated: boolean }>;
  model: string;
}

export const REVIEW_MAX_FILES = 5;

/** A reasoning model reviewing 5 files can take a while; the server allows 5 minutes. */
const REVIEW_TIMEOUT_MS = 300_000;

export const reviewApi = {
  async review(projectId: number, fileIds: number[], focus?: string): Promise<ReviewResponse> {
    const { data } = await apiClient.post<ReviewResponse>(
      `/api/projects/${projectId}/review`,
      { fileIds, focus: focus?.trim() || undefined },
      { timeout: REVIEW_TIMEOUT_MS },
    );
    return data;
  },
};
