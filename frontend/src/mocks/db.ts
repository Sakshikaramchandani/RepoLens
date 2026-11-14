import type { CurrentUser } from "../api/contract";
import { MOCK_DEMO_USER } from "../config/env";

/**
 * Tiny fake "users table" for MSW. DEVELOPMENT ONLY — passwords are kept in
 * plain text here because nothing real is stored. The real backend uses BCrypt.
 * Saved in localStorage so registered users and sessions survive a page reload.
 */
interface MockUserRecord extends CurrentUser {
  password: string;
  avatarSource?: "UPLOAD" | "NONE" | null;
}

const STORAGE_KEY = "repolens.mock.users";

const SEED: MockUserRecord[] = [
  { id: 1, email: MOCK_DEMO_USER.email, password: MOCK_DEMO_USER.password, role: "USER" },
];

function load(): MockUserRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockUserRecord[];
  } catch {
    /* ignore */
  }
  return [...SEED];
}

function save(users: MockUserRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch {
    /* ignore */
  }
}

export const mockDb = {
  findByEmail(email: string): MockUserRecord | undefined {
    return load().find((u) => u.email.toLowerCase() === email.toLowerCase());
  },
  create(email: string, password: string): MockUserRecord {
    const users = load();
    const nextId = users.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0) + 1;
    const user: MockUserRecord = { id: nextId, email, password, role: "USER" };
    save([...users, user]);
    return user;
  },
  update(email: string, changes: Partial<MockUserRecord>): MockUserRecord | undefined {
    const users = load();
    const index = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
    if (index < 0) return undefined;
    users[index] = { ...users[index], ...changes };
    save(users);
    return users[index];
  },
  usernameTaken(username: string, exceptEmail: string): boolean {
    return load().some(
      (u) =>
        usernameOf(u).toLowerCase() === username.toLowerCase() && u.email.toLowerCase() !== exceptEmail.toLowerCase(),
    );
  },
  reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
};

export function usernameOf(user: MockUserRecord): string {
  return user.username ?? user.email.split("@")[0];
}

export function toPublicUser(user: MockUserRecord): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    username: usernameOf(user),
    avatarUrl: user.avatarUrl ?? null,
  };
}

export type { MockUserRecord };

/* ── Fake JWT: header.payload.signature (NOT signed — dev only) ───────────── */

function base64Url(input: string): string {
  return btoa(input).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  return atob(padded);
}

const TOKEN_LIFETIME_SECONDS = 60 * 60; // 1 hour

export function createMockToken(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ sub: email, iat: now, exp: now + TOKEN_LIFETIME_SECONDS }));
  return `${header}.${payload}.mock-signature`;
}

/** Returns the email inside a valid, non-expired mock token, else null. */
export function readMockToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[2] !== "mock-signature") return null;
  try {
    const payload = JSON.parse(fromBase64Url(parts[1])) as { sub?: unknown; exp?: unknown };
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.sub;
  } catch {
    return null;
  }
}
