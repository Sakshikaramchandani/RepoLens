import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { PASSWORD_RULES } from "../api/contract";
import { toApiError, type ApiError } from "../api/errors";
import { SocialSignIn } from "../components/auth/SocialSignIn";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { PasswordField } from "../components/ui/PasswordField";
import { TextField } from "../components/ui/TextField";
import { useApiErrorMessage } from "../hooks/useApiErrorMessage";
import { useAuth } from "../hooks/useAuth";
import { useFieldError } from "../hooks/useFieldError";
import { useTranslation } from "../hooks/useTranslation";
import { registerSchema } from "../schemas/auth";

export function RegisterPage() {
  const { t } = useTranslation();
  const { register: registerAccount } = useAuth();
  const navigate = useNavigate();
  const fieldError = useFieldError();
  const apiErrorMessage = useApiErrorMessage();
  const [submitError, setSubmitError] = useState<ApiError | null>(null);

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      // Only the contract fields are sent — confirmPassword stays in the browser.
      await registerAccount({ email: values.email, password: values.password });
      navigate("/login", { replace: true, state: { registered: true, email: values.email } });
    } catch (error) {
      const apiError = toApiError(error);
      setSubmitError(apiError);
      setFocus(apiError.kind === "conflict" ? "email" : "password");
    }
  });

  const errorText = submitError ? apiErrorMessage(submitError, "register") : null;

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t("register.title")}</h1>
      <p className="mt-1.5 text-muted">{t("register.subtitle")}</p>

      {errorText ? (
        <Alert tone="error" title={errorText.title} className="mt-6">
          {errorText.detail}
        </Alert>
      ) : null}

      <SocialSignIn />

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4" aria-label={t("register.title")}>
        <TextField
          label={t("fields.email")}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t("fields.emailPlaceholder")}
          error={fieldError(errors.email?.message)}
          {...register("email")}
        />
        <PasswordField
          label={t("fields.password")}
          autoComplete="new-password"
          placeholder={t("fields.passwordPlaceholder")}
          hint={t("password.hint", { min: PASSWORD_RULES.minLength })}
          error={fieldError(errors.password?.message)}
          {...register("password")}
        />
        <PasswordField
          label={t("fields.confirmPassword")}
          autoComplete="new-password"
          placeholder={t("fields.confirmPasswordPlaceholder")}
          error={fieldError(errors.confirmPassword?.message)}
          {...register("confirmPassword")}
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={isSubmitting}
          leftIcon={<UserPlus className="size-4" aria-hidden="true" />}
        >
          {isSubmitting ? t("register.submitting") : t("register.submit")}
        </Button>
      </form>

      <p className="mt-8 text-center text-[0.8125rem] text-muted">
        {t("register.haveAccount")}{" "}
        <Link
          to="/login"
          className="font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink"
        >
          {t("register.signIn")}
        </Link>
      </p>
    </div>
  );
}
