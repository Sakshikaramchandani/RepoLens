import { delay, http, HttpResponse } from "msw";
import { API_BASE_URL, AUTH_HEADER_NAME, AUTH_SCHEME, type ApiErrorBody } from "../api/contract";
import type { IndexJob } from "../api/indexing";
import { mockDb, readMockToken } from "./db";
import { mockProjects } from "./projectsDb";

/**
 * Fake Week 3 indexing API — same shape as Apoorv's IndexDtos.IndexJobResponse.
 * The job "runs" on the clock: QUEUED for 1 s, then RUNNING for about 8 s, then DONE.
 * Scenario to try:
 *   • project name containing "fail" → the job stops halfway with FAILED (shows the error UI)
 */
const url = (path: string) => `${API_BASE_URL}${path}`;
const wait = (ms = 300) => delay(import.meta.env.MODE === "test" ? 0 : ms);
const fail = (status: number, message: string) => HttpResponse.json<ApiErrorBody>({ message }, { status });

const QUEUED_MS = 1000;
const RUN_MS = 8000;

interface MockJob {
  jobId: number;
  projectId: number;
  startedAt: number;
  totalFiles: number;
  failHalfway: boolean;
}

// In memory only: a page reload "forgets" jobs, which is fine for a mock.
const jobs = new Map<number, MockJob>();
let nextJobId = 1;

function currentUser(request: Request): string | null {
  const header = request.headers.get(AUTH_HEADER_NAME) ?? "";
  const prefix = `${AUTH_SCHEME} `;
  if (!header.startsWith(prefix)) return null;
  const email = readMockToken(header.slice(prefix.length));
  return email && mockDb.findByEmail(email) ? email : null;
}

function countFiles(projectId: number): number {
  let count = 0;
  const walk = (nodes: ReturnType<typeof mockProjects.tree>) => {
    for (const node of nodes) {
      if (node.type === "FILE") count++;
      if (node.children) walk(node.children);
    }
  };
  walk(mockProjects.tree(projectId));
  return count;
}

/** What the job looks like right now, worked out from how long ago it started. */
function snapshot(job: MockJob): IndexJob {
  const elapsed = Date.now() - job.startedAt;
  const base = {
    jobId: job.jobId,
    projectId: job.projectId,
    totalFiles: job.totalFiles,
  };

  if (elapsed < QUEUED_MS) {
    return {
      ...base,
      status: "QUEUED",
      progress: 0,
      processedFiles: 0,
      errorMessage: null,
    };
  }
  const progress = Math.min(100, Math.round(((elapsed - QUEUED_MS) / RUN_MS) * 100));
  if (job.failHalfway && progress >= 50) {
    return {
      ...base,
      status: "FAILED",
      progress: 50,
      processedFiles: Math.floor(job.totalFiles / 2),
      errorMessage: "Embedding model is not reachable (mock failure)",
    };
  }
  if (progress >= 100) {
    return {
      ...base,
      status: "DONE",
      progress: 100,
      processedFiles: job.totalFiles,
      errorMessage: null,
    };
  }
  return {
    ...base,
    status: "RUNNING",
    progress,
    processedFiles: Math.floor((job.totalFiles * progress) / 100),
    errorMessage: null,
  };
}

export const indexHandlers = [
  http.post(url("/api/projects/:id/index"), async ({ request, params }) => {
    await wait();
    const email = currentUser(request);
    if (!email) return fail(401, "Unauthorized - login required");
    const project = mockProjects.find(email, Number(params.id));
    if (!project) return fail(404, "Project not found");

    const totalFiles = countFiles(project.id);
    if (totalFiles === 0) return fail(400, "Project has no files to index");

    const existing = jobs.get(project.id);
    if (existing && ["QUEUED", "RUNNING"].includes(snapshot(existing).status)) {
      return fail(409, "Indexing is already running for this project");
    }

    const job: MockJob = {
      jobId: nextJobId++,
      projectId: project.id,
      startedAt: Date.now(),
      totalFiles,
      failHalfway: project.name.toLowerCase().includes("fail"),
    };
    jobs.set(project.id, job);
    return HttpResponse.json(snapshot(job), { status: 202 });
  }),

  http.get(url("/api/projects/:id/index/status"), async ({ request, params }) => {
    await wait();
    const email = currentUser(request);
    if (!email) return fail(401, "Unauthorized - login required");
    const project = mockProjects.find(email, Number(params.id));
    if (!project) return fail(404, "Project not found");

    const job = jobs.get(project.id);
    if (!job) return fail(404, "Project has not been indexed yet");
    return HttpResponse.json(snapshot(job));
  }),
];
