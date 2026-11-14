import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation } from "react-router-dom";
import { LogIn } from "lucide-react";
import { toApiError, type ApiError } from "../api/errors";
import { SocialSignIn } from "../components/auth/SocialSignIn";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { PasswordField } from "../components/ui/PasswordField";
import { TextField } from "../components/ui/TextField";
import { MOCK_DEMO_USER, USE_MOCKS } from "../config/env";
import { useApiErrorMessage } from "../hooks/useApiErrorMessage";
import { useAuth } from "../hooks/useAuth";
import { useFieldError } from "../hooks/useFieldError";
import { useTranslation } from "../hooks/useTranslation";
import { loginSchema } from "../schemas/auth";

interface LoginLocationState {
  registered?: boolean;
  email?: string;
}

export function LoginPage() {
  const { t } = useTranslation();
  const { login, sessionExpired } = useAuth();
  const location = useLocation();
  const state = (location.state ?? null) as LoginLocationState | null;
  const fieldError = useFieldError();
  const apiErrorMessage = useApiErrorMessage();
  const [submitError, setSubmitError] = useState<ApiError | null>(null);

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: state?.email ?? "", password: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      // Success is decided by the API (or MSW) — PublicOnlyRoute then redirects.
      await login({ email: values.email, password: values.password });
    } catch (error) {
      setSubmitError(toApiError(error));
      setFocus("password");
    }
  });

  const errorText = submitError ? apiErrorMessage(submitError, "login") : null;

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t("login.title")}</h1>
      <p className="mt-1.5 text-muted">{t("login.subtitle")}</p>

      <div className="mt-6 space-y-3">
        {state?.registered && !submitError ? <Alert tone="success">{t("login.registered")}</Alert> : null}
        {sessionExpired && !submitError ? <Alert tone="info">{t("login.sessionExpired")}</Alert> : null}
        {errorText ? (
          <Alert tone="error" title={errorText.title}>
            {errorText.detail}
          </Alert>
        ) : null}
      </div>

      <SocialSignIn />

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4" aria-label={t("login.title")}>
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
          autoComplete="current-password"
          placeholder={t("fields.passwordPlaceholder")}
          error={fieldError(errors.password?.message)}
          {...register("password")}
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={isSubmitting}
          leftIcon={<LogIn className="size-4" aria-hidden="true" />}
        >
          {isSubmitting ? t("login.submitting") : t("login.submit")}
        </Button>
      </form>

      {USE_MOCKS ? (
        <p className="mt-4 rounded-md border border-dashed border-line-strong px-3 py-2 text-center font-mono text-[0.6875rem] text-muted">
          {t("login.demoHint", { email: MOCK_DEMO_USER.email, password: MOCK_DEMO_USER.password })}
        </p>
      ) : null}

      <p className="mt-8 text-center text-[0.8125rem] text-muted">
        {t("login.noAccount")}{" "}
        <Link
          to="/register"
          className="font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink"
        >
          {t("login.createAccount")}
        </Link>
      </p>
    </div>
  );
}
