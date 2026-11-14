import { useSearchParams } from "react-router-dom";

/** Opens the "New project" dialog (it is driven by ?new= so it survives the GitHub round trip). */
export function useOpenCreateProject() {
  const [, setParams] = useSearchParams();
  return () => setParams((p) => ({ ...Object.fromEntries(p), new: "1" }));
}
