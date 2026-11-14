import { useEffect, useState } from "react";
import { Github } from "lucide-react";
import { authApi, type AuthProviders } from "../../api/auth";
import { toApiError } from "../../api/errors";
import { GITHUB_INTENT_KEY, GITHUB_RETURN_KEY } from "../../api/github";
import { useApiErrorMessage } from "../../hooks/useApiErrorMessage";
import { useTranslation } from "../../hooks/useTranslation";
import { Alert } from "../ui/Alert";
import { rememberOAuthState } from "../../lib/oauthState";
import { Button } from "../ui/Button";

type Provider = keyof AuthProviders;

/** Google's "G" mark — its sign-in branding guidelines ask for the multicolour logo on the button. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.11Z" />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.94 11.94 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}

/**
 * "Continue with GitHub / Google" + an "or" divider. Each button only appears when the server has
 * that OAuth app configured, so the form never shows a button that cannot work.
 */
export function SocialSignIn() {
  const { t } = useTranslation();
  const apiErrorMessage = useApiErrorMessage();
  const [providers, setProviders] = useState<AuthProviders>({ github: false, google: false });
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<{ title: string; detail?: string } | null>(null);

  useEffect(() => {
    let active = true;
    authApi
      .providers()
      .then((p) => active && setProviders(p))
      .catch(() => active && setProviders({ github: false, google: false }));
    return () => {
      active = false;
    };
  }, []);

  if (!providers.github && !providers.google) return null;

  const start = async (provider: Provider) => {
    setBusy(provider);
    setError(null);
    if (provider === "github") {
      try {
        sessionStorage.setItem(GITHUB_INTENT_KEY, "login");
        sessionStorage.setItem(GITHUB_RETURN_KEY, "/dashboard");
      } catch {
        /* storage blocked: the callback still signs in, then lands on the overview */
      }
    }
    try {
      const url = provider === "github" ? await authApi.githubStart() : await authApi.googleStart();
      rememberOAuthState(url);
      window.location.assign(url);
    } catch (err) {
      setError(apiErrorMessage(toApiError(err)));
      setBusy(null);
    }
  };

  return (
    <div className="mt-6 animate-fade">
      <div className="space-y-2.5">
        {providers.google ? (
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            loading={busy === "google"}
            disabled={busy !== null && busy !== "google"}
            leftIcon={<GoogleMark />}
            onClick={() => start("google")}
          >
            {t("auth.google")}
          </Button>
        ) : null}
        {providers.github ? (
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            loading={busy === "github"}
            disabled={busy !== null && busy !== "github"}
            leftIcon={<Github className="size-4" aria-hidden="true" />}
            onClick={() => start("github")}
          >
            {t("auth.github")}
          </Button>
        ) : null}
      </div>
      {providers.github ? <p className="mt-2 text-center text-[0.75rem] text-faint">{t("auth.githubHint")}</p> : null}
      {error ? (
        <Alert tone="error" title={error.title} className="mt-3">
          {error.detail}
        </Alert>
      ) : null}
      <div className="mt-6 flex items-center gap-3 text-[0.75rem] text-faint" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
