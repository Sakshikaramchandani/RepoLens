import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { authApi } from "../api/auth";
import { toApiError } from "../api/errors";
import { githubApi, GITHUB_INTENT_KEY, GITHUB_RETURN_KEY } from "../api/github";
import { LogoMark } from "../components/Logo";
import { Alert } from "../components/ui/Alert";
import { Spinner } from "../components/ui/Spinner";
import { useApiErrorMessage } from "../hooks/useApiErrorMessage";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "../hooks/useTranslation";
import { consumeOAuthState } from "../lib/oauthState";

/** GitHub codes are single-use; StrictMode runs effects twice in dev, so remember what we sent. */
const handledCodes = new Set<string>();

function take(key: string): string | null {
  try {
    const value = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return value;
  } catch {
    return null;
  }
}

/** Only in-app paths — never an open redirect. */
function safePath(path: string | null, fallback: string): string {
  return path && path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

/**
 * /integrations/github/callback?code=…&state=… — shared by both GitHub flows:
 *  - "login":   Continue with GitHub (signed out) → JWT, account connected in the same step
 *  - "connect": Settings / New project (signed in) → token stored for repo access
 */
export function GithubCallbackPage() {
  const { t } = useTranslation();
  const apiErrorMessage = useApiErrorMessage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { status, loginWithToken } = useAuth();
  const [error, setError] = useState<{ title: string; detail?: string } | null>(null);

  useEffect(() => {
    if (status === "checking") return; // wait until we know whether someone is signed in
    const code = params.get("code");
    const state = params.get("state");
    const denied = params.get("error_description") ?? params.get("error");
    if (denied) {
      setError({ title: t("github.callbackError"), detail: denied });
      return;
    }
    if (!code || !state) {
      setError({ title: t("github.callbackError") });
      return;
    }
    if (handledCodes.has(code)) return;
    handledCodes.add(code);
    if (!consumeOAuthState(state)) {
      // Not started in this tab: a forged or stale link. Never exchange it (login CSRF).
      setError({ title: t("github.callbackError"), detail: t("auth.oauthStateMismatch") });
      return;
    }

    const intent = take(GITHUB_INTENT_KEY) ?? (status === "authenticated" ? "connect" : "login");
    const returnTo = take(GITHUB_RETURN_KEY);

    const run =
      intent === "login"
        ? authApi.githubCallback(code, state).then(async (token) => {
            await loginWithToken(token);
            toast.success(t("auth.githubSignedIn"));
            navigate(safePath(returnTo, "/dashboard"), { replace: true });
          })
        : githubApi.complete(code, state).then((connection) => {
            toast.success(t("github.connectedToast"), { description: connection.login ?? undefined });
            navigate(safePath(returnTo, "/settings"), { replace: true });
          });

    run.catch((err) => {
      const message = apiErrorMessage(toApiError(err));
      setError({ title: t("github.callbackError"), detail: message.detail ?? message.title });
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
              to={status === "authenticated" ? "/settings" : "/login"}
              className="block text-center text-[0.8125rem] font-medium text-ink underline decoration-line-strong underline-offset-4"
            >
              {status === "authenticated" ? t("github.back") : t("register.signIn")}
            </Link>
          </div>
        ) : (
          <p role="status" className="mt-6 flex items-center gap-2 text-muted">
            <Spinner /> {t("github.connecting")}
          </p>
        )}
      </div>
    </main>
  );
}
