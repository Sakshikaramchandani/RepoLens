import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../AppProviders";
import { API_BASE_URL } from "../api/contract";
import type { IndexJob } from "../api/indexing";
import { IndexPanel } from "../components/indexing/IndexControl";
import { server } from "../mocks/server";
import { MemoryRouter } from "react-router-dom";

const job = (over: Partial<IndexJob>): IndexJob => ({
  jobId: 1,
  projectId: 7,
  status: "RUNNING",
  progress: 0,
  totalFiles: 10,
  processedFiles: 0,
  errorMessage: null,
  ...over,
});

const statusUrl = `${API_BASE_URL}/api/projects/7/index/status`;
const startUrl = `${API_BASE_URL}/api/projects/7/index`;

function renderPanel(hasFiles = true) {
  render(
    <AppProviders>
      <MemoryRouter>
        <IndexPanel projectId={7} hasFiles={hasFiles} />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe("IndexPanel", () => {
  it("starts indexing, shows progress and stops polling when DONE", async () => {
    // backend answers: never indexed → (start) → RUNNING 40% → DONE
    const answers = [
      () => HttpResponse.json({ message: "Project has not been indexed yet" }, { status: 404 }),
      () => HttpResponse.json(job({ status: "RUNNING", progress: 40, processedFiles: 4 })),
      () => HttpResponse.json(job({ status: "DONE", progress: 100, processedFiles: 10 })),
    ];
    let statusCalls = 0;
    server.use(
      http.get(statusUrl, () => answers[Math.min(statusCalls++, answers.length - 1)]()),
      http.post(startUrl, () => HttpResponse.json(job({ status: "QUEUED" }), { status: 202 })),
    );

    renderPanel();
    expect(await screen.findByText(/not indexed yet/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /index project/i }));

    const bar = await screen.findByRole("progressbar");
    await waitFor(() => expect(bar).toHaveAttribute("aria-valuenow", "40"));
    expect(screen.getByText(/4 of 10 files/i)).toBeInTheDocument();

    expect(await screen.findByText(/indexed · 10 files/i, {}, { timeout: 6000 })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /re-index/i })).toBeEnabled();

    const callsWhenDone = statusCalls;
    await new Promise((resolve) => setTimeout(resolve, 3000));
    expect(statusCalls).toBe(callsWhenDone); // no more polling after DONE
  }, 20_000);

  it("shows the error message of a FAILED job", async () => {
    server.use(
      http.get(statusUrl, () =>
        HttpResponse.json(
          job({
            status: "FAILED",
            progress: 50,
            errorMessage: "Ollama is not running",
          }),
        ),
      ),
    );
    renderPanel();
    expect(await screen.findByText("Ollama is not running")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /re-index/i })).toBeEnabled();
  });

  it("disables the button when the project has no files", async () => {
    server.use(http.get(statusUrl, () => HttpResponse.json({ message: "nope" }, { status: 404 })));
    renderPanel(false);
    expect(await screen.findByText(/import code first/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /index project/i })).toBeDisabled();
  });

  it("treats the real API's 200 NOT_INDEXED answer as 'never indexed' (no polling, button enabled)", async () => {
    let calls = 0;
    server.use(
      http.get(statusUrl, () => {
        calls++;
        return HttpResponse.json(job({ jobId: null, status: "NOT_INDEXED" }));
      }),
    );
    renderPanel();
    expect(await screen.findByText(/not indexed yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /index project/i })).toBeEnabled();
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(1);
  });
});
