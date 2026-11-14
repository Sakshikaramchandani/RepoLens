import { useEffect, useMemo, useState } from "react";
import { Github, Lock, Search, Star } from "lucide-react";
import { githubApi, type GithubConnection, type GithubRepo } from "../../api/github";
import { connectGithub } from "../../lib/githubFlow";
import { toApiError, type ApiError } from "../../api/errors";
import { projectsApi } from "../../api/projects";
import { useApiErrorMessage } from "../../hooks/useApiErrorMessage";
import { useTranslation } from "../../hooks/useTranslation";
import { PROJECT_LIMITS } from "../../schemas/project";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import { TextField } from "../ui/TextField";
import { ImportErrorAlert, ImportStatus } from "./FormFeedback";
import { useCreateProject, type SourceFormProps } from "./useCreateProject";

function relativeDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function GithubRepoPicker({
  connection,
  onBusyChange,
  onFinished,
  onProjectChanged,
}: SourceFormProps & { connection: GithubConnection | null }) {
  const { t } = useTranslation();
  const apiErrorMessage = useApiErrorMessage();
  const { step, error, run, busy } = useCreateProject(onProjectChanged);
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<ApiError | null>(null);

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);

  const connected = connection?.connected ?? false;

  useEffect(() => {
    if (!connected) return;
    let active = true;
    githubApi
      .repos()
      .then((list) => active && setRepos(list))
      .catch((err) => active && setLoadError(toApiError(err)));
    return () => {
      active = false;
    };
  }, [connected]);

  // Filtering happens locally: the full list (≤ 300) is already here, so typing costs no requests
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!repos || !q) return repos ?? [];
    return repos.filter((r) => r.fullName.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
  }, [repos, query]);

  if (connection && !connection.enabled) {
    return <Alert tone="info">{t("github.notConfigured")}</Alert>;
  }

  if (!connected) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
        <span className="grid size-11 place-items-center rounded-lg bg-primary text-on-primary">
          <Github className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-4 max-w-xs text-[0.8125rem] text-muted">{t("github.repos.connectPrompt")}</p>
        <Button
          className="mt-5"
          loading={connecting}
          leftIcon={<Github className="size-4" aria-hidden="true" />}
          onClick={async () => {
            setConnecting(true);
            setConnectError(null);
            try {
              await connectGithub("/projects?new=repos");
            } catch (err) {
              setConnectError(toApiError(err));
              setConnecting(false);
            }
          }}
        >
          {t("github.connect")}
        </Button>
        {connectError ? (
          <Alert tone="error" className="mt-4 text-left" title={apiErrorMessage(connectError).title}>
            {apiErrorMessage(connectError).detail}
          </Alert>
        ) : null}
      </div>
    );
  }

  const importRepo = async (repo: GithubRepo) => {
    setImporting(repo.fullName);
    const result = await run(
      {
        name: repo.name.slice(0, PROJECT_LIMITS.nameMax),
        description: repo.description?.slice(0, PROJECT_LIMITS.descriptionMax) || undefined,
      },
      (project) => projectsApi.importGithub(project.id, { repoUrl: repo.htmlUrl, branch: repo.defaultBranch }),
    );
    setImporting(null);
    if (result) onFinished(t("create.successGithub", { count: result.filesSaved, branch: result.branch }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[0.8125rem] text-muted">
        {connection?.avatarUrl ? <img src={connection.avatarUrl} alt="" className="size-5 rounded-full" /> : null}
        {t("github.connectedAs", { login: connection?.login ?? "" })}
      </div>
      <TextField
        label={t("github.repos.search")}
        hideLabel
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("github.repos.search")}
        startAdornment={<Search className="size-4" aria-hidden="true" />}
        disabled={busy}
      />

      {loadError ? (
        <Alert tone="error" title={t("github.repos.error")}>
          {apiErrorMessage(loadError).detail}
        </Alert>
      ) : repos === null ? (
        <div className="space-y-2" aria-label={t("github.repos.loading")} role="status">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-[0.8125rem] text-muted">
          {repos.length === 0 ? t("github.repos.none") : t("github.repos.empty", { query })}
        </p>
      ) : (
        <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-lg border border-line">
          {visible.map((repo) => (
            <li
              key={repo.fullName}
              className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2/60"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[0.8125rem] font-medium text-ink">
                  <span className="truncate">{repo.fullName}</span>
                  {repo.isPrivate ? (
                    <span className="inline-flex items-center gap-0.5 rounded-sm border border-line px-1 text-[0.625rem] font-normal text-muted">
                      <Lock className="size-2.5" aria-hidden="true" /> {t("github.repos.private")}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 flex items-center gap-2 truncate text-[0.6875rem] text-faint">
                  {repo.language ? <span className="text-muted">{repo.language}</span> : null}
                  {repo.stars > 0 ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="size-3" aria-hidden="true" /> {repo.stars}
                    </span>
                  ) : null}
                  <span>{t("github.repos.updated", { date: relativeDate(repo.pushedAt) })}</span>
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy && importing !== repo.fullName}
                loading={importing === repo.fullName}
                onClick={() => void importRepo(repo)}
              >
                {t("github.repos.import")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {error ? <ImportErrorAlert error={error} /> : null}
      {busy ? (
        <ImportStatus text={step === "creating" ? t("create.stepCreating") : t("create.stepImportingGithub")} />
      ) : null}
    </div>
  );
}
