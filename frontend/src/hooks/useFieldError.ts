import { useCallback } from "react";
import { PASSWORD_RULES } from "../api/contract";
import { isTranslationKey } from "../i18n/languages";
import { useTranslation } from "./useTranslation";

/** Turns a Zod message (a translation key) into text in the current language. */
export function useFieldError() {
  const { t } = useTranslation();
  return useCallback(
    (message: string | undefined): string | undefined => {
      if (!message) return undefined;
      if (isTranslationKey(message)) {
        return t(message, { min: PASSWORD_RULES.minLength, max: PASSWORD_RULES.maxLength });
      }
      return message;
    },
    [t],
  );
}
