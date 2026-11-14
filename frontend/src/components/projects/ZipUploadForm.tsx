import { useEffect, useId, useState, type ChangeEvent, type DragEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileArchive, Upload } from "lucide-react";
import { projectsApi } from "../../api/projects";
import { useFieldError } from "../../hooks/useFieldError";
import { useTranslation } from "../../hooks/useTranslation";
import type { TranslationKey } from "../../i18n/locales/en";
import { PROJECT_LIMITS, validateZip, zipProjectSchema } from "../../schemas/project";
import { cn } from "../ui/cn";
import { TextField } from "../ui/TextField";
import { FormActions, ImportErrorAlert, ImportStatus } from "./FormFeedback";
import { useCreateProject, type SourceFormProps } from "./useCreateProject";

export function ZipUploadForm({ onBusyChange, onFinished, onProjectChanged, onCancel }: SourceFormProps) {
  const { t } = useTranslation();
  const fieldError = useFieldError();
  const inputId = useId();
  const { step, error, run, busy } = useCreateProject(onProjectChanged);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<TranslationKey | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(zipProjectSchema),
    defaultValues: { name: "", description: "" },
    mode: "onTouched",
  });

  const pickFile = (picked: File | null) => {
    setFile(picked);
    setFileError(validateZip(picked));
    // "my-shop.zip" → project name "my-shop" if the name is still empty
    if (picked && !getValues("name").trim()) {
      setValue("name", picked.name.replace(/\.zip$/i, "").slice(0, PROJECT_LIMITS.nameMax), { shouldValidate: true });
    }
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => pickFile(event.target.files?.[0] ?? null);

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (!busy) pickFile(event.dataTransfer.files?.[0] ?? null);
  };

  const onSubmit = handleSubmit(
    async (values) => {
      const problem = validateZip(file);
      if (problem || !file) {
        setFileError(problem ?? "validation.zipRequired");
        return;
      }
      const selected = file;
      setProgress(0);
      const result = await run({ name: values.name, description: values.description || undefined }, (project) =>
        projectsApi.uploadZip(project.id, selected, setProgress),
      );
      if (result)
        onFinished(
          t("create.successZip", {
            saved: result.filesSaved,
            skipped: result.filesSkipped,
          }),
        );
    },
    () => setFileError(validateZip(file)), // also show the file error when text fields are invalid
  );

  const statusText =
    step === "creating"
      ? t("create.stepCreating")
      : progress < 100
        ? t("create.stepUploading", { percent: progress })
        : t("create.stepProcessing");

  const labelId = `${inputId}-label`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <span id={labelId} className="text-[0.8125rem] font-medium text-ink">
            {t("create.zipFile")}
          </span>
          <input
            id={inputId}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            className="peer sr-only"
            onChange={onInputChange}
            aria-labelledby={labelId}
            aria-describedby={fileError ? errorId : hintId}
            aria-invalid={fileError ? true : undefined}
          />
          <label
            htmlFor={inputId}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors duration-150 hover:border-faint hover:bg-surface-2/60",
              "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
              "peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
              fileError
                ? "border-danger bg-danger-soft/40"
                : file
                  ? "border-accent/50 bg-accent-soft/40"
                  : "border-line-strong",
            )}
          >
            {file ? (
              <FileArchive className="size-6 text-accent" aria-hidden="true" />
            ) : (
              <Upload className="size-6 text-faint" aria-hidden="true" />
            )}
            <span className="text-[0.8125rem] font-medium break-all text-ink">
              {file
                ? t("create.zipSelected", {
                    name: file.name,
                    size: (file.size / 1024 / 1024).toFixed(1),
                  })
                : t("create.zipDrop")}
            </span>
          </label>
          {fileError ? (
            <p id={errorId} className="text-[0.8125rem] text-danger">
              {t(fileError, { max: PROJECT_LIMITS.zipMaxMb })}
            </p>
          ) : (
            <p id={hintId} className="text-[0.8125rem] text-muted">
              {t("create.zipHint", { max: PROJECT_LIMITS.zipMaxMb })}
            </p>
          )}
        </div>

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
      </fieldset>

      {error ? <ImportErrorAlert error={error} /> : null}
      {busy ? <ImportStatus text={statusText} /> : null}

      <FormActions busy={busy} onCancel={onCancel} submitLabel={t("create.submitZip")} />
    </form>
  );
}
