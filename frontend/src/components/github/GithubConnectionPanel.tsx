import { useEffect, useState } from "react";
import { Github, LogOut } from "lucide-react";
import { toast } from "sonner";
import { githubApi, type GithubConnection } from "../../api/github";
import { toApiError } from "../../api/errors";
import { useApiErrorMessage } from "../../hooks/useApiErrorMessage";
import { useTranslation } from "../../hooks/useTranslation";
import { connectGithub } from "../../lib/githubFlow";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";

export function GithubConnectionPanel() {
  const { t } = useTranslation();
  const apiErrorMessage = useApiErrorMessage();
  const [connection, setConnection] = useState<GithubConnection | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    githubApi
      .connection()
      .then((c) => active && setConnection(c))
      .catch(
        () => active && setConnection({ enabled: false, connected: false, login: null, avatarUrl: null, scopes: null }),
      );
    return () => {
      active = false;
    };
  }, []);

  if (!connection) return <Skeleton className="h-12" />;
  if (!connection.enabled) return <Alert tone="info">{t("github.notConfigured")}</Alert>;

  if (connection.connected) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {connection.avatarUrl ? (
            <img src={connection.avatarUrl} alt="" className="size-9 rounded-full border border-line" />
          ) : (
            <span className="grid size-9 place-items-center rounded-full bg-primary text-on-primary">
              <Github className="size-4" aria-hidden="true" />
            </span>
          )}
          <div>
            <p className="text-[0.8125rem] font-medium text-ink">
              {t("github.connectedAs", { login: connection.login ?? "" })}
            </p>
            {connection.scopes ? <p className="font-mono text-[0.6875rem] text-faint">{connection.scopes}</p> : null}
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          loading={busy}
          leftIcon={<LogOut className="size-3.5" aria-hidden="true" />}
          onClick={async () => {
            setBusy(true);
            try {
              await githubApi.disconnect();
              setConnection({ ...connection, connected: false, login: null, avatarUrl: null, scopes: null });
              toast.success(t("github.disconnected"));
            } catch (err) {
              toast.error(apiErrorMessage(toApiError(err)).title);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("github.disconnect")}
        </Button>
      </div>
    );
  }

  return (
    <Button
      loading={busy}
      leftIcon={<Github className="size-4" aria-hidden="true" />}
      onClick={async () => {
        setBusy(true);
        try {
          await connectGithub("/settings");
        } catch (err) {
          toast.error(apiErrorMessage(toApiError(err)).title, { description: apiErrorMessage(toApiError(err)).detail });
          setBusy(false);
        }
      }}
    >
      {t("github.connect")}
    </Button>
  );
}
