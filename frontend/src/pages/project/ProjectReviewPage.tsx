import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, FileCode2, ScanSearch, Search, Sparkles, X } from "lucide-react";
import { toApiError, type ApiError } from "../../api/errors";
import { REVIEW_MAX_FILES, reviewApi, type ReviewIssue, type ReviewResponse, type Severity } from "../../api/review";
import { MarkdownAnswer } from "../../components/chat/MarkdownAnswer";
import { Alert } from "../../components/ui/Alert";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button, IconButton } from "../../components/ui/Button";
import { cn } from "../../components/ui/cn";
import { EmptyState } from "../../components/ui/EmptyState";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { TextField } from "../../components/ui/TextField";
import { useApiErrorMessage } from "../../hooks/useApiErrorMessage";
import { useTranslation } from "../../hooks/useTranslation";
import { EASE_OUT, gsap, prefersReducedMotion, useGSAP } from "../../motion/gsap";
import { useProject } from "../../projects/ProjectContext";

const SEVERITY_TONE: Record<Severity, BadgeTone> = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "info",
};
const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
/** Binary-free by construction (the import keeps only text files); docs and lock files are not worth a review. */
const NOT_REVIEWABLE = /\.(md|mdx|rst|adoc|txt|json)$/i;
/** Application code first in the list, config after it. */
const CODE =
  /\.(java|kt|kts|scala|groovy|cs|c|h|cpp|cc|cxx|hpp|m|mm|go|rs|swift|dart|js|jsx|mjs|cjs|ts|tsx|mts|cts|vue|svelte|php|py|rb|ex|exs|r|lua|sh|bash|ps1|sql)$/i;

/** Reviews are paid model calls: keep the last result per project for this session. */
const lastReview = new Map<number, ReviewResponse>();

const fileName = (path: string) => path.substring(path.lastIndexOf("/") + 1);

