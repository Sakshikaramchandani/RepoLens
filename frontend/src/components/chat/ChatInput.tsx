import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import { cn } from "../ui/cn";

/** Same limit as ChatService.MAX_QUESTION_CHARS. */
export const MAX_QUESTION_CHARS = 2000;
const MAX_HEIGHT = 200;

interface ChatInputProps {
  streaming: boolean;
  disabled?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export interface ChatInputHandle {
  focus: () => void;
}

/**
 * Composer: grows with the text, Enter sends, Shift+Enter breaks the line (IME-safe).
 * While an answer streams, the send button becomes Stop in the same place.
 */
export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { streaming, disabled, onSend, onStop },
  ref,
) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const tooLong = text.length > MAX_QUESTION_CHARS;
  const nearLimit = text.length > MAX_QUESTION_CHARS * 0.85;
  const canSend = text.trim().length > 0 && !tooLong && !streaming && !disabled;

  useImperativeHandle(ref, () => ({ focus: () => area.current?.focus() }), []);

  // auto-grow: reset, then fit content (capped; scrolls beyond)
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);

  const submit = () => {
    if (!canSend) return;
    onSend(text);
    setText("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div
        className={cn(
          "flex items-end gap-2 rounded-xl border bg-surface p-2 pl-3.5 shadow-card transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15",
          tooLong ? "border-danger" : "border-line-strong",
        )}
      >
        <label htmlFor="chat-input" className="sr-only">
          {t("chat.placeholder")}
        </label>
        <textarea
          ref={area}
          id="chat-input"
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t("chat.placeholder")}
          aria-describedby="chat-input-hint"
          className="max-h-[200px] min-h-[1.5rem] flex-1 resize-none self-center bg-transparent py-1 text-[0.875rem] leading-6 text-ink outline-none placeholder:text-faint disabled:cursor-not-allowed"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label={t("chat.stop")}
            title={t("chat.stop")}
            className="rl-press grid size-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink hover:bg-line-strong"
          >
            <Square className="size-3 fill-current" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label={t("chat.send")}
            title={t("chat.send")}
            className="rl-press grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-faint"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <p
        id="chat-input-hint"
        className={cn("mt-1.5 flex justify-between px-1 text-[0.6875rem]", tooLong ? "text-danger" : "text-faint")}
      >
        <span>{tooLong ? t("chat.tooLong", { max: MAX_QUESTION_CHARS }) : t("chat.hint")}</span>
        {nearLimit ? (
          <span className="tabular-nums">
            {text.length} / {MAX_QUESTION_CHARS}
          </span>
        ) : null}
      </p>
    </form>
  );
});
