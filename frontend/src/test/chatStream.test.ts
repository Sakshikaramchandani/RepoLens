import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { parseSseBlock, streamChat, type ChatStreamEvent } from "../api/chat";
import { API_BASE_URL } from "../api/contract";
import { ApiError } from "../api/errors";
import { tokenStorage } from "../api/tokenStorage";
import { server } from "../mocks/server";

const chatUrl = `${API_BASE_URL}/api/chat`;

/** Builds an SSE body exactly like Apoorv's backend: "data:{json}" + blank line per event. */
const sse = (...events: ChatStreamEvent[]) => events.map((e) => `data:${JSON.stringify(e)}\n\n`).join("");
const ev = (type: ChatStreamEvent["type"], fields: Partial<ChatStreamEvent> = {}): ChatStreamEvent => ({
  type,
  text: null,
  sources: null,
  conversationId: null,
  ...fields,
});

describe("parseSseBlock", () => {
  it('reads the Spring format "data:{json}"', () => {
    expect(parseSseBlock('data:{"type":"token","text":"Hi","sources":null,"conversationId":null}')).toEqual(
      ev("token", { text: "Hi" }),
    );
  });

  it('also accepts "data: {json}" with a space and Windows line endings', () => {
    expect(
      parseSseBlock('event:message\r\ndata: {"type":"done","text":null,"sources":null,"conversationId":3}'),
    ).toEqual(ev("done", { conversationId: 3 }));
  });

  it("ignores blocks without data and broken JSON instead of crashing", () => {
    expect(parseSseBlock(": keep-alive")).toBeNull();
    expect(parseSseBlock("")).toBeNull();
    expect(parseSseBlock("data:{oops")).toBeNull();
  });
});

describe("streamChat", () => {
  it("delivers token → sources → done in order and sends the JWT + body", async () => {
    tokenStorage.set("test-jwt");
    let auth: string | null = null;
    let body: unknown = null;

    server.use(
      http.post(chatUrl, async ({ request }) => {
        auth = request.headers.get("Authorization");
        body = await request.json();
        return new HttpResponse(
          sse(
            ev("token", { text: "Hello" }),
            ev("token", { text: " world" }),
            ev("sources", {
              sources: [{ filePath: "src/A.java", startLine: 1, endLine: 9 }],
            }),
            ev("done", { conversationId: 7 }),
          ),
          { headers: { "Content-Type": "text/event-stream" } },
        );
      }),
    );

    const events: ChatStreamEvent[] = [];
    await streamChat({ projectId: 5, conversationId: null, message: "hi" }, (e) => events.push(e));

    expect(events.map((e) => e.type)).toEqual(["token", "token", "sources", "done"]);
    expect(
      events
        .filter((e) => e.type === "token")
        .map((e) => e.text)
        .join(""),
    ).toBe("Hello world");
    expect(events[2].sources?.[0].filePath).toBe("src/A.java");
    expect(events[3].conversationId).toBe(7);
    expect(auth).toBe("Bearer test-jwt");
    expect(body).toEqual({ projectId: 5, conversationId: null, message: "hi" });
  });

  it('passes an "error" event from the backend through (then done)', async () => {
    server.use(
      http.post(
        chatUrl,
        () =>
          new HttpResponse(sse(ev("error", { text: "This project is not indexed yet" }), ev("done")), {
            headers: { "Content-Type": "text/event-stream" },
          }),
      ),
    );
    const events: ChatStreamEvent[] = [];
    await streamChat({ projectId: 5, conversationId: null, message: "hi" }, (e) => events.push(e));
    expect(events.map((e) => e.type)).toEqual(["error", "done"]);
    expect(events[0].text).toBe("This project is not indexed yet");
  });

  it("turns 401 into an unauthorized ApiError and logs the user out", async () => {
    tokenStorage.set("expired-jwt");
    server.use(http.post(chatUrl, () => HttpResponse.json({ message: "Unauthorized" }, { status: 401 })));

    const error = await streamChat({ projectId: 5, conversationId: null, message: "hi" }, () => {}).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe("unauthorized");
    expect(tokenStorage.get()).toBeNull();
  });
});
