import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, FileCode2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { SourceRef } from "../../api/chat";
import { useApiErrorMessage } from "../../hooks/useApiErrorMessage";
import type { ChatUiMessage } from "../../hooks/useChat";
import { useTranslation } from "../../hooks/useTranslation";
import { Alert } from "../ui/Alert";
import { Button, IconButton } from "../ui/Button";
import { cn } from "../ui/cn";
import { formatTime } from "../../lib/format";
import { MarkdownAnswer } from "./MarkdownAnswer";

/** PromptBuilder.NOT_FOUND_ANSWER — sources are not relevant for this answer. */
const NOT_FOUND_ANSWER = "I could not find this in the indexed code.";

/** Broad answers can cite 20+ chunks; show the first few, the rest on request. */
const SOURCES_SHOWN = 8;

const fileName = (path: string) => path.substring(path.lastIndexOf("/") + 1);

interface MessageBubbleProps {
  message: ChatUiMessage;
  /** Source → code URL (/projects/5?file=11&line=42), or null if the file is unknown. */
  citationHref: (source: SourceRef) => string | null;
  /** Shown on the last answer only. */
  onRegenerate?: () => void;
  isLast?: boolean;
  busy?: boolean;
}

export function MessageBubble({ message, citationHref, onRegenerate, isLast, busy }: MessageBubbleProps) {
  const { t } = useTranslation();
  const apiErrorMessage = useApiErrorMessage();
  const [copied, setCopied] = useState(false);
  const [showAllSources, setShowAllSources] = useState(false);

  if (message.role === "user") {
    return (
      <div className="group rl-enter flex flex-col items-end">
        <div className="max-w-[85%] rounded-xl rounded-br-sm bg-primary px-3.5 py-2 text-[0.875rem] leading-relaxed break-words whitespace-pre-wrap text-on-primary">
          {message.content}
        </div>
        <time
          dateTime={message.createdAt}
          className="mt-1 px-1 text-[0.6875rem] text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        >
          {formatTime(message.createdAt)}
        </time>
      </div>
    );
  }

  /** "AuthController.java:42-60" (or ":42") in the answer text → the matching source → code URL. */
  const citationLink = (label: string): string | null => {
    const m = /^(.+):(\d+)(?:-(\d+))?$/.exec(label);
    if (!m) return null;
    const [, name, start, end = start] = m;
    const source =
      message.sources.find(
        (s) => fileName(s.filePath) === name && s.startLine === Number(start) && s.endLine === Number(end),
      ) ?? message.sources.find((s) => fileName(s.filePath) === name);
    return source ? citationHref({ ...source, startLine: Number(start), endLine: Number(end) }) : null;
  };

  const streaming = message.status === "streaming";
  const waiting = streaming && message.content === "";
  const requestError = message.apiError ? apiErrorMessage(message.apiError) : null;
  const notFound = message.content.trim() === NOT_FOUND_ANSWER;
  const showSources = message.sources.length > 0 && message.status === "done" && !notFound;
  const canAct = !streaming && message.content.length > 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success(t("chat.copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("chat.actionError"));
    }
  };

  return (
    <div className="group rl-enter flex gap-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
        <Sparkles className="size-3.5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[0.8125rem] font-medium text-ink">{t("chat.assistant")}</span>
          {message.model ? (
            <span className="rounded-sm border border-line px-1 font-mono text-[0.625rem] leading-4 text-faint">
              {t("chat.answeredBy", { model: message.model })}
            </span>
          ) : null}
          <time dateTime={message.createdAt} className="text-[0.6875rem] text-faint">
            {formatTime(message.createdAt)}
          </time>
        </div>

        {waiting ? (
          <p className="flex items-center gap-2 py-1 text-[0.8125rem] text-muted" role="status">
            <span className="rl-typing" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            {t("chat.thinking")}
          </p>
        ) : null}

        {message.content ? (
          <div aria-live={streaming ? "polite" : undefined} aria-busy={streaming || undefined}>
            <MarkdownAnswer text={message.content} citationLink={citationLink} />
            {streaming ? <span className="rl-caret" aria-hidden="true" /> : null}
          </div>
        ) : null}

        {message.status === "stopped" ? <p className="mt-2 text-[0.75rem] text-muted">{t("chat.stopped")}</p> : null}

        {message.status === "error" ? (
          <Alert
            tone="error"
            title={message.errorText ?? requestError?.title ?? t("chat.error")}
            className="mt-2"
            action={
              onRegenerate && isLast ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onRegenerate}
                  disabled={busy}
                  leftIcon={<RotateCcw className="size-3.5" aria-hidden="true" />}
                >
                  {t("chat.retry")}
                </Button>
              ) : undefined
            }
          >
            {requestError?.detail}
          </Alert>
        ) : null}

        {showSources ? (
          <div className="mt-3">
            <p className="mb-1.5 text-[0.6875rem] font-medium tracking-wide text-faint uppercase">
              {t("chat.sources")}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {(showAllSources ? message.sources : message.sources.slice(0, SOURCES_SHOWN)).map((s, i) => {
                const label = `${fileName(s.filePath)}:${s.startLine}-${s.endLine}`;
                const href = citationHref(s);
                const chip =
                  "inline-flex h-6 items-center gap-1 rounded-sm border border-line bg-surface px-1.5 font-mono text-[0.6875rem]";
                return (
                  <li
                    key={`${s.filePath}:${s.startLine}-${s.endLine}`}
                    className="animate-[fade_240ms_ease-out_both]"
                    style={{ animationDelay: `${Math.min(i, 5) * 40}ms` }}
                  >
                    {href ? (
                      <Link
                        to={href}
                        title={t("chat.openCitation", { file: s.filePath, line: s.startLine })}
                        className={`${chip} rl-press text-ink-2 hover:border-accent/60 hover:text-ink`}
                      >
                        <FileCode2 className="size-3 text-accent" aria-hidden="true" />
                        {label}
                      </Link>
                    ) : (
                      <span title={t("chat.citationMissing")} className={`${chip} cursor-not-allowed text-faint`}>
                        <FileCode2 className="size-3" aria-hidden="true" />
                        {label}
                      </span>
                    )}
                  </li>
                );
              })}
              {message.sources.length > SOURCES_SHOWN ? (
                <li>
                  <button
                    type="button"
                    onClick={() => setShowAllSources((v) => !v)}
                    aria-expanded={showAllSources}
                    className="rl-press inline-flex h-6 items-center rounded-sm px-1.5 text-[0.6875rem] font-medium text-muted hover:bg-surface-2 hover:text-ink"
                  >
                    {showAllSources
                      ? t("chat.fewerSources")
                      : t("chat.moreSources", { count: message.sources.length - SOURCES_SHOWN })}
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {canAct ? (
          <div
            className={cn(
              "mt-2 -ml-1.5 flex items-center gap-0.5 transition-opacity duration-150",
              isLast ? "opacity-100" : "rl-hover-only opacity-0 group-hover:opacity-100 focus-within:opacity-100",
            )}
          >
            <IconButton label={copied ? t("chat.copied") : t("chat.copy")} size="sm" onClick={() => void copy()}>
              {copied ? (
                <Check className="size-3.5 text-success" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
            </IconButton>
            {isLast && onRegenerate ? (
              <IconButton label={t("chat.regenerate")} size="sm" onClick={onRegenerate} disabled={busy}>
                <RotateCcw className="size-3.5" aria-hidden="true" />
              </IconButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
