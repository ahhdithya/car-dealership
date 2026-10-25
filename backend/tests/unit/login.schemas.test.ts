import { describe, expect, it } from "vitest";

import { ZodError } from "zod";
import { parseLogin } from "../../src/auth/auth.schemas.js";

describe("login input validation", () => {
  it("normalizes the email and accepts a nonempty password", () => {
    expect(
      parseLogin({
        email: "  Customer@Example.COM  ",
        password: "short",
      }),
    ).toEqual({
      email: "customer@example.com",
      password: "short",
    });
  });

  it("preserves password case and surrounding spaces", () => {
    const password = "  Mixed CASE password!  ";

    expect(
      parseLogin({
        email: "customer@example.com",
        password,
      }),
    ).toEqual({
      email: "customer@example.com",
      password,
    });
  });

  it.each([
    {
      description: "missing email",
      input: { password: "Example password!" },
    },
    {
      description: "missing password",
      input: { email: "customer@example.com" },
    },
    {
      description: "invalid email",
      input: {
        email: "not-an-email",
        password: "Example password!",
      },
    },
    {
      description: "empty password",
      input: {
        email: "customer@example.com",
        password: "",
      },
    },
    {
      description: "password longer than 128 characters",
      input: {
        email: "customer@example.com",
        password: "a".repeat(129),
      },
    },
    {
      description: "numeric password",
      input: {
        email: "customer@example.com",
        password: 123456789012,
      },
    },
    {
      description: "a submitted role",
      input: {
        email: "customer@example.com",
        password: "Example password!",
        role: "ADMIN",
      },
    },
    {
      description: "a null body",
      input: null,
    },
  ])("rejects $description", ({ input }) => {
    expect(() => parseLogin(input)).toThrow(ZodError);
  });
});
