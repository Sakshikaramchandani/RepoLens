import { z } from "zod";
import type { TranslationKey } from "../i18n/locales/en";

/** Keep in sync with ProjectDtos.java @Size limits and Apoorv's multipart limit. */
export const PROJECT_LIMITS = {
  nameMax: 100,
  descriptionMax: 500,
  zipMaxMb: 50,
} as const;

const GITHUB_REPO_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+?(\.git)?\/?$/;

const nameField = z.string().trim().min(1, "validation.nameRequired").max(PROJECT_LIMITS.nameMax, "validation.nameMax");

const descriptionField = z.string().trim().max(PROJECT_LIMITS.descriptionMax, "validation.descriptionMax");

export const githubProjectSchema = z.object({
  repoUrl: z.string().trim().regex(GITHUB_REPO_URL, "validation.repoUrlInvalid"),
  name: nameField,
  description: descriptionField,
  branch: z.string().trim().max(100, "validation.branchMax"),
  token: z.string().trim(),
});

export const zipProjectSchema = z.object({
  name: nameField,
  description: descriptionField,
});

/** The file is not a text field, so it is checked separately. Returns a translation key or null. */
export function validateZip(file: File | null): TranslationKey | null {
  if (!file) return "validation.zipRequired";
  if (!file.name.toLowerCase().endsWith(".zip")) return "validation.zipType";
  if (file.size > PROJECT_LIMITS.zipMaxMb * 1024 * 1024) return "validation.zipSize";
  return null;
}

/** "https://github.com/spring-projects/spring-petclinic.git" → "spring-petclinic" */
export function repoNameFromUrl(url: string): string | null {
  const match = url.trim().match(/github\.com\/[^/]+\/([^/?#]+?)(?:\.git)?\/?$/i);
  return match ? match[1] : null;
}
