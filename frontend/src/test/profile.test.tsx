import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { tokenStorage } from "../api/tokenStorage";
import { MOCK_DEMO_USER } from "../config/env";
import { createMockToken, mockDb } from "../mocks/db";
import { renderApp } from "./renderApp";

describe("Profile page", () => {
  it("changes the username and the account menu follows", async () => {
    tokenStorage.set(createMockToken(MOCK_DEMO_USER.email));
    const { user } = renderApp("/profile");

    const field = await screen.findByRole("textbox", { name: "Username" });
    expect(field).toHaveValue("demo");
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    await user.clear(field);
    await user.type(field, "demo.dev");
    await user.click(save);

    expect(await screen.findByText("Username updated")).toBeInTheDocument();
    const menu = screen.getByRole("button", { name: "Account menu" });
    await waitFor(() => expect(within(menu).getByText("demo.dev")).toBeInTheDocument());
  });

  it("shows invalid and taken usernames under the field", async () => {
    mockDb.create("taken@repolens.dev", "Password@123");
    tokenStorage.set(createMockToken(MOCK_DEMO_USER.email));
    const { user } = renderApp("/profile");
    const field = await screen.findByRole("textbox", { name: "Username" });

    await user.clear(field);
    await user.type(field, "a b");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Use 3–30 letters/)).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, "taken");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("That username is taken")).toBeInTheDocument();
  });

  it("offers upload and no provider photos when none are linked", async () => {
    tokenStorage.set(createMockToken(MOCK_DEMO_USER.email));
    renderApp("/profile");
    expect(await screen.findByRole("button", { name: "Upload photo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use GitHub photo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });
});
