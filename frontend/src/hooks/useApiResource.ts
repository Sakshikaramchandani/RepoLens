import { useCallback, useEffect, useState, type DependencyList } from "react";
import { toApiError, type ApiError } from "../api/errors";

type Status = "idle" | "loading" | "ready" | "error";

interface ResourceState<T> {
  status: Status;
  data: T | null;
  error: ApiError | null;
}

/**
 * Loads data from the API and tracks loading / error state.
 * Pass `null` as the loader to load nothing (status stays "idle").
 * The request is re-run whenever a value in `deps` changes, or when reload() is called.
 */
export function useApiResource<T>(load: (() => Promise<T>) | null, deps: DependencyList) {
  const [state, setState] = useState<ResourceState<T>>({
    status: load ? "loading" : "idle",
    data: null,
    error: null,
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!load) {
      setState({ status: "idle", data: null, error: null });
      return;
    }
    let cancelled = false; // ignore answers that arrive after the user moved on
    setState({ status: "loading", data: null, error: null });
    load()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: "error", data: null, error: toApiError(err) });
      });
    return () => {
      cancelled = true;
    };
    // `load` is a new function on every render, so only `deps` decide when to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return { ...state, reload };
}
