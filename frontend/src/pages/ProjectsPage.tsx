import { Plus } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { ProjectsSection } from "../components/projects/ProjectsSection";
import { useOpenCreateProject } from "../components/projects/useOpenCreateProject";
import { Button } from "../components/ui/Button";
import { useTranslation } from "../hooks/useTranslation";

export function ProjectsPage() {
  const { t } = useTranslation();
  const openCreate = useOpenCreateProject();
  return (
    <div>
      <PageHeader
        title={t("projects.title")}
        description={t("projects.subtitle")}
        actions={
          <Button leftIcon={<Plus className="size-4" aria-hidden="true" />} onClick={openCreate}>
            {t("projects.new")}
          </Button>
        }
      />
      <div data-enter="support">
        <ProjectsSection />
      </div>
    </div>
  );
}
