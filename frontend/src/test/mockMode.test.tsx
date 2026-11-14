import { act, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../AppProviders";
import { reviewApi } from "../api/review";
import { riskApi } from "../api/risk";
import { tokenStorage } from "../api/tokenStorage";
import { AiModelsList } from "../components/ai/AiModelsList";
import { MOCK_DEMO_USER } from "../config/env";
import { useChat } from "../hooks/useChat";
import { createMockToken } from "../mocks/db";
import { mockProjects, sampleRepository } from "../mocks/projectsDb";

function seedProject(): number {
  tokenStorage.set(createMockToken(MOCK_DEMO_USER.email));
  const project = mockProjects.create(MOCK_DEMO_USER.email, "Demo", null);
  mockProjects.replaceFiles(project.id, "ZIP", sampleRepository("Demo"));
  return project.id;
}

describe("mock mode (no backend)", () => {
  it("streams a cited chat answer built from the project's files", async () => {
    const projectId = seedProject();
    const { result } = renderHook(() => useChat(projectId));
    await act(() => result.current.send("How does login work?"));

    const answer = result.current.messages[1];
    expect(answer).toMatchObject({ role: "assistant", status: "done", model: "mock-model" });
    expect(answer.content).toMatch(/simulated/);
    expect(answer.sources.length).toBeGreaterThan(0);
    expect(result.current.conversationId).not.toBeNull();

    await act(() => result.current.regenerate());
    expect(result.current.messages).toHaveLength(2);
  });

  it("reviews files and maps risk across languages", async () => {
    const projectId = seedProject();
    const files = mockProjects.files(MOCK_DEMO_USER.email, projectId)!;
    const script = files.find((f) => f.path.endsWith(".py"))!;

    const review = await reviewApi.review(projectId, [script.id]);
    expect(review.model).toBe("mock-model");
    expect(review.issues.some((i) => i.issue.includes("swallows"))).toBe(true);

    const risk = await riskApi.report(projectId);
    expect(risk.languages).toEqual(expect.arrayContaining(["Java", "Python", "TypeScript"]));
    expect(risk.files.every((f) => !f.filePath.includes("src/test/"))).toBe(true);
    expect(risk.historyAvailable).toBe(false);
  });
});

describe("AI model status", () => {
  it("shows roles and model names, never provider names", async () => {
    tokenStorage.set(createMockToken(MOCK_DEMO_USER.email));
    render(
      <AppProviders>
        <MemoryRouter>
          <AiModelsList />
        </MemoryRouter>
      </AppProviders>,
    );
    expect(await screen.findByText("qwen2.5-coder:7b")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/ollama/i);
  });
});
