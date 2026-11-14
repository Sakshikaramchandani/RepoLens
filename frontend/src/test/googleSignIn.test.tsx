import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API_BASE_URL } from "../api/contract";
import { tokenStorage } from "../api/tokenStorage";
import { MOCK_DEMO_USER } from "../config/env";
import { createMockToken } from "../mocks/db";
import { server } from "../mocks/server";
import { renderApp } from "./renderApp";

/** The sign-in was started in this tab (SocialSignIn remembers the state before redirecting). */
const startedHere = (state: string) => sessionStorage.setItem("repolens.oauth.state", state);

const signedIn = () =>
  HttpResponse.json({
    token: createMockToken(MOCK_DEMO_USER.email),
    user: { id: 1, email: MOCK_DEMO_USER.email, role: "USER" },
  });

describe("Google sign-in", () => {
  it("shows the Google button only when the server offers it", async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/auth/providers`, () => HttpResponse.json({ github: false, google: true })),
    );
    renderApp("/login");
    expect(await screen.findByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue with GitHub" })).not.toBeInTheDocument();
  });

  it("hides both buttons when no provider is configured", async () => {
    renderApp("/login");
    expect(await screen.findByRole("heading", { name: /sign in|welcome/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument();
  });

  it("callback: exchanges code + state for a JWT and lands on the overview", async () => {
    let sent: unknown = null;
    let githubCalled = false;
    server.use(
      http.post(`${API_BASE_URL}/api/auth/google/callback`, async ({ request }) => {
        sent = await request.json();
        return signedIn();
      }),
      http.post(`${API_BASE_URL}/api/auth/github/callback`, () => {
        githubCalled = true;
        return signedIn();
      }),
    );
    startedHere("xyz");
    renderApp("/auth/google/callback?code=google-code-1&state=xyz");

    expect(await screen.findByRole("heading", { name: "Good to see you, demo" })).toBeInTheDocument();
    expect(sent).toEqual({ code: "google-code-1", state: "xyz" });
    expect(githubCalled).toBe(false); // the GitHub ?code&state forwarder must leave this page alone
    expect(tokenStorage.get()).not.toBeNull();
  });

  it("callback: shows the server's message when sign-in fails", async () => {
    server.use(
      http.post(`${API_BASE_URL}/api/auth/google/callback`, () =>
        HttpResponse.json({ message: "Invalid Google sign-in state. Please start again" }, { status: 400 }),
      ),
    );
    startedHere("bad");
    renderApp("/auth/google/callback?code=google-code-2&state=bad");
    expect(await screen.findByText("Could not sign in with Google")).toBeInTheDocument();
    expect(await screen.findByText(/Invalid Google sign-in state/)).toBeInTheDocument();
  });

  it("callback: refuses a link that was not started in this tab (login CSRF)", async () => {
    let exchanged = false;
    server.use(
      http.post(`${API_BASE_URL}/api/auth/google/callback`, () => {
        exchanged = true;
        return signedIn();
      }),
    );
    startedHere("mine");
    renderApp("/auth/google/callback?code=google-code-3&state=attackers");
    expect(await screen.findByText(/not started from this browser tab/)).toBeInTheDocument();
    expect(exchanged).toBe(false);
    expect(tokenStorage.get()).toBeNull();
  });

  it("callback: shows Google's error when the user cancels", async () => {
    renderApp("/auth/google/callback?error=access_denied&state=xyz");
    expect(await screen.findByText("access_denied")).toBeInTheDocument();
  });
});
