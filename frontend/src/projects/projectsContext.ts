import { createContext, useContext } from "react";
import type { ApiError } from "../api/errors";
import type { Project } from "../api/projects";

export interface ProjectsContextValue {
  projects: Project[];
  status: "loading" | "ready" | "error";
  error: ApiError | null;
  reload: () => Promise<void>;
  removeProject: (id: number) => Promise<void>;
}

export const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function useProjects(): ProjectsContextValue {
  const value = useContext(ProjectsContext);
  if (!value) throw new Error("useProjects must be used inside <ProjectsProvider>");
  return value;
}
