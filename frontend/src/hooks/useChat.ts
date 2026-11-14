import { useCallback, useEffect, useRef, useState } from "react";
import {
  chatApi,
  streamChat,
  type ChatRequest,
  type ConversationSummary,
  type MessageResponse,
  type SourceRef,
} from "../api/chat";
import { toApiError, type ApiError } from "../api/errors";

export type ChatRole = "user" | "assistant";
export type ChatMessageStatus = "streaming" | "done" | "stopped" | "error";

/** One bubble on the screen. */
export interface ChatUiMessage {
  id: string;
  role: ChatRole;
  content: string;
  sources: SourceRef[];
  status: ChatMessageStatus;
  /** ISO time; local messages get the client's clock until the server version is loaded. */
  createdAt: string;
  /** Who wrote an assistant answer, e.g. "qwen2.5-coder:7b". */
  model: string | null;
  /** Error sent INSIDE the stream ("error" event), e.g. "This project is not indexed yet". */
  errorText: string | null;
  /** Error BEFORE the stream started (network, 401, 500…) — the UI translates it. */
  apiError: ApiError | null;
}

const SEARCH_DEBOUNCE_MS = 250;

let localCounter = 0;
const localId = () => `local-${++localCounter}`;
const now = () => new Date().toISOString();

function fromServer(m: MessageResponse): ChatUiMessage {
  return {
    id: `srv-${m.id}`,
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
    sources: m.sources ?? [],
    status: "done",
    createdAt: m.createdAt,
    model: m.model ?? null,
    errorText: null,
    apiError: null,
  };
}

function assistantDraft(): ChatUiMessage {
  return {
    id: localId(),
    role: "assistant",
    content: "",
    sources: [],
    status: "streaming",
    createdAt: now(),
    model: null,
    errorText: null,
    apiError: null,
  };
}

/**
 * Everything the chat page needs for ONE project.
 * Give the page a `key={projectId}` so a different project starts with a fresh state.
 */
export function useChat(projectId: number) {
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [conversationsError, setConversationsError] = useState<ApiError | null>(null);
  const [query, setQuery] = useState("");
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [streaming, setStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null); // the running answer (for Stop)
  const openRequest = useRef(0); // ignores late answers when the user clicks quickly between chats
  const queryRef = useRef(query);
  queryRef.current = query;

  /** Change one bubble without touching the others. */
  const patch = useCallback((id: string, change: (m: ChatUiMessage) => ChatUiMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? change(m) : m)));
  }, []);

  // ---------- sidebar: list / search conversations ----------
  const reloadConversations = useCallback(async () => {
    try {
      setConversations(await chatApi.listConversations(projectId, queryRef.current));
      setConversationsError(null);
    } catch (err) {
      setConversationsError(toApiError(err));
    } finally {
      setConversationsLoaded(true);
    }
  }, [projectId]);

  useEffect(() => {
    const timer = setTimeout(() => void reloadConversations(), query ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [query, reloadConversations]);

  // leaving the page stops a running answer
  useEffect(() => () => abortRef.current?.abort(), []);

  // ---------- streaming core ----------
  const runStream = useCallback(
    async (request: ChatRequest, assistantId: string) => {
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const result = { conversationId: null as number | null };

      try {
        await streamChat(
          request,
          (event) => {
            switch (event.type) {
              case "token":
                patch(assistantId, (m) => ({ ...m, content: m.content + (event.text ?? "") }));
                break;
              case "sources":
                patch(assistantId, (m) => ({ ...m, sources: event.sources ?? [] }));
                break;
              case "error":
                patch(assistantId, (m) => ({ ...m, status: "error", errorText: event.text ?? null }));
                break;
              case "done":
                result.conversationId = event.conversationId;
                patch(assistantId, (m) => ({
                  ...m,
                  model: event.model ?? m.model,
                  status: m.status === "streaming" ? "done" : m.status,
                }));
                break;
            }
          },
          controller.signal,
        );
        // stream ended without "done" (connection closed) → still finish the bubble
        patch(assistantId, (m) => (m.status === "streaming" ? { ...m, status: "done" } : m));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          patch(assistantId, (m) => ({ ...m, status: "stopped" }));
        } else {
          patch(assistantId, (m) => ({ ...m, status: "error", apiError: toApiError(err) }));
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setStreaming(false);
      }

      if (result.conversationId !== null) {
        setConversationId(result.conversationId); // follow-ups continue this chat
        void reloadConversations(); // new / updated chat moves to the top of the sidebar
      }
    },
    [patch, reloadConversations],
  );

  // ---------- actions ----------
  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || streaming) return;
      const draft = assistantDraft();
      setMessages((prev) => [
        ...prev,
        {
          id: localId(),
          role: "user",
          content: question,
          sources: [],
          status: "done",
          createdAt: now(),
          model: null,
          errorText: null,
          apiError: null,
        },
        draft,
      ]);
      await runStream({ projectId, conversationId, message: question }, draft.id);
    },
    [projectId, conversationId, streaming, runStream],
  );

  /**
   * Answer the last question again. With a saved conversation the server replaces its last answer;
   * if the question never reached the server (e.g. network error on a new chat), it is sent again.
   */
  const regenerate = useCallback(async () => {
    if (streaming) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;

    if (conversationId === null) {
      setMessages((prev) =>
        prev.filter((m) => m.id !== lastUser.id && !(m.role === "assistant" && m.status === "error")),
      );
      await send(lastUser.content);
      return;
    }
    const draft = assistantDraft();
    setMessages((prev) => {
      const lastUserIndex = prev.map((m) => m.role).lastIndexOf("user");
      return [...prev.slice(0, lastUserIndex + 1), draft];
    });
    await runStream({ projectId, conversationId, message: "", regenerate: true }, draft.id);
  }, [streaming, messages, conversationId, projectId, runStream, send]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const newConversation = useCallback(() => {
    abortRef.current?.abort();
    openRequest.current++;
    setMessages([]);
    setConversationId(null);
    setLoadingConversation(false);
  }, []);

  const openConversation = useCallback(async (id: number) => {
    abortRef.current?.abort();
    const request = ++openRequest.current;
    setConversationId(id);
    setMessages([]);
    setLoadingConversation(true);
    try {
      const history = await chatApi.getMessages(id);
      if (request === openRequest.current) setMessages(history.map(fromServer));
    } catch (err) {
      if (request === openRequest.current) {
        const error = toApiError(err);
        if (error.status === 404) {
          setConversationId(null); // deleted elsewhere
        } else {
          setMessages([{ ...assistantDraft(), status: "error", apiError: error }]);
        }
      }
    } finally {
      if (request === openRequest.current) setLoadingConversation(false);
    }
  }, []);

  const renameConversation = useCallback(async (id: number, title: string) => {
    const updated = await chatApi.rename(id, title);
    setConversations((list) => list.map((c) => (c.id === id ? updated : c)));
  }, []);

  const deleteConversation = useCallback(
    async (id: number) => {
      await chatApi.remove(id);
      setConversations((list) => list.filter((c) => c.id !== id));
      if (id === conversationId) newConversation();
    },
    [conversationId, newConversation],
  );

  const activeConversation = conversations.find((c) => c.id === conversationId) ?? null;

  return {
    messages,
    conversationId,
    activeConversation,
    conversations,
    conversationsLoaded,
    conversationsError,
    query,
    setQuery,
    loadingConversation,
    streaming,
    send,
    regenerate,
    stop,
    newConversation,
    openConversation,
    renameConversation,
    deleteConversation,
    reloadConversations,
  };
}
