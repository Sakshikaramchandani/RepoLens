import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API_BASE_URL } from "../api/contract";
import { GITHUB_INTENT_KEY } from "../api/github";
import { tokenStorage } from "../api/tokenStorage";
import { createMockToken } from "../mocks/db";
import { server } from "../mocks/server";
import { MOCK_DEMO_USER } from "../config/env";
import { renderApp } from "./renderApp";

describe("GitHub sign-in callback", () => {
  it("signs in with the returned JWT and lands on the overview", async () => {
    let sent: unknown = null;
    server.use(
      http.post(`${API_BASE_URL}/api/auth/github/callback`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({
          token: createMockToken(MOCK_DEMO_USER.email),
          user: { id: 1, email: MOCK_DEMO_USER.email, role: "USER" },
        });
      }),
    );
    sessionStorage.setItem(GITHUB_INTENT_KEY, "login");
    sessionStorage.setItem("repolens.oauth.state", "xyz");
    renderApp("/integrations/github/callback?code=abc&state=xyz");

    expect(await screen.findByRole("heading", { name: "Good to see you, demo" })).toBeInTheDocument();
    expect(sent).toEqual({ code: "abc", state: "xyz" });
    expect(tokenStorage.get()).not.toBeNull();
  });

  it("forwards ?code&state that land on another page (callback URL = app root)", async () => {
    server.use(
      http.post(`${API_BASE_URL}/api/auth/github/callback`, () =>
        HttpResponse.json({
          token: createMockToken(MOCK_DEMO_USER.email),
          user: { id: 1, email: MOCK_DEMO_USER.email, role: "USER" },
        }),
      ),
    );
    sessionStorage.setItem("repolens.oauth.state", "xyz");
    renderApp("/?code=root-code&state=xyz");
    expect(await screen.findByRole("heading", { name: "Good to see you, demo" })).toBeInTheDocument();
  });

  it("connects GitHub for a signed-in user (intent connect)", async () => {
    tokenStorage.set(createMockToken(MOCK_DEMO_USER.email));
    let connected = false;
    server.use(
      http.post(`${API_BASE_URL}/api/github/oauth/callback`, () => {
        connected = true;
        return HttpResponse.json({ enabled: true, connected: true, login: "octocat", avatarUrl: null, scopes: "repo" });
      }),
    );
    sessionStorage.setItem(GITHUB_INTENT_KEY, "connect");
    sessionStorage.setItem("repolens.oauth.state", "xyz");
    renderApp("/integrations/github/callback?code=connect-code&state=xyz");
    await waitFor(() => expect(connected).toBe(true));
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });

  it("shows GitHub's own error (e.g. the user cancelled)", async () => {
    renderApp(
      "/integrations/github/callback?error=access_denied&error_description=The+user+has+denied+your+application+access.&state=xyz",
    );
    expect(await screen.findByText("The user has denied your application access.")).toBeInTheDocument();
  });
});
