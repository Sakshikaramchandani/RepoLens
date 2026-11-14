import { useMemo, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Code2,
  FileArchive,
  Github,
  MessagesSquare,
  ScanSearch,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { filesApi } from "../../api/files";
import { projectsApi } from "../../api/projects";
import { flattenFiles } from "../../components/explorer/treeUtils";
import { IndexControl } from "../../components/indexing/IndexControl";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { cn } from "../../components/ui/cn";
import { Skeleton } from "../../components/ui/Skeleton";
import { useApiErrorMessage } from "../../hooks/useApiErrorMessage";
import { useApiResource } from "../../hooks/useApiResource";
import { useIndexing } from "../../hooks/useIndexing";
import { useSlidingIndicator } from "../../hooks/useSlidingIndicator";
import { useTranslation } from "../../hooks/useTranslation";
import type { TranslationKey } from "../../i18n/locales/en";
import { ProjectContext, type ProjectContextValue } from "../../projects/ProjectContext";

const TABS: ReadonlyArray<{ to: string; labelKey: TranslationKey; icon: LucideIcon }> = [
  { to: "", labelKey: "project.tabs.code", icon: Code2 },
  { to: "chat", labelKey: "project.tabs.chat", icon: MessagesSquare },
  { to: "review", labelKey: "project.tabs.review", icon: ScanSearch },
  { to: "risk", labelKey: "project.tabs.risk", icon: ShieldAlert },
];

function positiveInt(value: string | undefined): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** /projects/:projectId/* — header, index control and tabs stay; only the tab content changes. */
export function ProjectLayout() {
  const params = useParams();
  const projectId = positiveInt(params.projectId);
  if (projectId === null) return <ProjectMissing />;
  return <ProjectWorkspace key={projectId} projectId={projectId} />;
}

function ProjectMissing({ detail }: { detail?: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> {t("explorer.back")}
      </Link>
      <Alert tone="error" title={t("explorer.projectError")}>
        {detail ?? t("explorer.notFound")}
      </Alert>
    </div>
  );
}

function ProjectWorkspace({ projectId }: { projectId: number }) {
  const { t } = useTranslation();
  const apiErrorMessage = useApiErrorMessage();
  const { pathname } = useLocation();
  const project = useApiResource(() => projectsApi.get(projectId), [projectId]);
  const tree = useApiResource(() => filesApi.tree(projectId), [projectId]);
  const indexing = useIndexing(projectId);
  const tabsRef = useRef<HTMLDivElement>(null);
  const underline = useSlidingIndicator(tabsRef, [pathname]);

  const value = useMemo<ProjectContextValue>(() => {
    const files = tree.data ? flattenFiles(tree.data) : [];
    const fileIdByPath = new Map<string, number>();
    for (const f of files) if (f.fileId !== null) fileIdByPath.set(f.path, f.fileId);
    return {
      projectId,
      project: project.data,
      tree: tree.data,
      treeStatus: tree.status,
      treeError: tree.error,
      reloadTree: tree.reload,
      files,
      fileIdByPath,
      indexing,
      isIndexed: indexing.state.phase === "job" && indexing.state.job.status === "DONE",
    };
  }, [projectId, project.data, tree.data, tree.status, tree.error, tree.reload, indexing]);

  if (project.status === "error") {
    const notFound = project.error?.status === 404;
    return <ProjectMissing detail={notFound ? undefined : apiErrorMessage(project.error!).title} />;
  }

  const source = project.data?.sourceType;
  const SourceIcon = source === "GITHUB" ? Github : FileArchive;
  const base = `/projects/${projectId}`;
  const activeTab = pathname.slice(base.length).replace(/^\//, "").split("/")[0] ?? "";

  return (
    <ProjectContext.Provider value={value}>
      <div className="flex min-h-0 flex-1 flex-col">
        <header data-enter="lead" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          {project.data ? (
            <div className="flex min-w-0 flex-1 items-baseline gap-x-3 gap-y-1 max-sm:flex-wrap">
              <div className="flex min-w-0 shrink-0 items-center gap-2 self-center">
                <h1 className="truncate text-xl font-semibold">{project.data.name}</h1>
                {source && source !== "NONE" ? (
                  <Badge>
                    <SourceIcon className="size-3" aria-hidden="true" />
                    {t(source === "GITHUB" ? "projects.source.github" : "projects.source.zip")}
                  </Badge>
                ) : null}
              </div>
              <p className="min-w-0 truncate text-[0.8125rem] text-muted" title={project.data.description || undefined}>
                {project.data.description || t("projects.noDescription")}
                {tree.status === "ready" ? (
                  <span className="text-faint"> · {t("explorer.fileCount", { count: value.files.length })}</span>
                ) : null}
              </p>
            </div>
          ) : (
            <Skeleton className="h-7 w-80" />
          )}
          {tree.status === "ready" ? (
            <IndexControl indexing={indexing} hasFiles={value.files.length > 0} compact />
          ) : null}
        </header>

        <div
          data-enter="support"
          ref={tabsRef}
          role="navigation"
          aria-label={t("project.tabsLabel")}
          className="relative mt-3 flex gap-1 overflow-x-auto border-b border-line"
        >
          {underline ? (
            <span
              aria-hidden="true"
              className="absolute bottom-0 left-0 h-0.5 rounded-full bg-ink transition-[transform,width] duration-[280ms] ease-[var(--ease-out)]"
              style={{ transform: `translateX(${underline.x}px)`, width: underline.w }}
            />
          ) : null}
          {TABS.map(({ to, labelKey, icon: Icon }) => {
            const active = activeTab === to;
            return (
              <NavLink
                key={to || "code"}
                to={to ? `${base}/${to}` : base}
                end={!to}
                data-active={active}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-1.5 px-3 text-[0.8125rem] font-medium transition-colors",
                  active ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {t(labelKey)}
              </NavLink>
            );
          })}
        </div>

        <div key={activeTab} data-enter="support" className="mt-4 flex min-h-0 flex-1 animate-fade flex-col">
          <Outlet />
        </div>
      </div>
    </ProjectContext.Provider>
  );
}
