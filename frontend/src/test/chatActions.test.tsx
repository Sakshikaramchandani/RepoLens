import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "../AppProviders";
import type { ChatStreamEvent, ConversationSummary } from "../api/chat";
import { API_BASE_URL } from "../api/contract";
import { ConversationList } from "../components/chat/ConversationList";
import { useChat } from "../hooks/useChat";
import { server } from "../mocks/server";

const conv = (id: number, title: string): ConversationSummary => ({
  id,
  projectId: 5,
  title,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

function renderList(over: Partial<Parameters<typeof ConversationList>[0]> = {}) {
  const props = {
    conversations: [conv(1, "How does login work?"), conv(2, "Where is the DB configured?")],
    loaded: true,
    activeId: 1,
    error: null,
    query: "",
    onQueryChange: vi.fn(),
    disabled: false,
    onSelect: vi.fn(),
    onNew: vi.fn(),
    onRetry: vi.fn(),
    onRename: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  render(
    <AppProviders>
      <MemoryRouter>
        <ConversationList {...props} />
      </MemoryRouter>
    </AppProviders>,
  );
  return props;
}

describe("ConversationList", () => {
  it("renames a conversation in place with Enter (trimmed)", async () => {
    const user = userEvent.setup();
    const props = renderList();
    await user.click(screen.getAllByRole("button", { name: "Rename" })[0]);
    const input = screen.getByLabelText("Conversation title");
    await user.clear(input);
    await user.type(input, "  Login flow  {Enter}");
    await waitFor(() => expect(props.onRename).toHaveBeenCalledWith(1, "Login flow"));
  });

  it("Escape cancels a rename without saving", async () => {
    const user = userEvent.setup();
    const props = renderList();
    await user.click(screen.getAllByRole("button", { name: "Rename" })[0]);
    await user.type(screen.getByLabelText("Conversation title"), "changed{Escape}");
    expect(props.onRename).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Conversation title")).not.toBeInTheDocument();
  });

  it("deletes only after confirming in the dialog", async () => {
    const user = userEvent.setup();
    const props = renderList();
    await user.click(screen.getAllByRole("button", { name: "Delete" })[1]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Where is the DB configured\?/)).toBeInTheDocument();
    expect(props.onDelete).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(props.onDelete).toHaveBeenCalledWith(2));
  });

  it("selecting is blocked while an answer streams", () => {
    renderList({ disabled: true, activeId: 1 });
    expect(screen.getByRole("button", { name: "Where is the DB configured?" })).toBeDisabled();
  });
});

const sse = (...events: Array<Partial<ChatStreamEvent> & { type: ChatStreamEvent["type"] }>) =>
  events
    .map((e) => `data:${JSON.stringify({ text: null, sources: null, conversationId: null, model: null, ...e })}\n\n`)
    .join("");

describe("useChat", () => {
  it("regenerate re-asks the saved conversation with regenerate=true and replaces the answer", async () => {
    const bodies: unknown[] = [];
    let answer = "first";
    server.use(
      http.get(`${API_BASE_URL}/api/projects/5/conversations`, () => HttpResponse.json([])),
      http.post(`${API_BASE_URL}/api/chat`, async ({ request }) => {
        bodies.push(await request.json());
        return new HttpResponse(
          sse(
            { type: "token", text: answer },
            { type: "sources", sources: [] },
            { type: "done", conversationId: 9, model: "qwen2.5-coder:7b" },
          ),
          { headers: { "Content-Type": "text/event-stream" } },
        );
      }),
    );
    const { result } = renderHook(() => useChat(5));

    await act(() => result.current.send("How does login work?"));
    expect(result.current.conversationId).toBe(9);
    expect(result.current.messages.at(-1)).toMatchObject({
      content: "first",
      model: "qwen2.5-coder:7b",
      status: "done",
    });

    answer = "second";
    await act(() => result.current.regenerate());

    expect(bodies[1]).toEqual({ projectId: 5, conversationId: 9, message: "", regenerate: true });
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].content).toBe("second");
  });

  it("shows an in-stream error and keeps the question", async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/projects/5/conversations`, () => HttpResponse.json([])),
      http.post(
        `${API_BASE_URL}/api/chat`,
        () =>
          new HttpResponse(sse({ type: "error", text: "The AI model is busy" }, { type: "done" }), {
            headers: { "Content-Type": "text/event-stream" },
          }),
      ),
    );
    const { result } = renderHook(() => useChat(5));
    await act(() => result.current.send("hi"));
    expect(result.current.messages[0]).toMatchObject({ role: "user", content: "hi" });
    expect(result.current.messages[1]).toMatchObject({ status: "error", errorText: "The AI model is busy" });
  });
});
