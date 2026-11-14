import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "../schemas/auth";

function firstMessage(
  result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } },
  field: string,
) {
  return result.error?.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("loginSchema", () => {
  it("requires an email", () => {
    const result = loginSchema.safeParse({ email: "", password: "x" });
    expect(result.success).toBe(false);
    expect(firstMessage(result, "email")).toBe("validation.emailRequired");
  });

  it("rejects a malformed email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "x" });
    expect(firstMessage(result, "email")).toBe("validation.emailInvalid");
  });

  it("accepts valid credentials and trims the email", () => {
    const result = loginSchema.safeParse({ email: "  demo@repolens.dev ", password: "secret" });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("demo@repolens.dev");
  });
});

describe("registerSchema", () => {
  it("enforces the minimum password length", () => {
    const result = registerSchema.safeParse({ email: "a@b.co", password: "short", confirmPassword: "short" });
    expect(firstMessage(result, "password")).toBe("validation.passwordMin");
  });

  it("requires matching passwords", () => {
    const result = registerSchema.safeParse({
      email: "a@b.co",
      password: "Password@123",
      confirmPassword: "Password@124",
    });
    expect(firstMessage(result, "confirmPassword")).toBe("validation.passwordsMismatch");
  });
});
