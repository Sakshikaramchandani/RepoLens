import { z } from "zod";
import { PASSWORD_RULES } from "../api/contract";

/**
 * Validation messages are TRANSLATION KEYS, not text.
 * Pages translate them with t(message, { min, max }) so they follow the selected language.
 */

const email = z.string().trim().min(1, "validation.emailRequired").email("validation.emailInvalid");

export const loginSchema = z.object({
  email,
  // Login only checks "not empty": old accounts may predate any new length rule.
  password: z.string().min(1, "validation.passwordRequired"),
});

export const registerSchema = z
  .object({
    email,
    password: z
      .string()
      .min(1, "validation.passwordRequired")
      .min(PASSWORD_RULES.minLength, "validation.passwordMin")
      .max(PASSWORD_RULES.maxLength, "validation.passwordMax"),
    // UI-only check. NOT sent to the backend.
    confirmPassword: z.string().min(1, "validation.confirmRequired"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "validation.passwordsMismatch",
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
