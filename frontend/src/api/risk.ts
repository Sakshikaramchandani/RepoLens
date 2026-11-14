import { apiClient } from "./client";

export type RiskLabel = "HIGH" | "MEDIUM" | "LOW";

export interface FileRisk {
  fileId: number;
  filePath: string;
  /** "Java", "Python", "TypeScript"… */
  language: string;
  score: number;
  label: RiskLabel;
  complexity: number;
  maxMethodComplexity: number;
  loc: number;
  methods: number;
  /** From git history (null = the project has no history). */
  churn: number | null;
  bugFixCommits: number | null;
  authors: number | null;
  lastChanged: string | null;
  warnings: number;
  findings: string[];
}

export interface RiskReport {
  projectId: number;
  filesAnalyzed: number;
  high: number;
  medium: number;
  low: number;
  historyAvailable: boolean;
  /** How many recent commits the history covers (0 = none). */
  historyCommits: number;
  languages: string[];
  files: FileRisk[];
}

export const riskApi = {
  async report(projectId: number): Promise<RiskReport> {
    const { data } = await apiClient.get<RiskReport>(`/api/projects/${projectId}/risk`, { timeout: 60_000 });
    return data;
  },
};
