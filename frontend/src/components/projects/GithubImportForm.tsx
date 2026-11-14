import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectsApi } from "../../api/projects";
import { useFieldError } from "../../hooks/useFieldError";
import { useTranslation } from "../../hooks/useTranslation";
import { githubProjectSchema, repoNameFromUrl } from "../../schemas/project";
import { PasswordField } from "../ui/PasswordField";
import { TextField } from "../ui/TextField";
import { FormActions, ImportErrorAlert, ImportStatus } from "./FormFeedback";
import { useCreateProject, type SourceFormProps } from "./useCreateProject";

export function GithubImportForm({ onBusyChange, onFinished, onProjectChanged, onCancel }: SourceFormProps) {
  const { t } = useTranslation();
  const fieldError = useFieldError();
  const { step, error, run, busy } = useCreateProject(onProjectChanged);

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    resetField,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(githubProjectSchema),
    defaultValues: {
      repoUrl: "",
      name: "",
      description: "",
      branch: "",
      token: "",
    },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await run({ name: values.name, description: values.description || undefined }, (project) =>
      projectsApi.importGithub(project.id, {
        repoUrl: values.repoUrl,
        branch: values.branch || undefined,
        token: values.token || undefined,
      }),
    );
    resetField("token"); // don't keep the GitHub token in the form any longer than needed
    if (result)
      onFinished(
        t("create.successGithub", {
          count: result.filesSaved,
          branch: result.branch,
        }),
      );
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <TextField
          label={t("create.repoUrl")}
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder={t("create.repoUrlPlaceholder")}
          error={fieldError(errors.repoUrl?.message)}
          {...register("repoUrl", {
            // Fill the project name from the repo name if the user left it empty.
            onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
              if (getValues("name").trim()) return;
              const repoName = repoNameFromUrl(event.target.value);
              if (repoName) setValue("name", repoName, { shouldValidate: true });
            },
          })}
        />
        <TextField
          label={t("create.name")}
          autoComplete="off"
          placeholder={t("create.namePlaceholder")}
          error={fieldError(errors.name?.message)}
          {...register("name")}
        />
        <TextField
          label={t("create.description")}
          autoComplete="off"
          placeholder={t("create.descriptionPlaceholder")}
          error={fieldError(errors.description?.message)}
          {...register("description")}
        />
        <TextField
          label={t("create.branch")}
          autoComplete="off"
          placeholder={t("create.branchPlaceholder")}
          hint={t("create.branchHint")}
          error={fieldError(errors.branch?.message)}
          {...register("branch")}
        />
        <PasswordField
          label={t("create.token")}
          autoComplete="off"
          placeholder={t("create.tokenPlaceholder")}
          hint={t("create.tokenHint")}
          {...register("token")}
        />
      </fieldset>

      {error ? <ImportErrorAlert error={error} /> : null}
      {busy ? (
        <ImportStatus text={step === "creating" ? t("create.stepCreating") : t("create.stepImportingGithub")} />
      ) : null}

      <FormActions busy={busy} onCancel={onCancel} submitLabel={t("create.submitGithub")} />
    </form>
  );
}
