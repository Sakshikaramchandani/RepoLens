import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { projectsApi, type Project } from "../api/projects";
import { toApiError, type ApiError } from "../api/errors";
import { ProjectsContext, type ProjectsContextValue } from "./projectsContext";

type Status = ProjectsContextValue["status"];

/**
 * One project list for the whole signed-in app (sidebar, overview, projects page, explorer
 * header), fetched once and refreshed after create/delete — instead of every screen asking again.
 */
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<ApiError | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setStatus((current) => (current === "ready" ? current : "loading"));
    try {
      const list = await projectsApi.list();
      if (!mounted.current) return;
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setProjects(list);
      setError(null);
      setStatus("ready");
    } catch (err) {
      if (!mounted.current) return;
      setError(toApiError(err));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const removeProject = useCallback(async (id: number) => {
    await projectsApi.remove(id);
    if (mounted.current) setProjects((list) => list.filter((p) => p.id !== id));
  }, []);

  const value = useMemo(
    () => ({ projects, status, error, reload, removeProject }),
    [projects, status, error, reload, removeProject],
  );
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}
