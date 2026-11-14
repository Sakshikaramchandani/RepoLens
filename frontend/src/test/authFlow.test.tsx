import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { tokenStorage } from "../api/tokenStorage";
import { MOCK_DEMO_USER } from "../config/env";
import { createMockToken } from "../mocks/db";
import { renderApp } from "./renderApp";

describe("authentication flow (against MSW)", () => {
  it("redirects an unauthenticated visitor from /dashboard to /login", async () => {
    renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Sign in", level: 1 })).toBeInTheDocument();
  });

  it("shows validation messages for invalid input", async () => {
    const { user } = renderApp("/login");
    await user.type(await screen.findByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
  });

  it("shows an error for a wrong password and stays on login", async () => {
    const { user } = renderApp("/login");
    await user.type(await screen.findByLabelText("Email"), MOCK_DEMO_USER.email);
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Incorrect email or password.")).toBeInTheDocument();
    expect(tokenStorage.get()).toBeNull();
  });

  it("logs in with valid credentials and lands on the dashboard", async () => {
    const { user } = renderApp("/login");
    await user.type(await screen.findByLabelText("Email"), MOCK_DEMO_USER.email);
    await user.type(screen.getByLabelText("Password"), MOCK_DEMO_USER.password);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Good to see you, demo" })).toBeInTheDocument();
    expect(tokenStorage.get()).toBeTruthy();
  });

  it("restores a saved session via /me on start-up", async () => {
    tokenStorage.set(createMockToken(MOCK_DEMO_USER.email));
    renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Good to see you, demo" })).toBeInTheDocument();
  });

  it("drops an invalid saved token and shows login", async () => {
    tokenStorage.set("garbage-token");
    renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Sign in", level: 1 })).toBeInTheDocument();
    expect(tokenStorage.get()).toBeNull();
  });

  it("registers a new account, then asks the user to sign in", async () => {
    const { user } = renderApp("/register");
    await user.type(await screen.findByLabelText("Email"), "new.user@repolens.dev");
    await user.type(screen.getByLabelText("Password"), "Password@123");
    await user.type(screen.getByLabelText("Confirm password"), "Password@123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Your account is ready. Please sign in.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("new.user@repolens.dev");
  });

  it("rejects registering an email that already exists", async () => {
    const { user } = renderApp("/register");
    await user.type(await screen.findByLabelText("Email"), MOCK_DEMO_USER.email);
    await user.type(screen.getByLabelText("Password"), "Password@123");
    await user.type(screen.getByLabelText("Confirm password"), "Password@123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("An account with this email already exists.")).toBeInTheDocument();
  });

  it("logs out and protects the dashboard again", async () => {
    tokenStorage.set(createMockToken(MOCK_DEMO_USER.email));
    const { user } = renderApp("/dashboard");
    await screen.findByRole("heading", { name: "Good to see you, demo" });

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("button", { name: "Log out" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Sign in", level: 1 })).toBeInTheDocument();
    expect(tokenStorage.get()).toBeNull();
  });
});
