import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../AppProviders";
import type { SourceRef } from "../api/chat";
import { MessageBubble } from "../components/chat/MessageBubble";
import type { ChatUiMessage } from "../hooks/useChat";

const SOURCE: SourceRef = {
  filePath: "ems/src/main/java/com/ems/AuthController.java",
  startLine: 12,
  endLine: 29,
};
const toViewer = (s: SourceRef) => `/projects/5?file=11&line=${s.startLine}`;

function renderBubble(over: Partial<ChatUiMessage>, citationHref: (s: SourceRef) => string | null = toViewer) {
  const message: ChatUiMessage = {
    id: "a1",
    role: "assistant",
    content: "",
    sources: [],
    status: "done",
    createdAt: "2026-11-13T10:00:00Z",
    model: null,
    errorText: null,
    apiError: null,
    ...over,
  };
  return render(
    <AppProviders>
      <MemoryRouter>
        <MessageBubble message={message} citationHref={citationHref} />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe("MessageBubble", () => {
  it("renders markdown: bold text and a code block without the ``` marks", () => {
    const { container } = renderBubble({
      content: "Login is in **AuthController**.\n\n```java\npublic void login() {}\n```",
    });
    expect(screen.getByText("AuthController").tagName).toBe("STRONG");
    expect(container.textContent).toContain("public void login() {}");
    expect(container.textContent).not.toContain("```");
  });

  it("links the source chip AND the [File.java:12-29] in the text to the code viewer", () => {
    renderBubble({
      content: "See [AuthController.java:12-29].",
      sources: [SOURCE],
    });
    const links = screen.getAllByRole("link", {
      name: /AuthController\.java:12-29/,
    });
    expect(links).toHaveLength(2);
    links.forEach((link) => expect(link).toHaveAttribute("href", "/projects/5?file=11&line=12"));
  });

  it('hides the sources for the "not found" answer', () => {
    renderBubble({
      content: "I could not find this in the indexed code.",
      sources: [SOURCE],
    });
    expect(screen.queryByText(/AuthController\.java/)).not.toBeInTheDocument();
  });

  it("shows a non-clickable chip when the file is not in the project", () => {
    renderBubble({ content: "Answer.", sources: [SOURCE] }, () => null);
    expect(screen.getByText("AuthController.java:12-29")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the error text sent by the backend", () => {
    renderBubble({
      status: "error",
      errorText: "This project is not indexed yet. Click 'Index project' first",
    });
    expect(screen.getByText(/not indexed yet/)).toBeInTheDocument();
  });
});
