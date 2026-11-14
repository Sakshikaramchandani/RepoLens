import { delay, http, HttpResponse } from "msw";
import { API_BASE_URL } from "../api/contract";
import type { Profile } from "../api/profile";
import { USERNAME_PATTERN } from "../api/profile";
import type { ReviewIssue, ReviewResponse } from "../api/review";
import type { FileRisk, RiskReport } from "../api/risk";
import { mockDb, usernameOf } from "./db";
import { currentUser, readJson } from "./projectHandlers";
import { mockProjects } from "./projectsDb";

/**
 * Mock code review, risk map and profile. Review and risk run simple heuristics over the project's
 * own files in the browser — clearly labelled as simulated, but shaped exactly like the real API.
 */
const url = (path: string) => `${API_BASE_URL}${path}`;
const wait = (ms: number) => delay(import.meta.env.MODE === "test" ? 0 : ms);
const unauthorized = () => HttpResponse.json({ message: "Unauthorized - login required" }, { status: 401 });

const LANGUAGE: Record<string, string> = {
  java: "Java",
  kt: "Kotlin",
  py: "Python",
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  go: "Go",
  rs: "Rust",
  cs: "C#",
  rb: "Ruby",
  php: "PHP",
  swift: "Swift",
  c: "C",
  cpp: "C++",
  scala: "Scala",
  dart: "Dart",
  vue: "Vue",
  sh: "Shell",
};
const extension = (path: string) => (path.includes(".") ? path.split(".").pop()!.toLowerCase() : "");
const isTest = (path: string) => /(^|\/)(src\/test|tests?|__tests__)\/|(Test|_test|\.test|\.spec)\./.test(path);

