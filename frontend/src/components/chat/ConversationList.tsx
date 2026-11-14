import { useEffect, useRef, useState } from "react";
import { Check, MessageSquarePlus, Pencil, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { ConversationSummary } from "../../api/chat";
import type { ApiError } from "../../api/errors";
import { useTranslation } from "../../hooks/useTranslation";
import type { TranslationKey } from "../../i18n/locales/en";
import { Button, IconButton } from "../ui/Button";
import { cn } from "../ui/cn";
import { Modal } from "../ui/Modal";
import { Skeleton } from "../ui/Skeleton";
import { TextField } from "../ui/TextField";

interface ConversationListProps {
  conversations: ConversationSummary[];
  loaded: boolean;
  activeId: number | null;
  error: ApiError | null;
  query: string;
  onQueryChange: (query: string) => void;
  /** true while an answer streams — switching chats then would cut the answer. */
  disabled: boolean;
  onSelect: (id: number) => void;
  onNew: () => void;
  onRetry: () => void;
  onRename: (id: number, title: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  className?: string;
}

function bucket(iso: string): TranslationKey {
  const date = new Date(iso);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (date.getTime() >= startOfToday) return "chat.today";
  if (date.getTime() >= startOfToday - 86_400_000) return "chat.yesterday";
  return "chat.earlier";
}

/** Conversations of this project: search, new, rename in place, delete with confirmation. */
export function ConversationList({
  conversations,
  loaded,
  activeId,
  error,
  query,
  onQueryChange,
  disabled,
  onSelect,
  onNew,
  onRetry,
  onRename,
  onDelete,
  className,
}: ConversationListProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [deleting, setDeleting] = useState<ConversationSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const editInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId !== null) editInput.current?.select();
  }, [editingId]);

  const saveRename = async () => {
    const id = editingId;
    const title = draft.trim();
    setEditingId(null);
    if (id === null || !title) return;
    const original = conversations.find((c) => c.id === id)?.title;
    if (title === original) return;
    try {
      await onRename(id, title);
      toast.success(t("chat.renamed"));
    } catch {
      toast.error(t("chat.actionError"));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await onDelete(deleting.id);
      toast.success(t("chat.deleted"));
      setDeleting(null);
    } catch {
      toast.error(t("chat.actionError"));
    } finally {
      setDeleteBusy(false);
    }
  };

  const groups: Array<{ key: TranslationKey; items: ConversationSummary[] }> = [];
  for (const c of conversations) {
    const key = bucket(c.updatedAt ?? c.createdAt);
    const group = groups.find((g) => g.key === key);
    if (group) group.items.push(c);
    else groups.push({ key, items: [c] });
  }

  return (
    <aside className={cn("flex min-h-0 flex-col", className)}>
      <Button
        variant="secondary"
        fullWidth
        onClick={onNew}
        disabled={disabled}
        leftIcon={<MessageSquarePlus className="size-4" aria-hidden="true" />}
      >
        {t("chat.newChat")}
      </Button>

      <div className="mt-3">
        <TextField
          label={t("chat.search")}
          hideLabel
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("chat.search")}
          startAdornment={<Search className="size-3.5" aria-hidden="true" />}
          inputSize="sm"
        />
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="px-1 text-[0.8125rem] text-danger">
            <p>{t("chat.historyError")}</p>
            <button type="button" onClick={onRetry} className="mt-1 underline underline-offset-2">
              {t("common.retry")}
            </button>
          </div>
        ) : !loaded ? (
          <div className="space-y-1.5" aria-label={t("common.loading")} role="status">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-1 text-[0.8125rem] text-faint">
            {query ? t("chat.noResults", { query }) : t("chat.noConversations")}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="mb-3">
              <p className="px-2 pb-1 text-[0.6875rem] font-medium tracking-wide text-faint uppercase">
                {t(group.key)}
              </p>
              <ul className="space-y-px">
                {group.items.map((c) => {
                  const active = c.id === activeId;
                  if (editingId === c.id) {
                    return (
                      <li key={c.id}>
                        <form
                          className="flex items-center gap-1 rounded-md bg-surface-2 p-0.5"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void saveRename();
                          }}
                        >
                          <label htmlFor={`rename-${c.id}`} className="sr-only">
                            {t("chat.renameLabel")}
                          </label>
                          <input
                            id={`rename-${c.id}`}
                            ref={editInput}
                            value={draft}
                            maxLength={200}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            onBlur={() => void saveRename()}
                            className="h-7 min-w-0 flex-1 rounded-sm border border-accent bg-surface px-2 text-[0.8125rem] outline-none"
                          />
                          <IconButton
                            label={t("common.save")}
                            size="sm"
                            type="submit"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            <Check className="size-3.5" aria-hidden="true" />
                          </IconButton>
                          <IconButton
                            label={t("common.cancel")}
                            size="sm"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setEditingId(null)}
                          >
                            <X className="size-3.5" aria-hidden="true" />
                          </IconButton>
                        </form>
                      </li>
                    );
                  }
                  return (
                    <li key={c.id} className="group relative">
                      <button
                        type="button"
                        title={c.title}
                        onClick={() => onSelect(c.id)}
                        disabled={disabled && !active}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "flex h-8 w-full items-center rounded-md pr-14 pl-2 text-left text-[0.8125rem] transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50",
                          active ? "bg-surface-3 font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                        )}
                      >
                        <span className="truncate">{c.title}</span>
                      </button>
                      <div
                        className={cn(
                          "absolute inset-y-0 right-1 flex items-center gap-px transition-opacity duration-100 focus-within:opacity-100",
                          active ? "opacity-100" : "rl-hover-only opacity-0 group-hover:opacity-100",
                        )}
                      >
                        <IconButton
                          label={t("chat.rename")}
                          size="sm"
                          className="size-6"
                          disabled={disabled}
                          onClick={() => {
                            setDraft(c.title);
                            setEditingId(c.id);
                          }}
                        >
                          <Pencil className="size-3" aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          label={t("chat.delete")}
                          size="sm"
                          tone="danger"
                          className="size-6"
                          disabled={disabled}
                          onClick={() => setDeleting(c)}
                        >
                          <Trash2 className="size-3" aria-hidden="true" />
                        </IconButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      <Modal
        open={deleting !== null}
        onClose={() => !deleteBusy && setDeleting(null)}
        dismissible={!deleteBusy}
        title={t("chat.deleteTitle")}
        description={t("chat.deleteBody", { title: deleting?.title ?? "" })}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" loading={deleteBusy} onClick={() => void confirmDelete()}>
              {t("chat.delete")}
            </Button>
          </>
        }
      />
    </aside>
  );
}
