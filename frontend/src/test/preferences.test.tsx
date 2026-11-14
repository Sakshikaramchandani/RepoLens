import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "./renderApp";

describe("theme preference", () => {
  it("toggles the theme on <html> and remembers it", async () => {
    const { user } = renderApp("/login");
    await user.click(await screen.findByRole("button", { name: "Switch to dark theme" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("repolens.theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });
});

describe("translations", () => {
  it("validation messages are translation keys resolved to English", async () => {
    const { user } = renderApp("/login");
    await user.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
  });
});
