import { useEffect, useRef } from "react";
import { DatabaseZap, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { isIndexing } from "../../api/indexing";
import { useApiErrorMessage } from "../../hooks/useApiErrorMessage";
import { useIndexing } from "../../hooks/useIndexing";
import { useTranslation } from "../../hooks/useTranslation";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { cn } from "../ui/cn";
import { ProgressBar } from "../ui/ProgressBar";
import { Spinner } from "../ui/Spinner";

export type IndexingController = ReturnType<typeof useIndexing>;

function DrawnCheck() {
  return (
    <svg viewBox="0 0 16 16" className="rl-check size-4 text-success" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.14" />
      <path
        d="M4.8 8.3 7 10.4l4.2-4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Compact index status for the project header: what state the AI index is in, one action,
 * a progress bar while it runs. When a run finishes the check draws itself and a toast says
 * chat is ready — completion feedback on the event that caused it.
 */
export function IndexControl({
  indexing,
  hasFiles,
  compact = false,
  className,
}: {
  indexing: IndexingController;
  hasFiles: boolean;
  /** Inline status + button, no card — for the project header. */
  compact?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const apiErrorMessage = useApiErrorMessage();
  const { state, start, starting, startError, retryStatus } = indexing;
  const job = state.phase === "job" ? state.job : null;
  const running = isIndexing(job?.status);
  const wasRunning = useRef(false);

  useEffect(() => {
    if (running) wasRunning.current = true;
    else if (wasRunning.current && job?.status === "DONE") {
      wasRunning.current = false;
      toast.success(t("indexing.finishedToast"), { description: t("indexing.done", { count: job.totalFiles }) });
    }
  }, [running, job, t]);

  const summary = (() => {
    if (!hasFiles) return t("indexing.noFiles");
    switch (state.phase) {
      case "loading":
        return t("indexing.checking");
      case "never":
        return t("indexing.never");
      case "error":
        return t("indexing.unknown");
      case "job":
        switch (state.job.status) {
          case "QUEUED":
            return t("indexing.queued");
          case "RUNNING":
            return t("indexing.running", { processed: state.job.processedFiles, total: state.job.totalFiles });
          case "DONE":
            return t("indexing.done", { count: state.job.totalFiles });
          case "FAILED":
            return t("indexing.failed");
          default:
            return t("indexing.never");
        }
    }
  })();

  const icon =
    state.phase === "loading" || running ? (
      <Spinner className="text-accent" />
    ) : job?.status === "DONE" ? (
      <DrawnCheck />
    ) : job?.status === "FAILED" || state.phase === "error" ? (
      <TriangleAlert className="size-4 text-danger" aria-hidden="true" />
    ) : (
      <DatabaseZap className="size-4 text-faint" aria-hidden="true" />
    );

  const startErrorMessage = startError ? apiErrorMessage(startError) : null;

  return (
    <section
      aria-label={t("indexing.title")}
      className={cn("w-full space-y-2 sm:w-auto", compact ? "sm:max-w-md" : "sm:min-w-[19rem]", className)}
    >
      <div
        className={cn(
          "flex items-center",
          compact ? "gap-2" : "gap-3 rounded-lg border border-line bg-surface px-3 py-2 shadow-card",
        )}
      >
        <span className="grid size-6 shrink-0 place-items-center">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[0.6875rem] font-medium tracking-wide text-faint uppercase", compact && "sr-only")}>
            {t("indexing.title")}
          </p>
          <p className="truncate text-[0.8125rem] text-ink-2" title={summary}>
            {summary}
          </p>
        </div>
        <Button
          size="sm"
          variant={job?.status === "DONE" ? "secondary" : "primary"}
          leftIcon={
            job ? (
              <RefreshCw className="size-3.5" aria-hidden="true" />
            ) : (
              <DatabaseZap className="size-3.5" aria-hidden="true" />
            )
          }
          loading={starting}
          disabled={!hasFiles || running || state.phase === "loading"}
          onClick={() => void start()}
        >
          {job ? t("indexing.reindex") : t("indexing.start")}
        </Button>
      </div>
      {running && job ? (
        <ProgressBar value={job.status === "QUEUED" ? null : job.progress} label={t("indexing.progressLabel")} />
      ) : null}
      {job?.status === "FAILED" ? (
        <Alert tone="error" title={t("indexing.failedTitle")}>
          {job.errorMessage ?? t("indexing.failedBody")}
        </Alert>
      ) : null}
      {startErrorMessage ? (
        <Alert tone="error" title={t("indexing.startError")}>
          {startErrorMessage.title} {startErrorMessage.detail}
        </Alert>
      ) : null}
      {state.phase === "error" ? (
        <Alert
          tone="error"
          title={t("indexing.statusError")}
          action={
            <Button variant="secondary" size="sm" onClick={retryStatus}>
              {t("common.retry")}
            </Button>
          }
        >
          {apiErrorMessage(state.error).title}
        </Alert>
      ) : null}
    </section>
  );
}

/** Standalone version (own polling) — handy where no project context exists, and in tests. */
export function IndexPanel({ projectId, hasFiles }: { projectId: number; hasFiles: boolean }) {
  const indexing = useIndexing(projectId);
  return <IndexControl indexing={indexing} hasFiles={hasFiles} />;
}
