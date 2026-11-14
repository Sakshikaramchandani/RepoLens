import { useApiErrorMessage } from "../../hooks/useApiErrorMessage";
import { useTranslation } from "../../hooks/useTranslation";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import type { CreateError } from "./useCreateProject";

export function ImportStatus({ text }: { text: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2.5 text-[0.8125rem] text-ink-2"
    >
      <Spinner /> {text}
    </p>
  );
}

export function ImportErrorAlert({ error }: { error: CreateError }) {
  const { t } = useTranslation();
  const apiErrorMessage = useApiErrorMessage();
  const message = apiErrorMessage(error.apiError);

  if (error.partial) {
    return (
      <Alert tone="error" title={t("create.partialTitle")}>
        {message.title} {message.detail}
        <span className="mt-1 block">{t("create.partialBody")}</span>
      </Alert>
    );
  }
  return (
    <Alert tone="error" title={message.title}>
      {message.detail}
    </Alert>
  );
}

export function FormActions({
  busy,
  onCancel,
  submitLabel,
}: {
  busy: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap justify-end gap-2 pt-1">
      <Button variant="secondary" onClick={onCancel} disabled={busy}>
        {t("create.cancel")}
      </Button>
      <Button type="submit" loading={busy}>
        {submitLabel}
      </Button>
    </div>
  );
}
