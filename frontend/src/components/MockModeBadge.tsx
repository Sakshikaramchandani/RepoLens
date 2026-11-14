import { FlaskConical } from "lucide-react";
import { USE_MOCKS } from "../config/env";
import { useTranslation } from "../hooks/useTranslation";

/** Visible reminder that the app is NOT talking to the real backend. */
export function MockModeBadge() {
  const { t } = useTranslation();
  if (!USE_MOCKS) return null;
  return (
    <span
      title={t("common.mockModeHint")}
      className="inline-flex h-6 items-center gap-1.5 rounded-sm border border-dashed border-accent/50 px-2 text-[0.6875rem] font-medium text-accent-strong dark:text-accent"
    >
      <FlaskConical className="size-3.5" aria-hidden="true" />
      {t("common.mockMode")}
    </span>
  );
}
