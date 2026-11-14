import { createContext, useContext } from "react";
import type { FileNode } from "../api/files";
import type { ApiError } from "../api/errors";
import type { Project } from "../api/projects";
import type { IndexingController } from "../components/indexing/IndexControl";

/** Everything the project tabs (Code, Chat, Review, Risk) share, loaded once by ProjectLayout. */
export interface ProjectContextValue {
  projectId: number;
  project: Project | null;
  tree: FileNode[] | null;
  treeStatus: "idle" | "loading" | "ready" | "error";
  treeError: ApiError | null;
  reloadTree: () => void;
  /** Every file (not folders), flattened. */
  files: FileNode[];
  /** "src/main/java/.../AuthService.java" → fileId, for citation links. */
  fileIdByPath: Map<string, number>;
  indexing: IndexingController;
  /** true once an index job finished successfully. */
  isIndexed: boolean;
}

export const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProject(): ProjectContextValue {
  const value = useContext(ProjectContext);
  if (!value) throw new Error("useProject must be used inside <ProjectLayout>");
  return value;
}
