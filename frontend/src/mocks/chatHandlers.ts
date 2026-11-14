import { delay, http, HttpResponse } from "msw";
import type { ChatRequest, ConversationSummary, MessageResponse, SourceRef } from "../api/chat";
import { API_BASE_URL } from "../api/contract";
import { currentUser, readJson } from "./projectHandlers";
import { mockProjects } from "./projectsDb";

/**
 * Mock chat: answers are built in the browser from the project's own files (keyword match →
 * cited excerpts) and streamed token by token like the real SSE endpoint. Nothing calls a model;
 * every answer says so.
 */
const url = (path: string) => `${API_BASE_URL}${path}`;
const testing = import.meta.env.MODE === "test";
const STORAGE_KEY = "repolens.mock.chats";
const NOT_FOUND = "I could not find this in the indexed code.";
const MODEL = "mock-model";

interface StoredConversation extends ConversationSummary {
  ownerEmail: string;
}
interface StoredMessage extends MessageResponse {
  conversationId: number;
}
interface ChatStore {
  conversations: StoredConversation[];
  messages: StoredMessage[];
  nextId: number;
}

function load(): ChatStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ChatStore;
  } catch {
    /* ignore */
  }
  return { conversations: [], messages: [], nextId: 1 };
}

function save(store: ChatStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

const now = () => new Date().toISOString();
const fileName = (path: string) => path.substring(path.lastIndexOf("/") + 1);
const STOP = new Set([
  "the",
  "and",
  "how",
  "what",
  "where",
  "which",
  "does",
  "this",
  "that",
  "with",
  "from",
  "are",
  "is",
]);

/** Simulated answer: the files that mention the question's words, with cited excerpts. */
function answer(email: string, projectId: number, question: string): { text: string; sources: SourceRef[] } {
  const files = mockProjects.files(email, projectId) ?? [];
  const words = question
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
  const scored = files
    .map((f) => {
      const lower = (f.path + "\n" + f.content).toLowerCase();
      return { file: f, score: words.reduce((n, w) => n + (lower.split(w).length - 1), 0) };
    })
    .filter((s) => s.score > 0 && !/(^|\/)(src\/test|tests?)\//.test(s.file.path))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (scored.length === 0) return { text: NOT_FOUND, sources: [] };

  const sources: SourceRef[] = [];
  const parts: string[] = ["_Mock mode — this answer is simulated in your browser; no AI model ran._", ""];
  for (const { file } of scored) {
    const lines = file.content.split("\n");
    const hit = Math.max(
      0,
      lines.findIndex((l) => words.some((w) => l.toLowerCase().includes(w))),
    );
    const start = Math.max(1, hit + 1 - 2);
    const end = Math.min(lines.length, start + 14);
    sources.push({ filePath: file.path, startLine: start, endLine: end });
    parts.push(
      `- **${fileName(file.path)}** is relevant here — see lines ${start}–${end} [${fileName(file.path)}:${start}-${end}].`,
    );
  }
  const first = scored[0].file;
  const s = sources[0];
  const ext = first.path.split(".").pop() ?? "";
  parts.push(
    "",
    "```" + ext,
    first.content
      .split("\n")
      .slice(s.startLine - 1, s.endLine)
      .join("\n"),
    "```",
  );
  return { text: parts.join("\n"), sources };
}

function sse(events: Array<Record<string, unknown>>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const event of events) {
        if (!testing && event.type === "token") await delay(18);
        controller.enqueue(
          encoder.encode(
            `data:${JSON.stringify({ text: null, sources: null, conversationId: null, model: null, ...event })}\n\n`,
          ),
        );
      }
      controller.close();
    },
  });
}

const streamResponse = (events: Array<Record<string, unknown>>) =>
  new HttpResponse(sse(events), { headers: { "Content-Type": "text/event-stream" } });

function owned(store: ChatStore, email: string, id: number) {
  return store.conversations.find((c) => c.id === id && c.ownerEmail === email);
}

