import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toApiError, type ApiError } from "../api/errors";
import { indexingApi, isIndexing, type IndexJob } from "../api/indexing";

/** How often the progress bar asks the backend for news while a job runs. */
export const POLL_INTERVAL_MS = 2500;

export type IndexingState =
  | { phase: "loading" } //          first status request still on its way
  | { phase: "never" } //            project was never indexed (status API said 404)
  | { phase: "job"; job: IndexJob } // a job exists: QUEUED / RUNNING / DONE / FAILED
  | { phase: "error"; error: ApiError }; // status could not be loaded at all

/**
 * Indexing status of one project, plus start().
 *
 * Polling: while the job is QUEUED or RUNNING, GET /index/status is called every 2.5 s.
 * It stops by itself on DONE / FAILED, when the page is left, or when the project changes.
 * (Same idea as React Query's refetchInterval, written by hand so we need no new library.)
 */
export function useIndexing(projectId: number | null) {
  const [state, setState] = useState<IndexingState>({ phase: "loading" });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<ApiError | null>(null);
  const [pollKey, setPollKey] = useState(0); // bump → (re)start the polling loop

  // The newest projectId, so an old answer for another project is ignored.
  const currentProject = useRef(projectId);
  useEffect(() => {
    currentProject.current = projectId;
  }, [projectId]);

  useEffect(() => {
    if (projectId === null) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const job = await indexingApi.status(projectId);
        if (stopped || currentProject.current !== projectId) return;
        // The real API answers 200 {status: "NOT_INDEXED"}; older mocks answer 404 — both mean "never"
        if (job.status === "NOT_INDEXED" || job.jobId === null) {
          setState({ phase: "never" });
          return;
        }
        setState({ phase: "job", job });
        if (isIndexing(job.status)) timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (stopped) return;
        const error = toApiError(err);
        setState(error.status === 404 ? { phase: "never" } : { phase: "error", error });
      }
    };

    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [projectId, pollKey]);

  const start = useCallback(async () => {
    if (projectId === null) return;
    setStarting(true);
    setStartError(null);
    try {
      const job = await indexingApi.start(projectId);
      setState({ phase: "job", job });
      setPollKey((key) => key + 1); // follow the new job
    } catch (err) {
      setStartError(toApiError(err));
    } finally {
      setStarting(false);
    }
  }, [projectId]);

  const retryStatus = useCallback(() => {
    setState({ phase: "loading" });
    setPollKey((key) => key + 1);
  }, []);

  return useMemo(
    () => ({ state, start, starting, startError, retryStatus }),
    [state, start, starting, startError, retryStatus],
  );
}
