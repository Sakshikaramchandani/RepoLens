import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { I18nContext, type I18nContextValue } from "./i18nContext";
import { DEFAULT_LANGUAGE, LANGUAGES, isLanguage, translate, type Language } from "./languages";

/** Must match the key read by the inline script in index.html. */
export const LANGUAGE_STORAGE_KEY = "repolens.language";

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANGUAGE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  useEffect(() => {
    const meta = LANGUAGES.find((l) => l.code === language);
    document.documentElement.lang = meta?.htmlLang ?? "en";
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, vars) => translate(language, key, vars),
    }),
    [language, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
