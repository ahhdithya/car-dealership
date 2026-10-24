import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { parseRegistration } from "../../src/auth/auth.schemas.js";

const validEmail = "customer@example.com";
const validPassword = "Example password 123!";

describe("registration input validation", () => {
  it("trims and lowercases the email", () => {
    const result = parseRegistration({
      email: "  Customer@Example.COM  ",
      password: validPassword,
    });

    expect(result).toEqual({
      email: validEmail,
      password: validPassword,
    });
  });

  it("preserves password case and surrounding spaces", () => {
    const password = "  Mixed CASE password!  ";

    const result = parseRegistration({
      email: validEmail,
      password,
    });

    expect(result.password).toBe(password);
  });

  it.each([12, 128])("accepts a password of exactly %i characters", (length) => {
    const password = "a".repeat(length);

    expect(
      parseRegistration({
        email: validEmail,
        password,
      }),
    ).toEqual({
      email: validEmail,
      password,
    });
  });

  it.each([
    {
      description: "missing email",
      input: { password: validPassword },
    },
    {
      description: "missing password",
      input: { email: validEmail },
    },
    {
      description: "invalid email format",
      input: { email: "not-an-email", password: validPassword },
    },
    {
      description: "empty email after trimming",
      input: { email: "   ", password: validPassword },
    },
    {
      description: "email longer than 254 characters",
      input: {
        email: `${"a".repeat(243)}@example.com`,
        password: validPassword,
      },
    },
    {
      description: "password shorter than 12 characters",
      input: { email: validEmail, password: "a".repeat(11) },
    },
    {
      description: "password longer than 128 characters",
      input: { email: validEmail, password: "a".repeat(129) },
    },
    {
      description: "a numeric password",
      input: { email: validEmail, password: 123456789012 },
    },
    {
      description: "a submitted admin role",
      input: {
        email: validEmail,
        password: validPassword,
        role: "ADMIN",
      },
    },
    {
      description: "an unexpected field",
      input: {
        email: validEmail,
        password: validPassword,
        nickname: "Customer",
      },
    },
    {
      description: "a null body",
      input: null,
    },
    {
      description: "an array body",
      input: [],
    },
  ])("rejects $description", ({ input }) => {
    expect(() => parseRegistration(input)).toThrow(ZodError);
  });
});
