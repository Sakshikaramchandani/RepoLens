import { useCallback } from "react";
import type { ApiError } from "../api/errors";
import type { TranslationKey } from "../i18n/locales/en";
import { useTranslation } from "./useTranslation";

type Context = "login" | "register" | "general";

function keyFor(error: ApiError, context: Context): TranslationKey {
  switch (error.kind) {
    case "unauthorized":
      return context === "login" ? "errors.invalidCredentials" : "errors.forbidden";
    case "conflict":
      return context === "register" ? "errors.emailTaken" : "errors.unknown";
    case "validation":
      return "errors.validation";
    case "network":
      return "errors.network";
    case "timeout":
      return "errors.timeout";
    case "forbidden":
      return "errors.forbidden";
    case "server":
      return "errors.server";
    default:
      return "errors.unknown";
  }
}

/** Translated headline + optional server detail ({"message": "..."}) for an ApiError. */
export function useApiErrorMessage() {
  const { t } = useTranslation();
  return useCallback(
    (error: ApiError, context: Context = "general") => ({
      title: t(keyFor(error, context)),
      detail: error.serverMessage ? t("errors.serverSaid", { message: error.serverMessage }) : undefined,
    }),
    [t],
  );
}
