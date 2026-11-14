import { Link } from "react-router-dom";
import { ArrowUpRight, FileArchive, FolderOpen, Github, Trash2, type LucideIcon } from "lucide-react";
import type { Project, SourceType } from "../../api/projects";
import { useTranslation } from "../../hooks/useTranslation";
import type { TranslationKey } from "../../i18n/locales/en";
import { formatDate } from "../../lib/format";
import { Badge, type BadgeTone } from "../ui/Badge";

const SOURCE: Record<SourceType, { icon: LucideIcon; tone: BadgeTone; labelKey: TranslationKey }> = {
  GITHUB: { icon: Github, tone: "neutral", labelKey: "projects.source.github" },
  ZIP: { icon: FileArchive, tone: "neutral", labelKey: "projects.source.zip" },
  NONE: { icon: FolderOpen, tone: "warning", labelKey: "projects.source.none" },
};

/** Whole card is the link (lifts 2px on hover); delete sits above it and appears on hover/focus. */
export function ProjectCard({ project, onDelete }: { project: Project; onDelete: (project: Project) => void }) {
  const { t } = useTranslation();
  const source = SOURCE[project.sourceType] ?? SOURCE.NONE;
  const Icon = source.icon;

  return (
    <article className="group relative flex h-full flex-col rounded-lg border border-line bg-surface p-4 shadow-card transition-[transform,border-color,box-shadow] duration-200 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-ink-2">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onDelete(project)}
            aria-label={t("projects.deleteNamed", { name: project.name })}
            title={t("projects.deleteNamed", { name: project.name })}
            className="rl-press rl-hover-only relative z-10 grid size-8 place-items-center rounded-md text-faint hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
          <ArrowUpRight
            className="size-4 text-faint transition-[transform,color] duration-200 ease-[var(--ease-out)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink"
            aria-hidden="true"
          />
        </div>
      </div>
      <h3 className="mt-3 text-[0.9375rem] font-semibold break-words text-ink">
        <Link to={`/projects/${project.id}`} className="after:absolute after:inset-0 after:rounded-lg">
          {project.name}
        </Link>
      </h3>
      <p className="mt-1 line-clamp-2 text-[0.8125rem] text-muted">
        {project.description || t("projects.noDescription")}
      </p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
        <Badge tone={source.tone}>{t(source.labelKey)}</Badge>
        <span className="text-[0.6875rem] text-faint">
          {t("projects.createdOn", { date: formatDate(project.createdAt) })}
        </span>
      </div>
    </article>
  );
}