export function ProjectReviewPage() {
  const { t } = useTranslation();
  const apiErrorMessage = useApiErrorMessage();
  const { projectId, files } = useProject();
  const [params] = useSearchParams();
  const preselected = Number(params.get("file"));
  const [selected, setSelected] = useState<number[]>(() =>
    Number.isInteger(preselected) && preselected > 0 ? [preselected] : [],
  );
  const [filter, setFilter] = useState("");
  const [focus, setFocus] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<ReviewResponse | null>(() => lastReview.get(projectId) ?? null);
  const results = useRef<HTMLDivElement>(null);

  const candidates = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return files
      .filter((f) => f.fileId !== null && !NOT_REVIEWABLE.test(f.name))
      .filter((f) => !q || f.path.toLowerCase().includes(q))
      .sort((a, b) => Number(CODE.test(b.name)) - Number(CODE.test(a.name)) || a.path.localeCompare(b.path));
  }, [files, filter]);

  const toggle = (id: number) =>
    setSelected((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : list.length >= REVIEW_MAX_FILES ? list : [...list, id],
    );

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const response = await reviewApi.review(projectId, selected, focus);
      lastReview.set(projectId, response);
      setResult(response);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setRunning(false);
    }
  };

  // issues land as a short wave (results are rare and worth reading in order)
  useGSAP(
    () => {
      if (!result || prefersReducedMotion() || !results.current) return;
      const items = results.current.querySelectorAll("[data-issue]");
      gsap.from(Array.from(items).slice(0, 8), {
        autoAlpha: 0,
        y: 8,
        duration: 0.4,
        ease: EASE_OUT,
        stagger: { each: 0.05, ease: "power1.in" },
      });
    },
    { dependencies: [result], scope: results, revertOnUpdate: true },
  );

  const fileIdOf = (path: string) => files.find((f) => f.path === path)?.fileId ?? null;
  const counts = result ? SEVERITIES.map((s) => ({ s, n: result.issues.filter((i) => i.severity === s).length })) : [];

  // the grid grows with the results (flex-none), so the sticky picker stays pinned for the whole page
  return (
    <div className="grid flex-none gap-4 lg:grid-cols-[19rem_minmax(0,1fr)] lg:pb-5">
      <section
        aria-labelledby="pick-heading"
        className="flex min-h-0 flex-col rounded-lg border border-line bg-surface p-3 shadow-card lg:sticky lg:top-16 lg:max-h-[calc(100dvh-6.5rem)] lg:self-start"
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 id="pick-heading" className="text-[0.8125rem] font-semibold">
            {t("review.pickFiles")}
          </h2>
          <span
            className={cn(
              "text-[0.6875rem] tabular-nums",
              selected.length >= REVIEW_MAX_FILES ? "text-accent-strong dark:text-accent" : "text-faint",
            )}
          >
            {t("review.selected", { count: selected.length, max: REVIEW_MAX_FILES })}
          </span>
        </div>
        <TextField
          label={t("review.filter")}
          hideLabel
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("review.filter")}
          startAdornment={<Search className="size-3.5" aria-hidden="true" />}
          inputSize="sm"
        />
        <ul
          className="mt-2 max-h-72 min-h-0 flex-1 space-y-px overflow-y-auto lg:max-h-none"
          aria-label={t("review.pickFiles")}
        >
          {candidates.map((f) => {
            const checked = selected.includes(f.fileId!);
            const full = !checked && selected.length >= REVIEW_MAX_FILES;
            return (
              <li key={f.path}>
                <label
                  title={full ? t("review.limit", { max: REVIEW_MAX_FILES }) : f.path}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-100",
                    checked ? "bg-accent-soft" : "hover:bg-surface-2",
                    full && "cursor-not-allowed opacity-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={full || running}
                    onChange={() => toggle(f.fileId!)}
                    className="size-3.5 shrink-0 accent-[var(--rl-accent)]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[0.8125rem] text-ink">{f.name}</span>
                    <span className="block truncate font-mono text-[0.625rem] text-faint">{f.path}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <TextField
            label={t("review.focus")}
            value={focus}
            maxLength={200}
            onChange={(e) => setFocus(e.target.value)}
            placeholder={t("review.focusPlaceholder")}
            inputSize="sm"
          />
          <div className="flex gap-2">
            <Button
              className="min-w-0 flex-1"
              onClick={() => void run()}
              loading={running}
              disabled={selected.length === 0}
              leftIcon={<Sparkles className="size-4" aria-hidden="true" />}
            >
              {t("review.run")}
            </Button>
            {selected.length > 0 && !running ? (
              <IconButton label={t("review.clear")} onClick={() => setSelected([])}>
                <X className="size-4" aria-hidden="true" />
              </IconButton>
            ) : null}
          </div>
        </div>
      </section>

      <div ref={results} className="min-w-0 space-y-3" aria-live="polite">
        {running ? (
          <div className="rounded-lg border border-line bg-surface p-5 shadow-card" role="status">
            <p className="flex items-center gap-2 text-[0.8125rem] text-ink-2">
              <Sparkles className="size-4 text-accent" aria-hidden="true" />
              {t("review.running")}
            </p>
            <ProgressBar value={null} label={t("review.running")} className="mt-4" />
          </div>
        ) : error ? (
          <Alert tone="error" title={t("review.error")}>
            {apiErrorMessage(error).detail ?? apiErrorMessage(error).title}
          </Alert>
        ) : !result ? (
          <div className="rounded-lg border border-dashed border-line-strong">
            <EmptyState
              icon={<ScanSearch className="size-5" aria-hidden="true" />}
              title={t("review.empty")}
              body={t("review.emptyBody")}
            />
          </div>
        ) : (
          <>
            <section
              className="rounded-lg border border-line bg-surface p-4 shadow-card"
              aria-labelledby="summary-heading"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="summary-heading" className="text-[0.8125rem] font-semibold">
                  {t("review.summary")}
                </h2>
                <span className="font-mono text-[0.6875rem] text-faint">{t("review.by", { model: result.model })}</span>
              </div>
              {result.summary ? (
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-2">{result.summary}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {counts
                  .filter((c) => c.n > 0)
                  .map(({ s, n }) => (
                    <Badge key={s} tone={SEVERITY_TONE[s]} dot>
                      {n} {t(`review.severity.${s}`)}
                    </Badge>
                  ))}
                {result.files.map((f) => (
                  <Badge key={f.fileId}>
                    <FileCode2 className="size-3" aria-hidden="true" /> {fileName(f.path)}
                  </Badge>
                ))}
              </div>
              {result.files
                .filter((f) => f.truncated)
                .map((f) => (
                  <p key={f.fileId} className="mt-2 text-[0.75rem] text-warning">
                    {t("review.truncated", { file: fileName(f.path) })}
                  </p>
                ))}
            </section>

            {result.issues.length === 0 ? (
              <div className="rounded-lg border border-line bg-surface">
                <EmptyState
                  icon={<Sparkles className="size-5 text-success" aria-hidden="true" />}
                  title={t("review.noIssues")}
                  body={t("review.noIssuesBody")}
                />
              </div>
            ) : (
              <ol className="space-y-2">
                {result.issues.map((issue, i) => (
                  <li key={`${issue.file}-${issue.line}-${i}`} data-issue>
                    <IssueCard issue={issue} projectId={projectId} fileId={fileIdOf(issue.file) ?? issue.fileId} />
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function IssueCard({ issue, projectId, fileId }: { issue: ReviewIssue; projectId: number; fileId: number }) {
  const { t } = useTranslation();
  const href = `/projects/${projectId}?file=${fileId}${issue.line > 0 ? `&line=${issue.line}` : ""}`;
  return (
    <article className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={SEVERITY_TONE[issue.severity]} dot>
          {t(`review.severity.${issue.severity}`)}
        </Badge>
        <Badge>{t(`review.category.${issue.category}`)}</Badge>
        <Link
          to={href}
          className="group ml-auto inline-flex items-center gap-1 font-mono text-[0.6875rem] text-muted transition-colors hover:text-ink"
          title={t("review.openInCode")}
        >
          {fileName(issue.file)}
          {issue.line > 0 ? `:${issue.line}` : ""}
          <ArrowUpRight
            className="size-3 transition-transform duration-200 group-hover:translate-x-px group-hover:-translate-y-px"
            aria-hidden="true"
          />
        </Link>
      </div>
      <p className="mt-2.5 text-[0.875rem] leading-relaxed text-ink">{issue.issue}</p>
      {issue.suggestion ? (
        <div className="mt-3 rounded-md border border-line bg-surface-2/60 px-3 py-2">
          <p className="mb-1 text-[0.6875rem] font-medium tracking-wide text-faint uppercase">
            {t("review.suggestion")}
          </p>
          <MarkdownAnswer text={issue.suggestion} />
        </div>
      ) : null}
    </article>
  );
}
