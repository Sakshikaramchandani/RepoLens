import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Code2, History, Info, RefreshCw, ScanSearch, ShieldCheck } from "lucide-react";
import { toApiError, type ApiError } from "../../api/errors";
import { riskApi, type FileRisk, type RiskLabel, type RiskReport } from "../../api/risk";
import { Alert } from "../../components/ui/Alert";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button, IconButton } from "../../components/ui/Button";
import { cn } from "../../components/ui/cn";
import { EmptyState } from "../../components/ui/EmptyState";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Skeleton } from "../../components/ui/Skeleton";
import { useApiErrorMessage } from "../../hooks/useApiErrorMessage";
import { useTranslation } from "../../hooks/useTranslation";
import { EASE_OUT, gsap, prefersReducedMotion, useGSAP } from "../../motion/gsap";
import { useProject } from "../../projects/ProjectContext";

type Filter = "ALL" | RiskLabel;

const LABEL_TONE: Record<RiskLabel, BadgeTone> = { HIGH: "danger", MEDIUM: "warning", LOW: "success" };
const BAR: Record<RiskLabel, string> = { HIGH: "bg-danger", MEDIUM: "bg-warning", LOW: "bg-success" };
const PAGE = 60;

/** Analysis is cheap but not free: reuse it for a minute when switching tabs. */
const cache = new Map<number, { report: RiskReport; at: number }>();
const CACHE_MS = 60_000;

const fileName = (path: string) => path.substring(path.lastIndexOf("/") + 1);
const folder = (path: string) => path.substring(0, path.lastIndexOf("/"));

