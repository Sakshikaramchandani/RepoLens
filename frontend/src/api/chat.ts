import { apiClient, buildAuthHeaderValue, handleUnauthorized } from "./client";
import { API_BASE_URL, AUTH_HEADER_NAME } from "./contract";
import { ApiError, type ApiErrorKind } from "./errors";
import { tokenStorage } from "./tokenStorage";

/* ── Types: same shapes as Apoorv's ChatDtos.java ─────────────────────────── */

/** A citation: AuthService.java lines 42-60. */
export interface SourceRef {
  filePath: string;
  startLine: number;
  endLine: number;
}

/**
 * conversationId null = start a new conversation.
 * regenerate = answer the conversation's last question again (message is ignored).
 */
export interface ChatRequest {
  projectId: number;
  conversationId: number | null;
  message: string;
  regenerate?: boolean;
}

/**
 * One SSE "data:" line of POST /api/chat.
 *  token   → text = next piece of the answer
 *  sources → sources = citations (once, at the end)
 *  done    → conversationId = id of the conversation (stream finished), model = who answered
 *  error   → text = error message (a "done" always follows)
 */
export interface ChatStreamEvent {
  type: "token" | "sources" | "done" | "error";
  text: string | null;
  sources: SourceRef[] | null;
  conversationId: number | null;
  model?: string | null;
}

export interface ConversationSummary {
  id: number;
  projectId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageResponse {
  id: number;
  role: "USER" | "ASSISTANT";
  content: string;
  sources: SourceRef[];
  createdAt: string;
  /** Model that wrote an assistant answer, e.g. "qwen2.5-coder:7b". */
  model: string | null;
}

export const CHAT_ENDPOINTS = {
  chat: "/api/chat",
  conversations: (projectId: number) => `/api/projects/${projectId}/conversations`,
  messages: (conversationId: number) => `/api/conversations/${conversationId}/messages`,
  conversation: (conversationId: number) => `/api/conversations/${conversationId}`,
} as const;

/* ── SSE parsing ───────────────────────────────────────────────────────────── */

/**
 * One SSE event block (the lines between two blank lines) → event, or null if it has no data.
 * Spring writes "data:{json}"; the SSE standard also allows "data: {json}" — both work.
 */
export function parseSseBlock(block: string): ChatStreamEvent | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n");
  if (!data.trim()) return null;
  try {
    return JSON.parse(data) as ChatStreamEvent;
  } catch {
    return null; // a broken line must not kill the whole answer
  }
}

function kindFromStatus(status: number): ApiErrorKind {
  if (status === 400 || status === 422) return "validation";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 409) return "conflict";
  if (status >= 500) return "server";
  return "unknown";
}

/* ── API calls ─────────────────────────────────────────────────────────────── */

/**
 * Sends a question and calls onEvent for every streamed event, as it arrives.
 * Uses fetch + ReadableStream (NOT EventSource: it cannot send the JWT header).
 * Pass an AbortSignal to stop the answer half-way ("Stop" button / leaving the page).
 */
export async function streamChat(
  request: ChatRequest,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  const token = tokenStorage.get();
  if (token) headers[AUTH_HEADER_NAME] = buildAuthHeaderValue(token);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${CHAT_ENDPOINTS.chat}`, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("network");
  }

  if (!response.ok) {
    if (response.status === 401) handleUnauthorized(); // same as Axios: expired login → logout
    let message: string | undefined;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "message" in body) {
        message = String((body as { message: unknown }).message);
      }
    } catch {
      // body was not JSON — keep the generic message
    }
    throw new ApiError(kindFromStatus(response.status), response.status, message);
  }
  if (!response.body) throw new ApiError("unknown");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // every complete event ends with a blank line; keep the unfinished rest in the buffer
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const event = parseSseBlock(block);
      if (event) onEvent(event);
    }
  }

  buffer += decoder.decode();
  const last = parseSseBlock(buffer);
  if (last) onEvent(last);
}

export const chatApi = {
  /** query = search titles and message text (server side). */
  async listConversations(projectId: number, query?: string): Promise<ConversationSummary[]> {
    const { data } = await apiClient.get<ConversationSummary[]>(CHAT_ENDPOINTS.conversations(projectId), {
      params: query?.trim() ? { q: query.trim() } : undefined,
    });
    return data;
  },

  async getMessages(conversationId: number): Promise<MessageResponse[]> {
    const { data } = await apiClient.get<MessageResponse[]>(CHAT_ENDPOINTS.messages(conversationId));
    return data;
  },

  async rename(conversationId: number, title: string): Promise<ConversationSummary> {
    const { data } = await apiClient.patch<ConversationSummary>(CHAT_ENDPOINTS.conversation(conversationId), { title });
    return data;
  },

  async remove(conversationId: number): Promise<void> {
    await apiClient.delete(CHAT_ENDPOINTS.conversation(conversationId));
  },
};
