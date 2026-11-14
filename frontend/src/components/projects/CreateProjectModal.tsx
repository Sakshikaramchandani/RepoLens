import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { FileArchive, Github, Link2, type LucideIcon } from "lucide-react";
import { githubApi, type GithubConnection } from "../../api/github";
import { useSlidingIndicator } from "../../hooks/useSlidingIndicator";
import { useTranslation } from "../../hooks/useTranslation";
import type { TranslationKey } from "../../i18n/locales/en";
import { cn } from "../ui/cn";
import { Modal } from "../ui/Modal";
import { GithubImportForm } from "./GithubImportForm";
import { GithubRepoPicker } from "./GithubRepoPicker";
import { ZipUploadForm } from "./ZipUploadForm";

export type SourceTab = "repos" | "github" | "zip";

const TABS: ReadonlyArray<{ id: SourceTab; icon: LucideIcon; labelKey: TranslationKey }> = [
  { id: "repos", icon: Github, labelKey: "create.tabRepos" },
  { id: "github", icon: Link2, labelKey: "create.tabGithub" },
  { id: "zip", icon: FileArchive, labelKey: "create.tabZip" },
];

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful import with a translated success message. */
  onFinished: (message: string) => void;
  /** Called whenever the list should refresh (e.g. project created but import failed). */
  onProjectChanged: () => void;
  /** Force a starting tab (e.g. coming back from GitHub sign-in). */
  initialTab?: SourceTab;
}

export function CreateProjectModal({
  open,
  onClose,
  onFinished,
  onProjectChanged,
  initialTab,
}: CreateProjectModalProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SourceTab>(initialTab ?? "github");
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<GithubConnection | null>(null);
  const baseId = useId();
  const tabsRef = useRef<HTMLDivElement>(null);
  const indicator = useSlidingIndicator(tabsRef, [tab, open]);

  // Connected accounts start on "My repositories"; everyone else on the URL form
  useEffect(() => {
    if (!open) return;
    let active = true;
    githubApi
      .connection()
      .then((c) => {
        if (!active) return;
        setConnection(c);
        if (!initialTab && c.connected) setTab("repos");
      })
      .catch(
        () => active && setConnection({ enabled: false, connected: false, login: null, avatarUrl: null, scopes: null }),
      );
    return () => {
      active = false;
    };
  }, [open, initialTab]);

  const close = () => {
    if (!busy) onClose();
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const index = TABS.findIndex((x) => x.id === tab);
    const next = TABS[(index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length].id;
    setTab(next);
    document.getElementById(`${baseId}-${next}-tab`)?.focus();
  };

  const formProps = { onBusyChange: setBusy, onFinished, onProjectChanged, onCancel: close };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t("create.title")}
      description={t("create.subtitle")}
      size="lg"
      dismissible={!busy}
      bodyClassName="mt-5"
    >
      <div
        ref={tabsRef}
        role="tablist"
        aria-label={t("create.sourceLabel")}
        className="relative flex gap-1 border-b border-line"
      >
        {indicator ? (
          <span
            aria-hidden="true"
            className="absolute bottom-[-1px] left-0 h-0.5 rounded-full bg-ink transition-[transform,width] duration-[260ms] ease-[var(--ease-out)]"
            style={{ transform: `translateX(${indicator.x}px)`, width: indicator.w }}
          />
        ) : null}
        {TABS.map(({ id, icon: Icon, labelKey }) => {
          const selected = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${baseId}-${id}-tab`}
              aria-selected={selected}
              aria-controls={`${baseId}-${id}-panel`}
              tabIndex={selected ? 0 : -1}
              data-active={selected}
              disabled={busy}
              onClick={() => setTab(id)}
              onKeyDown={onTabKeyDown}
              className={cn(
                "flex h-9 items-center gap-1.5 px-2.5 text-[0.8125rem] font-medium transition-colors disabled:opacity-50",
                selected ? "text-ink" : "text-muted hover:text-ink",
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {t(labelKey)}
            </button>
          );
        })}
      </div>

      <div
        key={tab}
        role="tabpanel"
        id={`${baseId}-${tab}-panel`}
        aria-labelledby={`${baseId}-${tab}-tab`}
        className="mt-5 animate-fade"
      >
        {tab === "repos" ? (
          <GithubRepoPicker {...formProps} connection={connection} />
        ) : tab === "github" ? (
          <GithubImportForm {...formProps} />
        ) : (
          <ZipUploadForm {...formProps} />
        )}
      </div>
    </Modal>
  );
}
