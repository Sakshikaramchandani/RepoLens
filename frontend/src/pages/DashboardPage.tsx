import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { AiModelsList } from "../components/ai/AiModelsList";
import { PageHeader } from "../components/layout/PageHeader";
import { ProjectsSection } from "../components/projects/ProjectsSection";
import { useOpenCreateProject } from "../components/projects/useOpenCreateProject";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { useAuth } from "../hooks/useAuth";
import { displayName } from "../lib/user";
import { useTranslation } from "../hooks/useTranslation";
import { useCountUp } from "../motion/useCountUp";
import { useProjects } from "../projects/projectsContext";

function Stat({ label, value }: { label: string; value: number | null }) {
  const shown = useCountUp(value);
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3 shadow-card">
      <p className="text-[0.75rem] text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-[-0.02em] tabular-nums">{shown ?? "–"}</p>
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { projects, status } = useProjects();
  const openCreate = useOpenCreateProject();
  if (!user) return null;

  const name = displayName(user);
  const ready = status === "ready";
  const count = (type: string) => (ready ? projects.filter((p) => p.sourceType === type).length : null);
  const steps = [t("dashboard.start.step1"), t("dashboard.start.step2"), t("dashboard.start.step3")];

  return (
    <div>
      <PageHeader
        title={t("dashboard.greeting", { name })}
        description={t("dashboard.subtitle")}
        actions={
          <Button leftIcon={<Plus className="size-4" aria-hidden="true" />} onClick={openCreate}>
            {t("projects.new")}
          </Button>
        }
      />

      <div data-enter="support" className="grid grid-cols-3 gap-3">
        <Stat label={t("dashboard.stats.projects")} value={ready ? projects.length : null} />
        <Stat label={t("dashboard.stats.github")} value={count("GITHUB")} />
        <Stat label={t("dashboard.stats.zip")} value={count("ZIP")} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section data-enter="support" aria-labelledby="recent-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="recent-heading" className="text-[0.9375rem] font-semibold">
              {t("dashboard.recent")}
            </h2>
            {projects.length > 6 ? (
              <Link
                to="/projects"
                className="group inline-flex items-center gap-1 text-[0.8125rem] text-muted hover:text-ink"
              >
                {t("dashboard.viewAll")}
                <ArrowRight
                  className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            ) : null}
          </div>
          <ProjectsSection limit={6} />
        </section>

        <div data-enter="support" className="space-y-4">
          {ready && projects.length === 0 ? (
            <Card aria-labelledby="start-heading">
              <CardHeader id="start-heading" title={t("dashboard.start.title")} />
              <ol className="space-y-3">
                {steps.map((step, i) => (
                  <li key={step} className="flex gap-3 text-[0.8125rem] text-ink-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full border border-line-strong font-mono text-[0.6875rem] text-muted">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <Button className="mt-5" fullWidth onClick={openCreate}>
                {t("dashboard.start.cta")}
              </Button>
            </Card>
          ) : null}
          <Card aria-labelledby="ai-heading">
            <CardHeader id="ai-heading" title={t("settings.ai")} description={t("settings.aiHint")} />
            <AiModelsList />
          </Card>
        </div>
      </div>
    </div>
  );
}
