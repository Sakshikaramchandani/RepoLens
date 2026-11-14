import { useCallback, useState } from "react";
import { toApiError, type ApiError } from "../../api/errors";
import { projectsApi, type CreateProjectRequest, type Project } from "../../api/projects";

export type CreateStep = "idle" | "creating" | "importing";

/** partial = the project was created, but the code import failed. */
export interface CreateError {
  apiError: ApiError;
  partial: boolean;
}

export interface SourceFormProps {
  onBusyChange: (busy: boolean) => void;
  onFinished: (message: string) => void;
  onProjectChanged: () => void;
  onCancel: () => void;
}

/**
 * Step 1: POST /api/projects          (creates an empty project)
 * Step 2: POST /api/projects/{id}/... (GitHub import or ZIP upload)
 */
export function useCreateProject(onProjectChanged: () => void) {
  const [step, setStep] = useState<CreateStep>("idle");
  const [error, setError] = useState<CreateError | null>(null);

  const run = useCallback(
    async <T>(details: CreateProjectRequest, importCode: (project: Project) => Promise<T>): Promise<T | null> => {
      setError(null);
      setStep("creating");

      let project: Project;
      try {
        project = await projectsApi.create(details);
      } catch (err) {
        setError({ apiError: toApiError(err), partial: false });
        setStep("idle");
        return null;
      }

      onProjectChanged(); // the new (still empty) card appears in the list
      setStep("importing");

      try {
        const result = await importCode(project);
        setStep("idle");
        return result;
      } catch (err) {
        setError({ apiError: toApiError(err), partial: true });
        setStep("idle");
        return null;
      }
    },
    [onProjectChanged],
  );

  return { step, error, run, busy: step !== "idle" };
}
