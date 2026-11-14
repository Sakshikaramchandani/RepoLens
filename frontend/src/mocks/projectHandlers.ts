import { delay, http, HttpResponse } from "msw";
import { API_BASE_URL, AUTH_HEADER_NAME, AUTH_SCHEME, type ApiErrorBody } from "../api/contract";
import type { CreateProjectRequest, GithubImportRequest } from "../api/projects";
import { mockDb, readMockToken } from "./db";
import { mockProjects, sampleRepository } from "./projectsDb";

/**
 * Fake Week 2 project + file APIs — same shapes as Apoorv's ProjectDtos.java.
 * Scenarios to try:
 *   • GitHub URL containing "does-not-exist" → 404 (shows the "project created, import failed" UI)
 *   • ZIP that is not .zip or over 50 MB      → 400
 */
const url = (path: string) => `${API_BASE_URL}${path}`;
const wait = (ms = 600) => delay(import.meta.env.MODE === "test" ? 0 : ms);
const fail = (status: number, message: string) => HttpResponse.json<ApiErrorBody>({ message }, { status });
const unauthorized = () => fail(401, "Unauthorized - login required");
const notFound = (what = "Project") => fail(404, `${what} not found`);

const GITHUB_REPO_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+?(\.git)?\/?$/;
const MAX_ZIP_BYTES = 50 * 1024 * 1024;

/** Email of the logged-in mock user, or null if the token is missing/invalid. */
export function currentUser(request: Request): string | null {
  const header = request.headers.get(AUTH_HEADER_NAME) ?? "";
  const prefix = `${AUTH_SCHEME} `;
  if (!header.startsWith(prefix)) return null;
  const email = readMockToken(header.slice(prefix.length));
  return email && mockDb.findByEmail(email) ? email : null;
}

export async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    return ((await request.json()) ?? {}) as Partial<T>;
  } catch {
    return {};
  }
}

export const projectHandlers = [
  http.get(url("/api/projects"), async ({ request }) => {
    await wait();
    const email = currentUser(request);
    if (!email) return unauthorized();
    return HttpResponse.json(mockProjects.list(email));
  }),

  http.post(url("/api/projects"), async ({ request }) => {
    await wait();
    const email = currentUser(request);
    if (!email) return unauthorized();
    const body = await readJson<CreateProjectRequest>(request);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!name || name.length > 100 || description.length > 500) return fail(400, "Validation failed");
    return HttpResponse.json(mockProjects.create(email, name, description || null), { status: 201 });
  }),

  http.get(url("/api/projects/:id"), async ({ request, params }) => {
    await wait();
    const email = currentUser(request);
    if (!email) return unauthorized();
    const project = mockProjects.find(email, Number(params.id));
    return project ? HttpResponse.json(project) : notFound();
  }),

  http.delete(url("/api/projects/:id"), async ({ request, params }) => {
    await wait();
    const email = currentUser(request);
    if (!email) return unauthorized();
    if (!mockProjects.remove(email, Number(params.id))) return notFound();
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(url("/api/projects/:id/upload"), async ({ request, params }) => {
    await wait(1200);
    const email = currentUser(request);
    if (!email) return unauthorized();
    const project = mockProjects.find(email, Number(params.id));
    if (!project) return notFound();

    let file: FormDataEntryValue | null = null;
    try {
      file = (await request.formData()).get("file");
    } catch {
      /* not multipart */
    }
    if (!(file instanceof File)) return fail(400, 'Request must contain a "file" field');
    if (!file.name.toLowerCase().endsWith(".zip")) return fail(400, "Only .zip files are allowed");
    if (file.size > MAX_ZIP_BYTES) return fail(400, "File is larger than 50 MB");

    // The mock does not really unzip — it stores a sample repo instead.
    const saved = mockProjects.replaceFiles(project.id, "ZIP", sampleRepository(project.name));
    return HttpResponse.json({ filesSaved: saved, filesSkipped: 3 });
  }),

  http.post(url("/api/projects/:id/github"), async ({ request, params }) => {
    await wait(1500);
    const email = currentUser(request);
    if (!email) return unauthorized();
    const project = mockProjects.find(email, Number(params.id));
    if (!project) return notFound();

    const body = await readJson<GithubImportRequest>(request);
    const repoUrl = typeof body.repoUrl === "string" ? body.repoUrl.trim() : "";
    if (!GITHUB_REPO_URL.test(repoUrl)) return fail(400, "Invalid GitHub repository URL");
    // Never 401 here: 401 means "RepoLens login expired" and would log the user out.
    if (repoUrl.includes("does-not-exist")) return fail(404, "Repository not found, or the token has no access");

    const branch = typeof body.branch === "string" && body.branch.trim() ? body.branch.trim() : "main";
    const saved = mockProjects.replaceFiles(project.id, "GITHUB", sampleRepository(project.name));
    return HttpResponse.json({
      branch,
      latestCommitSha: "3f9c2a7d1b8e4c6a9f0d2e5b7c1a4d8e6f3b9c2a",
      latestCommitMessage: "Add login flow with JWT",
      filesSaved: saved,
    });
  }),

  http.get(url("/api/projects/:id/files"), async ({ request, params }) => {
    await wait();
    const email = currentUser(request);
    if (!email) return unauthorized();
    const project = mockProjects.find(email, Number(params.id));
    if (!project) return notFound();
    return HttpResponse.json(mockProjects.tree(project.id));
  }),

  http.get(url("/api/files/:fileId/content"), async ({ request, params }) => {
    await wait(300);
    const email = currentUser(request);
    if (!email) return unauthorized();
    const content = mockProjects.fileContent(email, Number(params.fileId));
    return content ? HttpResponse.json(content) : notFound("File");
  }),
];
