import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { authApi } from "../api/auth";
import { toApiError } from "../api/errors";
import { LogoMark } from "../components/Logo";
import { Alert } from "../components/ui/Alert";
import { Spinner } from "../components/ui/Spinner";
import { useApiErrorMessage } from "../hooks/useApiErrorMessage";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "../hooks/useTranslation";
import { consumeOAuthState } from "../lib/oauthState";

/** Google codes are single-use; StrictMode runs effects twice in dev, so remember what we sent. */
const handledCodes = new Set<string>();

/**
 * /auth/google/callback?code=…&state=… — Google redirects to the backend redirect URI, which
 * forwards here. Exchange the code for a JWT and sign in.
 */
export function GoogleCallbackPage() {
  const { t } = useTranslation();
  const apiErrorMessage = useApiErrorMessage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { status, loginWithToken } = useAuth();
  const [error, setError] = useState<{ title: string; detail?: string } | null>(null);

  useEffect(() => {
    if (status === "checking") return;
    const code = params.get("code");
    const state = params.get("state");
    const denied = params.get("error");
    if (denied) {
      // "access_denied" = the user pressed Cancel on Google's screen
      setError({ title: t("auth.googleError"), detail: denied });
      return;
    }
    if (!code || !state) {
      setError({ title: t("auth.googleError") });
      return;
    }
    if (handledCodes.has(code)) return;
    handledCodes.add(code);
    if (!consumeOAuthState(state)) {
      // Not started in this tab: a forged or stale link. Never exchange it (login CSRF).
      setError({ title: t("auth.googleError"), detail: t("auth.oauthStateMismatch") });
      return;
    }

    authApi
      .googleCallback(code, state)
      .then(async (token) => {
        await loginWithToken(token);
        toast.success(t("auth.googleSignedIn"));
        navigate("/dashboard", { replace: true });
      })
      .catch((err) => {
        const message = apiErrorMessage(toApiError(err));
        setError({ title: t("auth.googleError"), detail: message.detail ?? message.title });
      });
  }, [status, params, navigate, t, apiErrorMessage, loginWithToken]);

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <LogoMark className="size-9" />
        {error ? (
          <div className="mt-6 w-full space-y-4 text-left">
            <Alert tone="error" title={error.title}>
              {error.detail}
            </Alert>
            <Link
              to="/login"
              className="block text-center text-[0.8125rem] font-medium text-ink underline decoration-line-strong underline-offset-4"
            >
              {t("register.signIn")}
            </Link>
          </div>
        ) : (
          <p role="status" className="mt-6 flex items-center gap-2 text-muted">
            <Spinner /> {t("auth.googleConnecting")}
          </p>
        )}
      </div>
    </main>
  );
}
