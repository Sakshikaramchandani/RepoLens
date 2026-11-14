import { en, type Dictionary, type TranslationKey } from "./locales/en";

/**
 * Only English ships for now. To add a language later: create locales/<code>.ts typed as
 * Dictionary (TypeScript then lists every missing key), add it to LANGUAGES and dictionaries,
 * and bring back a language picker on the Settings page.
 */
export type Language = "en";

export const LANGUAGES: ReadonlyArray<{ code: Language; nativeName: string; htmlLang: string }> = [
  { code: "en", nativeName: "English", htmlLang: "en" },
];

export const DEFAULT_LANGUAGE: Language = "en";

export const dictionaries: Record<Language, Dictionary> = { en };

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((l) => l.code === value);
}

export function isTranslationKey(value: unknown): value is TranslationKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(en, value);
}

export type TranslateVars = Record<string, string | number>;

/** Look up a key in a language, fall back to English, then fill {placeholders}. */
export function translate(language: Language, key: TranslationKey, vars?: TranslateVars): string {
  const template = dictionaries[language][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}
