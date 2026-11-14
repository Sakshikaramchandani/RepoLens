import { Fragment } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import type { TranslationKey } from "../../i18n/locales/en";
import { useProjects } from "../../projects/projectsContext";

const TAB_KEYS: Record<string, TranslationKey> = {
  chat: "project.tabs.chat",
  review: "project.tabs.review",
  risk: "project.tabs.risk",
};

/** Where am I? — derived from the URL, so it can never disagree with the page. */
export function Breadcrumbs() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { projects } = useProjects();
  const parts = pathname.split("/").filter(Boolean);

  const crumbs: Array<{ label: string; to?: string }> = [];
  if (parts[0] === "dashboard") crumbs.push({ label: t("nav.overview") });
  if (parts[0] === "settings") crumbs.push({ label: t("nav.settings") });
  if (parts[0] === "profile") crumbs.push({ label: t("nav.profile") });
  if (parts[0] === "projects") {
    crumbs.push({ label: t("nav.projects"), to: parts.length > 1 ? "/projects" : undefined });
    if (parts[1]) {
      const project = projects.find((p) => String(p.id) === parts[1]);
      crumbs.push({ label: project?.name ?? "…", to: parts[2] ? `/projects/${parts[1]}` : undefined });
      if (parts[2] && TAB_KEYS[parts[2]]) crumbs.push({ label: t(TAB_KEYS[parts[2]]) });
    }
  }
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-[0.8125rem]">
        {crumbs.map((crumb, i) => (
          <Fragment key={`${crumb.label}-${i}`}>
            {i > 0 ? <ChevronRight className="size-3.5 shrink-0 text-faint" aria-hidden="true" /> : null}
            <li className="min-w-0 truncate">
              {crumb.to ? (
                <Link to={crumb.to} className="text-muted transition-colors hover:text-ink">
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="font-medium text-ink">
                  {crumb.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
