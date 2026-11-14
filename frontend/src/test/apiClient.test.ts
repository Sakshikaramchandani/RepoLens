import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { apiClient, setUnauthorizedHandler } from "../api/client";
import { API_BASE_URL, AUTH_ENDPOINTS, AUTH_HEADER_NAME } from "../api/contract";
import { ApiError } from "../api/errors";
import { tokenStorage } from "../api/tokenStorage";
import { server } from "../mocks/server";

describe("apiClient interceptors", () => {
  it('attaches "Bearer <token>" to protected endpoints', async () => {
    let seen: string | null = null;
    server.use(
      http.get(`${API_BASE_URL}${AUTH_ENDPOINTS.me}`, ({ request }) => {
        seen = request.headers.get(AUTH_HEADER_NAME);
        return HttpResponse.json({ id: 1, email: "a@b.co", role: "USER" });
      }),
    );
    tokenStorage.set("abc.def.ghi");
    await apiClient.get(AUTH_ENDPOINTS.me);
    expect(seen).toBe("Bearer abc.def.ghi");
  });

  it("does NOT attach the token to login", async () => {
    let seen: string | null = "not-called";
    server.use(
      http.post(`${API_BASE_URL}${AUTH_ENDPOINTS.login}`, ({ request }) => {
        seen = request.headers.get(AUTH_HEADER_NAME);
        return HttpResponse.json({ token: "x" });
      }),
    );
    tokenStorage.set("abc.def.ghi");
    await apiClient.post(AUTH_ENDPOINTS.login, { email: "a@b.co", password: "x" });
    expect(seen).toBeNull();
  });

  it("turns a 401 on a protected call into ApiError, clears the token and notifies", async () => {
    server.use(
      http.get(`${API_BASE_URL}${AUTH_ENDPOINTS.me}`, () =>
        HttpResponse.json({ message: "Token expired" }, { status: 401 }),
      ),
    );
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    tokenStorage.set("expired");

    const error = await apiClient.get(AUTH_ENDPOINTS.me).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe("unauthorized");
    expect((error as ApiError).serverMessage).toBe("Token expired");
    expect(tokenStorage.get()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();
    setUnauthorizedHandler(null);
  });

  it('reports network failures as kind "network"', async () => {
    server.use(http.get(`${API_BASE_URL}${AUTH_ENDPOINTS.me}`, () => HttpResponse.error()));
    const error = await apiClient.get(AUTH_ENDPOINTS.me).catch((e: unknown) => e);
    expect((error as ApiError).kind).toBe("network");
  });
});