/** Line-level smells shared by the mock review and the mock risk map. */
const SMELLS: Array<{
  pattern: RegExp;
  issue: ReviewIssue["issue"];
  severity: ReviewIssue["severity"];
  category: ReviewIssue["category"];
  suggestion: string;
}> = [
  {
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}|except[^:]*:\s*pass/,
    severity: "HIGH",
    category: "BUG",
    issue: "An error handler swallows the exception, so failures disappear silently.",
    suggestion: "Log the error with context, or rethrow it wrapped in a domain exception.",
  },
  {
    pattern: /password\s*(==|\.equals\()/i,
    severity: "CRITICAL",
    category: "SECURITY",
    issue: "The password is compared in plain text instead of against a hash.",
    suggestion: "Store a BCrypt/Argon2 hash and compare with the hasher's matches() function.",
  },
  {
    pattern: /System\.out\.print|console\.log\(|\bprint\(/,
    severity: "LOW",
    category: "MAINTAINABILITY",
    issue: "Debug output is printed instead of going through a logger.",
    suggestion: "Use the project's logger with a level, so it can be filtered in production.",
  },
  {
    pattern: /\b(TODO|FIXME)\b/,
    severity: "LOW",
    category: "MAINTAINABILITY",
    issue: "An unfinished TODO/FIXME is left in the code.",
    suggestion: "Finish it or track it as an issue and remove the comment.",
  },
  {
    pattern: /"(SELECT|INSERT|UPDATE|DELETE)[^"]*"\s*\+/i,
    severity: "CRITICAL",
    category: "SECURITY",
    issue: "SQL is built by string concatenation, which allows SQL injection.",
    suggestion: "Use a parameterised query / prepared statement.",
  },
];

const DECISIONS = /\b(if|elif|for|while|case|catch|except)\b|&&|\|\|/g;

function riskOf(path: string, content: string, fileId: number): FileRisk {
  const code = content.split("\n").filter((l) => l.trim() && !/^\s*(\/\/|#|\*|\/\*)/.test(l));
  const complexity = 1 + code.reduce((n, l) => n + (l.match(DECISIONS)?.length ?? 0), 0);
  const methods = content.match(/\b(def|function|fun|func)\s+\w+|\w+\s*\([^)]*\)\s*\{\s*$/gm)?.length ?? 0;
  const findings = SMELLS.filter((s) => s.pattern.test(content)).map((s) => s.issue.replace(/\.$/, ""));
  const worst = methods ? Math.ceil(complexity / methods) + 1 : complexity;
  const score = Math.round(
    40 * Math.min(1, worst / 20) +
      20 * Math.min(1, complexity / 80) +
      15 * Math.min(1, code.length / 500) +
      25 * Math.min(1, findings.length / 8),
  );
  return {
    fileId,
    filePath: path,
    language: LANGUAGE[extension(path)] ?? "Code",
    score,
    label: score >= 60 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW",
    complexity,
    maxMethodComplexity: worst,
    loc: code.length,
    methods,
    churn: null,
    bugFixCommits: null,
    authors: null,
    lastChanged: null,
    warnings: findings.length,
    findings,
  };
}

function profileOf(email: string): Profile | null {
  const user = mockDb.findByEmail(email);
  if (!user) return null;
  return {
    id: Number(user.id),
    email: user.email,
    role: user.role,
    username: usernameOf(user),
    avatarUrl: user.avatarUrl ?? null,
    avatarSource: user.avatarSource ?? null,
    providerAvatars: [],
  };
}

export const analysisHandlers = [
  http.post(url("/api/projects/:id/review"), async ({ request, params }) => {
    const email = currentUser(request);
    if (!email) return unauthorized();
    const files = mockProjects.files(email, Number(params.id));
    if (!files) return HttpResponse.json({ message: "Project not found" }, { status: 404 });
    const { fileIds = [] } = await readJson<{ fileIds: number[] }>(request);
    const chosen = files.filter((f) => fileIds.includes(f.id));
    if (chosen.length === 0) return HttpResponse.json({ message: "Choose at least one file" }, { status: 400 });
    await wait(1200);

    const issues: ReviewIssue[] = [];
    for (const f of chosen) {
      f.content.split("\n").forEach((line, i, lines) => {
        // two lines, so "except:" + "pass" on the next line still counts
        const next = lines[i + 1] ?? "";
        const smell =
          SMELLS.find((s) => s.pattern.test(line)) ??
          SMELLS.find((s) => s.pattern.test(line + "\n" + next) && !s.pattern.test(next));
        if (smell)
          issues.push({
            severity: smell.severity,
            category: smell.category,
            fileId: f.id,
            file: f.path,
            line: i + 1,
            issue: smell.issue,
            suggestion: smell.suggestion,
          });
      });
    }
    const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    issues.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || a.line - b.line);
    const response: ReviewResponse = {
      projectId: Number(params.id),
      totalIssues: issues.length,
      issues,
      summary: `Mock review (simulated in your browser, no AI model ran): ${issues.length} pattern-based finding${issues.length === 1 ? "" : "s"} in ${chosen.length} file${chosen.length === 1 ? "" : "s"}.`,
      files: chosen.map((f) => ({ fileId: f.id, path: f.path, truncated: false })),
      model: "mock-model",
    };
    return HttpResponse.json(response);
  }),

  http.get(url("/api/projects/:id/risk"), async ({ request, params }) => {
    const email = currentUser(request);
    if (!email) return unauthorized();
    const files = mockProjects.files(email, Number(params.id));
    if (!files) return HttpResponse.json({ message: "Project not found" }, { status: 404 });
    await wait(300);
    const results = files
      .filter((f) => LANGUAGE[extension(f.path)] && !isTest(f.path))
      .map((f) => riskOf(f.path, f.content, f.id))
      .sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath));
    const high = results.filter((r) => r.label === "HIGH").length;
    const medium = results.filter((r) => r.label === "MEDIUM").length;
    const report: RiskReport = {
      projectId: Number(params.id),
      filesAnalyzed: results.length,
      high,
      medium,
      low: results.length - high - medium,
      historyAvailable: false,
      historyCommits: 0,
      languages: [...new Set(results.map((r) => r.language))].sort(),
      files: results,
    };
    return HttpResponse.json(report);
  }),

  http.get(url("/api/users/me"), ({ request }) => {
    const email = currentUser(request);
    if (!email) return unauthorized();
    return HttpResponse.json(profileOf(email));
  }),

  http.patch(url("/api/users/me"), async ({ request }) => {
    const email = currentUser(request);
    if (!email) return unauthorized();
    const username = ((await readJson<{ username: string }>(request)).username ?? "").trim();
    if (!USERNAME_PATTERN.test(username)) {
      return HttpResponse.json(
        { message: "Use 3-30 letters, numbers, dots, dashes or underscores, starting with a letter or number" },
        { status: 400 },
      );
    }
    if (mockDb.usernameTaken(username, email))
      return HttpResponse.json({ message: "That username is taken" }, { status: 409 });
    mockDb.update(email, { username });
    return HttpResponse.json(profileOf(email));
  }),

  http.put(url("/api/users/me/avatar"), async ({ request }) => {
    const email = currentUser(request);
    if (!email) return unauthorized();
    const image = (await readJson<{ image: string }>(request)).image ?? "";
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(image)) {
      return HttpResponse.json({ message: "Upload a PNG, JPEG or WebP image" }, { status: 400 });
    }
    // mock: the data URL itself is the picture URL
    mockDb.update(email, { avatarUrl: image, avatarSource: "UPLOAD" });
    return HttpResponse.json(profileOf(email));
  }),

  http.put(url("/api/users/me/avatar/source"), ({ request }) => {
    if (!currentUser(request)) return unauthorized();
    return HttpResponse.json({ message: "No GitHub or Google picture is linked in mock mode" }, { status: 400 });
  }),

  http.delete(url("/api/users/me/avatar"), ({ request }) => {
    const email = currentUser(request);
    if (!email) return unauthorized();
    mockDb.update(email, { avatarUrl: null, avatarSource: "NONE" });
    return HttpResponse.json(profileOf(email));
  }),
];
