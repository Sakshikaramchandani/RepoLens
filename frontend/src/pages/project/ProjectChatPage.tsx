import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, DatabaseZap, MessageSquarePlus, MessagesSquare, PanelLeft, PanelLeftClose, X } from "lucide-react";
import type { SourceRef } from "../../api/chat";
import { isIndexing } from "../../api/indexing";
import { ChatInput, type ChatInputHandle } from "../../components/chat/ChatInput";
import { ConversationList } from "../../components/chat/ConversationList";
import { MessageBubble } from "../../components/chat/MessageBubble";
import { Button, IconButton } from "../../components/ui/Button";
import { cn } from "../../components/ui/cn";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useChat } from "../../hooks/useChat";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useTranslation } from "../../hooks/useTranslation";
import { useProject } from "../../projects/ProjectContext";

/** Within this many px of the bottom counts as "reading the latest" → keep following the answer. */
const STICK_THRESHOLD = 96;
const HISTORY_KEY = "repolens.chat.historyOpen";

function readHistoryOpen(): boolean {
  try {
    return localStorage.getItem(HISTORY_KEY) !== "false";
  } catch {
    return true;
  }
}

export function ProjectChatPage() {
  const { projectId } = useProject();
  return <ChatView key={projectId} />;
}

function ChatView() {
  const { t } = useTranslation();
  const { projectId, fileIdByPath, indexing } = useProject();
  const chat = useChat(projectId);
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<ChatInputHandle>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(readHistoryOpen);
  const wide = useMediaQuery("(min-width: 1024px)");
  const lastChatKey = `repolens.chat.lastConversation.${projectId}`;

  const job = indexing.state.phase === "job" ? indexing.state.job : null;
  const neverIndexed = indexing.state.phase === "never";
  const indexBusy = isIndexing(job?.status);
  const chatBlocked = neverIndexed || indexBusy || job?.status === "FAILED";

  const citationHref = useCallback(
    (source: SourceRef): string | null => {
      const fileId = fileIdByPath.get(source.filePath);
      return fileId === undefined ? null : `/projects/${projectId}?file=${fileId}&line=${source.startLine}`;
    },
    [fileIdByPath, projectId],
  );

  // back from a citation → reopen the conversation you were in (this tab only)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(lastChatKey);
      if (saved) void chat.openConversation(Number(saved));
    } catch {
      /* storage blocked → start empty */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (chat.conversationId !== null) sessionStorage.setItem(lastChatKey, String(chat.conversationId));
      else sessionStorage.removeItem(lastChatKey);
    } catch {
      /* ignore */
    }
  }, [chat.conversationId, lastChatKey]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // follow the streaming answer only while the reader is at the bottom
  useLayoutEffect(() => {
    if (atBottom) scrollToBottom();
  }, [chat.messages, atBottom, scrollToBottom]);

  // a question you just sent always comes into view
  const lastRole = chat.messages[chat.messages.length - 1]?.role;
  const messageCount = chat.messages.length;
  useEffect(() => {
    if (lastRole === "assistant" && chat.streaming) {
      setAtBottom(true);
      scrollToBottom("smooth");
    }
  }, [messageCount, lastRole, chat.streaming, scrollToBottom]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD);
  };

  /** Desktop: show/hide the conversation list beside the chat. Phones: open the drawer. */
  const toggleHistory = () => {
    if (!wide) {
      setDrawerOpen(true);
      return;
    }
    setHistoryOpen((value) => {
      try {
        localStorage.setItem(HISTORY_KEY, String(!value));
      } catch {
        /* ignore */
      }
      return !value;
    });
  };

  const startNew = () => {
    chat.newConversation();
    setDrawerOpen(false);
    requestAnimationFrame(() => composer.current?.focus());
  };

  const open = (id: number) => {
    void chat.openConversation(id);
    setDrawerOpen(false);
    setAtBottom(true);
  };

  const list = (
    <ConversationList
      conversations={chat.conversations}
      loaded={chat.conversationsLoaded}
      activeId={chat.conversationId}
      error={chat.conversationsError}
      query={chat.query}
      onQueryChange={chat.setQuery}
      disabled={chat.streaming}
      onSelect={open}
      onNew={startNew}
      onRetry={() => void chat.reloadConversations()}
      onRename={chat.renameConversation}
      onDelete={chat.deleteConversation}
      className="h-full"
    />
  );

  const examples = [t("chat.example1"), t("chat.example2"), t("chat.example3")];
  const lastAssistantIndex = chat.messages.map((m) => m.role).lastIndexOf("assistant");
  const unanswered = !chat.streaming && chat.messages.length > 0 && lastRole === "user";

  return (
    <div className="flex h-[78dvh] min-h-[28rem] flex-1 gap-4 lg:h-auto lg:min-h-[30rem]">
      {wide && historyOpen ? <div className="w-60 shrink-0 animate-fade">{list}</div> : null}

      {/* phones / tablets: the same list, in a drawer (rendered once — never both) */}
      {wide ? null : (
        <>
          <div
            className={cn(
              "fixed inset-0 z-40 bg-[var(--rl-scrim)] transition-opacity duration-300 lg:hidden",
              drawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("chat.history")}
            className={cn(
              "fixed inset-y-0 left-0 z-50 flex w-[19rem] max-w-[85vw] flex-col bg-canvas p-3 shadow-float transition-[transform,visibility] duration-300 ease-[var(--ease-drawer)] lg:hidden",
              drawerOpen ? "visible translate-x-0" : "invisible -translate-x-full",
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[0.8125rem] font-semibold">{t("chat.history")}</p>
              <IconButton label={t("common.close")} onClick={() => setDrawerOpen(false)}>
                <X className="size-4" aria-hidden="true" />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1">{list}</div>
          </div>
        </>
      )}

      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
          <IconButton
            label={wide && historyOpen ? t("chat.hideConversations") : t("chat.showConversations")}
            size="sm"
            aria-expanded={wide ? historyOpen : drawerOpen}
            onClick={toggleHistory}
          >
            {wide && historyOpen ? (
              <PanelLeftClose className="size-4" aria-hidden="true" />
            ) : (
              <PanelLeft className="size-4" aria-hidden="true" />
            )}
          </IconButton>
          <p className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink">
            {chat.activeConversation?.title ?? t("chat.newChat")}
          </p>
          {wide && !historyOpen ? (
            <IconButton label={t("chat.newChat")} size="sm" onClick={startNew} disabled={chat.streaming}>
              <MessageSquarePlus className="size-4" aria-hidden="true" />
            </IconButton>
          ) : null}
        </div>

        <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8">
            {chat.loadingConversation ? (
              <div className="space-y-6" role="status" aria-label={t("chat.loading")}>
                <Skeleton className="ml-auto h-9 w-2/5" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              </div>
            ) : chat.messages.length === 0 ? (
              chatBlocked ? (
                <EmptyState
                  icon={<DatabaseZap className="size-5" aria-hidden="true" />}
                  title={t("chat.notIndexedTitle")}
                  body={t("chat.notIndexedBody")}
                  action={
                    neverIndexed || job?.status === "FAILED" ? (
                      <Button
                        onClick={() => void indexing.start()}
                        loading={indexing.starting}
                        leftIcon={<DatabaseZap className="size-4" aria-hidden="true" />}
                      >
                        {t("indexing.start")}
                      </Button>
                    ) : (
                      <p className="text-[0.8125rem] text-muted">
                        {t("indexing.running", { processed: job?.processedFiles ?? 0, total: job?.totalFiles ?? 0 })}
                      </p>
                    )
                  }
                />
              ) : (
                <div className="flex flex-col items-center pt-8 text-center sm:pt-16">
                  <span className="grid size-11 place-items-center rounded-lg border border-line bg-surface-2 text-muted">
                    <MessagesSquare className="size-5" aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 text-lg font-semibold">{t("chat.emptyTitle")}</h2>
                  <p className="mt-1 max-w-sm text-[0.8125rem] text-muted">{t("chat.emptyBody")}</p>
                  <ul className="mt-6 flex w-full max-w-md flex-col gap-2">
                    {examples.map((q, i) => (
                      <li
                        key={q}
                        className="animate-[rise_320ms_var(--ease-out)_both]"
                        style={{ animationDelay: `${80 + i * 50}ms` }}
                      >
                        <button
                          type="button"
                          onClick={() => void chat.send(q)}
                          className="rl-press flex w-full items-center justify-between rounded-lg border border-line bg-surface px-3.5 py-2.5 text-left text-[0.8125rem] text-ink-2 hover:border-line-strong hover:bg-surface-2 hover:text-ink"
                        >
                          {q}
                          <ArrowDown className="size-3.5 -rotate-90 text-faint" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            ) : (
              <ol className="space-y-7" aria-label={t("chat.title")}>
                {chat.messages.map((m, i) => (
                  <li key={m.id}>
                    <MessageBubble
                      message={m}
                      citationHref={citationHref}
                      isLast={i === lastAssistantIndex && i === chat.messages.length - 1}
                      busy={chat.streaming}
                      onRegenerate={() => void chat.regenerate()}
                    />
                  </li>
                ))}
                {unanswered ? (
                  <li className="flex items-center gap-3 rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-[0.8125rem] text-muted">
                    <span className="flex-1">{t("chat.unanswered")}</span>
                    <Button size="sm" variant="secondary" onClick={() => void chat.regenerate()} disabled={chatBlocked}>
                      {t("chat.regenerate")}
                    </Button>
                  </li>
                ) : null}
              </ol>
            )}
          </div>
        </div>

        {!atBottom && chat.messages.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setAtBottom(true);
              scrollToBottom("smooth");
            }}
            className="rl-press absolute bottom-28 left-1/2 z-10 inline-flex h-8 -translate-x-1/2 animate-pop items-center gap-1.5 rounded-full bg-surface px-3 text-[0.75rem] font-medium text-ink shadow-pop"
          >
            <ArrowDown className="size-3.5" aria-hidden="true" />
            {t("chat.jumpToLatest")}
          </button>
        ) : null}

        <div className="shrink-0 border-t border-line bg-surface px-3 pt-3 pb-2 sm:px-4">
          <div className="mx-auto max-w-4xl">
            <ChatInput
              ref={composer}
              streaming={chat.streaming}
              disabled={chatBlocked}
              onSend={(text) => void chat.send(text)}
              onStop={chat.stop}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
