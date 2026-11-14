import { createContext } from "react";
import type { TranslationKey } from "./locales/en";
import type { Language, TranslateVars } from "./languages";

export interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, vars?: TranslateVars) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);