export function ProjectRiskPage() {
  const { t } = useTranslation();
  const apiErrorMessage = useApiErrorMessage();
  const { projectId } = useProject();
  const [report, setReport] = useState<RiskReport | null>(() => cache.get(projectId)?.report ?? null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [limit, setLimit] = useState(PAGE);
  const list = useRef<HTMLOListElement>(null);

  const load = useCallback(
    async (force = false) => {
      const hit = cache.get(projectId);
      if (!force && hit && Date.now() - hit.at < CACHE_MS) return;
      setLoading(true);
      setError(null);
      try {
        const fresh = await riskApi.report(projectId);
        cache.set(projectId, { report: fresh, at: Date.now() });
        setReport(fresh);
      } catch (err) {
        setError(toApiError(err));
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // score bars grow once per load, first rows only (a wave, not a queue)
  useGSAP(
    () => {
      if (!report || prefersReducedMotion() || !list.current) return;
      const bars = Array.from(list.current.querySelectorAll("[data-bar]")).slice(0, 12);
      gsap.from(bars, { scaleX: 0, duration: 0.7, ease: EASE_OUT, stagger: { each: 0.035, ease: "power1.in" } });
    },
    { dependencies: [report], scope: list, revertOnUpdate: true },
  );

  if (error && !report) {
    return (
      <Alert
        tone="error"
        title={t("risk.error")}
        action={
          <Button size="sm" variant="secondary" onClick={() => void load(true)}>
            {t("common.retry")}
          </Button>
        }
      >
        {apiErrorMessage(error).detail ?? apiErrorMessage(error).title}
      </Alert>
    );
  }

  if (!report) {
    return (
      <div className="space-y-3" role="status" aria-label={t("common.loading")}>
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (report.filesAnalyzed === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong">
        <EmptyState
          icon={<ShieldCheck className="size-5" aria-hidden="true" />}
          title={t("risk.empty")}
          body={t("risk.emptyBody")}
        />
      </div>
    );
  }

  const shown = report.files.filter((f) => filter === "ALL" || f.label === filter);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {(["HIGH", "MEDIUM", "LOW"] as const).map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => setFilter((f) => (f === label ? "ALL" : label))}
            aria-pressed={filter === label}
            className={cn(
              "rl-press rounded-lg border bg-surface px-4 py-3 text-left shadow-card",
              filter === label ? "border-ink/40 ring-1 ring-ink/10" : "border-line hover:border-line-strong",
            )}
          >
            <p className="flex items-center gap-1.5 text-[0.75rem] text-muted">
              <span className={cn("size-1.5 rounded-full", BAR[label])} aria-hidden="true" />
              {t(`risk.${label.toLowerCase() as "high" | "medium" | "low"}`)}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.02em] tabular-nums">
              {label === "HIGH" ? report.high : label === "MEDIUM" ? report.medium : report.low}
            </p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl<Filter>
          label={t("risk.filterLabel")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "ALL", label: t("risk.all") },
            { value: "HIGH", label: t("risk.high") },
            { value: "MEDIUM", label: t("risk.medium") },
            { value: "LOW", label: t("risk.low") },
          ]}
        />
        <div className="flex items-center gap-2 text-[0.75rem] text-faint">
          {t("risk.files", { count: report.filesAnalyzed })}
          <IconButton label={t("risk.refresh")} size="sm" onClick={() => void load(true)} disabled={loading}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 text-[0.75rem] text-muted">
        <p className="flex items-start gap-2">
          {report.historyAvailable ? (
            <History className="mt-px size-3.5 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          )}
          {report.historyAvailable ? t("risk.history", { count: report.historyCommits }) : t("risk.noHistory")}
        </p>
        {report.languages.length > 0 ? (
          <p className="flex flex-wrap items-center gap-1" aria-label={t("risk.languages")}>
            {report.languages.map((language) => (
              <Badge key={language}>{language}</Badge>
            ))}
          </p>
        ) : null}
      </div>

      <ol
        ref={list}
        className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-card"
      >
        {shown.slice(0, limit).map((f) => (
          <RiskRow key={f.fileId} file={f} />
        ))}
      </ol>
      {shown.length > limit ? (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
            +{Math.min(PAGE, shown.length - limit)}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RiskRow({ file }: { file: FileRisk }) {
  const { t } = useTranslation();
  const { projectId } = useProject();
  return (
    <li className="group grid gap-3 px-4 py-3 transition-colors duration-100 hover:bg-surface-2/50 sm:grid-cols-[minmax(0,1fr)_17rem_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Badge tone={LABEL_TONE[file.label]}>{file.score}</Badge>
          <p className="truncate text-[0.8125rem] font-medium text-ink" title={file.filePath}>
            {fileName(file.filePath)}
          </p>
          <span className="shrink-0 text-[0.6875rem] text-faint">{file.language}</span>
        </div>
        <p className="mt-0.5 truncate font-mono text-[0.625rem] text-faint">{folder(file.filePath)}</p>
        {file.findings.length > 0 ? (
          <ul className="mt-1.5 space-y-0.5">
            {file.findings.slice(0, 2).map((finding) => (
              <li key={finding} className="truncate text-[0.75rem] text-muted" title={finding}>
                · {finding}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
          <div
            data-bar
            className={cn("h-full origin-left rounded-full", BAR[file.label])}
            style={{ transform: `scaleX(${file.score / 100})` }}
          />
        </div>
        <dl
          className={cn(
            "grid gap-1 text-[0.625rem] whitespace-nowrap text-faint",
            file.churn === null ? "grid-cols-4" : "grid-cols-5",
          )}
        >
          <div>
            <dt>{t("risk.complexity")}</dt>
            <dd className="font-mono text-[0.75rem] text-ink-2">{file.complexity}</dd>
          </div>
          <div title={t("risk.worstMethodHint")}>
            <dt>{t("risk.worstMethod")}</dt>
            <dd className="font-mono text-[0.75rem] text-ink-2">{file.maxMethodComplexity}</dd>
          </div>
          <div>
            <dt>{t("risk.loc")}</dt>
            <dd className="font-mono text-[0.75rem] text-ink-2">{file.loc}</dd>
          </div>
          {file.churn === null ? (
            <div>
              <dt>{t("risk.warnings")}</dt>
              <dd className="font-mono text-[0.75rem] text-ink-2">{file.warnings}</dd>
            </div>
          ) : (
            <>
              <div title={t("risk.authors") + ": " + (file.authors ?? 0)}>
                <dt>{t("risk.commits")}</dt>
                <dd className="font-mono text-[0.75rem] text-ink-2">{file.churn}</dd>
              </div>
              <div>
                <dt>{t("risk.bugFixes")}</dt>
                <dd
                  className={cn(
                    "font-mono text-[0.75rem]",
                    (file.bugFixCommits ?? 0) >= 2 ? "text-danger" : "text-ink-2",
                  )}
                >
                  {file.bugFixCommits}
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>

      <div className="flex items-center gap-1 sm:justify-end">
        <Link
          to={`/projects/${projectId}?file=${file.fileId}`}
          aria-label={`${t("project.tabs.code")}: ${fileName(file.filePath)}`}
          title={t("project.tabs.code")}
          className="rl-press grid size-8 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-ink"
        >
          <Code2 className="size-4" aria-hidden="true" />
        </Link>
        <Link
          to={`/projects/${projectId}/review?file=${file.fileId}`}
          title={t("risk.reviewFile", { file: fileName(file.filePath) })}
          className="rl-press inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[0.75rem] font-medium text-ink shadow-card hover:bg-surface-2"
        >
          <ScanSearch className="size-3.5" aria-hidden="true" />
          {t("risk.review")}
        </Link>
      </div>
    </li>
  );
}
