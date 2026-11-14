import { delay, http, HttpResponse } from "msw";
import {
  API_BASE_URL,
  AUTH_ENDPOINTS,
  AUTH_HEADER_NAME,
  AUTH_SCHEME,
  PASSWORD_RULES,
  TOKEN_RESPONSE_FIELD,
  type ApiErrorBody,
  type LoginRequest,
  type RegisterRequest,
} from "../api/contract";
import { createMockToken, mockDb, readMockToken, toPublicUser } from "./db";
import { projectHandlers } from "./projectHandlers";
import { indexHandlers } from "./indexHandlers";
import { platformHandlers } from "./platformHandlers";
import { chatHandlers } from "./chatHandlers";
import { analysisHandlers } from "./analysisHandlers";

// Same shapes as Apoorv's backend: AuthResponse = { token, user }.
const authResponse = (user: Parameters<typeof toPublicUser>[0]) => ({
  [TOKEN_RESPONSE_FIELD]: createMockToken(user.email),
  user: toPublicUser(user),
});

/**
 * Fake backend for /register, /login and /me.
 * Shapes come from src/api/contract.ts — keep both in sync with Apoorv's Swagger.
 *
 * Mock scenarios you can try in the browser:
 *   • demo@repolens.dev / Password@123            → login works
 *   • wrong password                              → 401 {"message":"Invalid email or password"}
 *   • register with an existing email             → 409 {"message":"Email already registered"}
 *   • register with servererror@repolens.dev      → 500 (to see the error UI)
 */

const url = (path: string) => `${API_BASE_URL}${path}`;
const latency = () => delay(import.meta.env.MODE === "test" ? 0 : 500);
const error = (status: number, message: string) => HttpResponse.json<ApiErrorBody>({ message }, { status });

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readJson<T>(request: Request): Promise<Partial<T> | null> {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return null;
  }
}

const authHandlers = [
  http.post(url(AUTH_ENDPOINTS.register), async ({ request }) => {
    await latency();
    const body = await readJson<RegisterRequest>(request);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!EMAIL_PATTERN.test(email)) return error(400, "Validation failed");
    if (password.length < PASSWORD_RULES.minLength || password.length > PASSWORD_RULES.maxLength) {
      return error(400, "Validation failed");
    }
    if (email.toLowerCase() === "servererror@repolens.dev") return error(500, "Simulated server error");
    if (mockDb.findByEmail(email)) return error(409, "Email already registered");

    const user = mockDb.create(email, password);
    return HttpResponse.json(authResponse(user), { status: 201 });
  }),

  http.post(url(AUTH_ENDPOINTS.login), async ({ request }) => {
    await latency();
    const body = await readJson<LoginRequest>(request);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) return error(400, "Validation failed");

    const user = mockDb.findByEmail(email);
    if (!user || user.password !== password) return error(401, "Invalid email or password");

    return HttpResponse.json(authResponse(user));
  }),

  http.get(url(AUTH_ENDPOINTS.me), async ({ request }) => {
    await latency();
    const header = request.headers.get(AUTH_HEADER_NAME) ?? "";
    const prefix = AUTH_SCHEME ? `${AUTH_SCHEME} ` : "";
    if (!header.startsWith(prefix) || header.length <= prefix.length)
      return error(401, "Unauthorized - login required");

    const email = readMockToken(header.slice(prefix.length));
    const user = email ? mockDb.findByEmail(email) : undefined;
    if (!user) return error(401, "Unauthorized - login required");

    return HttpResponse.json(toPublicUser(user));
  }),
];

export const handlers = [
  ...authHandlers,
  http.post(url(AUTH_ENDPOINTS.logout), () => new HttpResponse(null, { status: 204 })),
  ...projectHandlers,
  ...indexHandlers,
  ...platformHandlers,
  ...chatHandlers,
  ...analysisHandlers,
];
