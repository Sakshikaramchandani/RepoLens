import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FolderPlus, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { toApiError } from "../../api/errors";
import type { Project } from "../../api/projects";
import { useApiErrorMessage } from "../../hooks/useApiErrorMessage";
import { useTranslation } from "../../hooks/useTranslation";
import { EASE_OUT, gsap, prefersReducedMotion, useGSAP } from "../../motion/gsap";
import { useProjects } from "../../projects/projectsContext";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Modal } from "../ui/Modal";
import { Skeleton } from "../ui/Skeleton";
import { TextField } from "../ui/TextField";
import { CreateProjectModal, type SourceTab } from "./CreateProjectModal";
import { ProjectCard } from "./ProjectCard";

const SEARCH_FROM = 7; // only big lists need a search box

/**
 * Project grid with search, create and delete. Cards stagger in once, on first load only
 * (30–60 ms steps, first 8 cards) — re-renders and filtering never re-animate.
 */
export function ProjectsSection({ limit, showCreate = true }: { limit?: number; showCreate?: boolean }) {
  const { t } = useTranslation();
  const apiErrorMessage = useApiErrorMessage();
  const [params, setParams] = useSearchParams();
  const { projects, status, error, reload, removeProject } = useProjects();
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const grid = useRef<HTMLUListElement>(null);
  const animated = useRef(false);

  // ?new=repos (back from GitHub sign-in) or ?new=1 opens the create dialog
  const newParam = params.get("new");
  const createOpen = newParam !== null;
  const initialTab: SourceTab | undefined = newParam === "repos" ? "repos" : undefined;
  const openCreate = () => setParams((p) => ({ ...Object.fromEntries(p), new: "1" }));
  const closeCreate = () =>
    setParams((p) => {
      p.delete("new");
      return p;
    });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? projects.filter((p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
      : projects;
    return limit ? list.slice(0, limit) : list;
  }, [projects, query, limit]);

  useGSAP(
    () => {
      if (status !== "ready" || animated.current || !grid.current) return;
      animated.current = true;
      if (prefersReducedMotion()) return;
      const cards = Array.from(grid.current.children).slice(0, 8);
      gsap.from(cards, {
        autoAlpha: 0,
        y: 8,
        duration: 0.4,
        ease: EASE_OUT,
        stagger: { each: 0.045, ease: "power1.in" },
      });
    },
    { dependencies: [status], scope: grid },
  );

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await removeProject(deleting.id);
      toast.success(t("projects.deleted"), { description: deleting.name });
      setDeleting(null);
    } catch (err) {
      toast.error(t("projects.deleteError"), { description: apiErrorMessage(toApiError(err)).detail });
    } finally {
      setDeleteBusy(false);
    }
  };

  const createDialog = (
    <CreateProjectModal
      open={createOpen}
      initialTab={initialTab}
      onClose={closeCreate}
      onProjectChanged={() => void reload()}
      onFinished={(message) => {
        closeCreate();
        toast.success(message);
        void reload();
      }}
    />
  );

  if (status === "loading") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label={t("projects.loading")}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (status === "error" && error) {
    const message = apiErrorMessage(error);
    return (
      <Alert
        tone="error"
        title={t("projects.loadError")}
        action={
          <Button size="sm" variant="secondary" onClick={() => void reload()}>
            {t("projects.retry")}
          </Button>
        }
      >
        {message.title}
      </Alert>
    );
  }

  if (projects.length === 0) {
    return (
      <>
        <div className="rounded-lg border border-dashed border-line-strong">
          <EmptyState
            icon={<FolderPlus className="size-5" aria-hidden="true" />}
            title={t("projects.emptyTitle")}
            body={t("projects.emptyBody")}
            action={
              showCreate ? (
                <Button leftIcon={<Plus className="size-4" aria-hidden="true" />} onClick={openCreate}>
                  {t("projects.emptyCta")}
                </Button>
              ) : undefined
            }
          />
        </div>
        {createDialog}
      </>
    );
  }

  return (
    <>
      {!limit && projects.length >= SEARCH_FROM ? (
        <div className="mb-4 max-w-xs">
          <TextField
            label={t("projects.search")}
            hideLabel
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("projects.search")}
            startAdornment={<Search className="size-4" aria-hidden="true" />}
          />
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-[0.8125rem] text-muted">{t("projects.noMatches", { query })}</p>
      ) : (
        <ul ref={grid} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} onDelete={setDeleting} />
            </li>
          ))}
        </ul>
      )}

      {createDialog}

      <Modal
        open={deleting !== null}
        onClose={() => !deleteBusy && setDeleting(null)}
        dismissible={!deleteBusy}
        title={t("projects.deleteTitle", { name: deleting?.name ?? "" })}
        description={t("projects.deleteBody")}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              {t("create.cancel")}
            </Button>
            <Button variant="danger" loading={deleteBusy} onClick={() => void confirmDelete()}>
              {t("projects.deleteConfirm")}
            </Button>
          </>
        }
      />
    </>
  );
}