export const chatHandlers = [
  http.post(url("/api/chat"), async ({ request }) => {
    const email = currentUser(request);
    if (!email) return HttpResponse.json({ message: "Unauthorized - login required" }, { status: 401 });
    const body = await readJson<ChatRequest>(request);
    const projectId = Number(body.projectId);
    if (!projectId || !mockProjects.find(email, projectId)) {
      return streamResponse([{ type: "error", text: "Project not found" }, { type: "done" }]);
    }

    const store = load();
    let conversation = body.conversationId ? owned(store, email, Number(body.conversationId)) : undefined;
    let question: string;

    if (body.regenerate) {
      if (!conversation) return streamResponse([{ type: "error", text: "Conversation not found" }, { type: "done" }]);
      const own = store.messages.filter((m) => m.conversationId === conversation!.id);
      const lastUser = [...own].reverse().find((m) => m.role === "USER");
      if (!lastUser)
        return streamResponse([{ type: "error", text: "There is no question to regenerate" }, { type: "done" }]);
      store.messages = store.messages.filter((m) => !(m.conversationId === conversation!.id && m.id > lastUser.id));
      question = lastUser.content;
    } else {
      question = (body.message ?? "").trim();
      if (!question) return streamResponse([{ type: "error", text: "Message is required" }, { type: "done" }]);
      if (!conversation) {
        conversation = {
          id: store.nextId++,
          projectId,
          ownerEmail: email,
          title: question.length > 60 ? question.slice(0, 60) + "…" : question,
          createdAt: now(),
          updatedAt: now(),
        };
        store.conversations.push(conversation);
      }
      store.messages.push({
        id: store.nextId++,
        conversationId: conversation.id,
        role: "USER",
        content: question,
        sources: [],
        createdAt: now(),
        model: null,
      });
    }

    const { text, sources } = answer(email, projectId, question);
    store.messages.push({
      id: store.nextId++,
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: text,
      sources,
      createdAt: now(),
      model: text === NOT_FOUND ? null : MODEL,
    });
    conversation.updatedAt = now();
    save(store);

    const tokens = text.match(/\S+\s*|\s+/g) ?? [text];
    return streamResponse([
      ...tokens.map((t) => ({ type: "token", text: t })),
      { type: "sources", sources },
      { type: "done", conversationId: conversation.id, model: text === NOT_FOUND ? null : MODEL },
    ]);
  }),

  http.get(url("/api/projects/:id/conversations"), ({ request, params }) => {
    const email = currentUser(request);
    if (!email) return HttpResponse.json({ message: "Unauthorized - login required" }, { status: 401 });
    const projectId = Number(params.id);
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();
    const store = load();
    const list = store.conversations
      .filter((c) => c.ownerEmail === email && c.projectId === projectId)
      .filter(
        (c) =>
          !q ||
          c.title.toLowerCase().includes(q) ||
          store.messages.some((m) => m.conversationId === c.id && m.content.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(({ ownerEmail: _owner, ...summary }) => summary);
    return HttpResponse.json(list);
  }),

  http.get(url("/api/conversations/:id/messages"), ({ request, params }) => {
    const email = currentUser(request);
    if (!email) return HttpResponse.json({ message: "Unauthorized - login required" }, { status: 401 });
    const store = load();
    const conversation = owned(store, email, Number(params.id));
    if (!conversation) return HttpResponse.json({ message: "Conversation not found" }, { status: 404 });
    return HttpResponse.json(
      store.messages
        .filter((m) => m.conversationId === conversation.id)
        .map(({ conversationId: _c, ...message }) => message),
    );
  }),

  http.patch(url("/api/conversations/:id"), async ({ request, params }) => {
    const email = currentUser(request);
    if (!email) return HttpResponse.json({ message: "Unauthorized - login required" }, { status: 401 });
    const store = load();
    const conversation = owned(store, email, Number(params.id));
    if (!conversation) return HttpResponse.json({ message: "Conversation not found" }, { status: 404 });
    const title = ((await readJson<{ title: string }>(request)).title ?? "").replace(/\s+/g, " ").trim();
    if (!title) return HttpResponse.json({ message: "Title is required" }, { status: 400 });
    conversation.title = title.slice(0, 200);
    conversation.updatedAt = now();
    save(store);
    const { ownerEmail: _owner, ...summary } = conversation;
    return HttpResponse.json(summary);
  }),

  http.delete(url("/api/conversations/:id"), ({ request, params }) => {
    const email = currentUser(request);
    if (!email) return HttpResponse.json({ message: "Unauthorized - login required" }, { status: 401 });
    const store = load();
    const conversation = owned(store, email, Number(params.id));
    if (!conversation) return HttpResponse.json({ message: "Conversation not found" }, { status: 404 });
    store.conversations = store.conversations.filter((c) => c.id !== conversation.id);
    store.messages = store.messages.filter((m) => m.conversationId !== conversation.id);
    save(store);
    return new HttpResponse(null, { status: 204 });
  }),
];
