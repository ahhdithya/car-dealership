import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import type { RegistrationDependencies } from "../../src/auth/registration.service.js";
import type { PublicUser } from "../../src/auth/users.repository.js";

function setup() {
  const user: PublicUser = {
    id: "82df1573-4d97-4d4a-a7bb-caf495170d71",
    email: "customer@example.com",
    role: "USER",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };

  const registration = {
    hashPassword: vi
      .fn<RegistrationDependencies["hashPassword"]>()
      .mockResolvedValue("hashed-password-fixture"),
    createUser: vi.fn<RegistrationDependencies["createUser"]>().mockResolvedValue(user),
  };

  const app = createApp({ registration });

  return { app, registration, user };
}

describe("POST /api/auth/register", () => {
  const validInput = {
    email: "  Customer@Example.COM  ",
    password: "  Mixed CASE password!  ",
  };

  it("returns 201 with public account details", async () => {
    const { app, registration, user } = setup();

    const response = await request(app)
      .post("/api/auth/register")
      .send(validInput)
      .expect("Content-Type", /json/)
      .expect(201);

    expect(response.body).toEqual({
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
      },
    });

    expect(registration.hashPassword).toHaveBeenCalledExactlyOnceWith(validInput.password);

    expect(registration.createUser).toHaveBeenCalledExactlyOnceWith({
      email: "customer@example.com",
      passwordHash: "hashed-password-fixture",
    });
  });

  it.each([
    {
      description: "invalid email",
      input: { ...validInput, email: "not-an-email" },
    },
    {
      description: "a submitted admin role",
      input: { ...validInput, role: "ADMIN" },
    },
  ])("returns 400 for $description without saving", async ({ input }) => {
    const { app, registration } = setup();

    const response = await request(app)
      .post("/api/auth/register")
      .send(input)
      .expect("Content-Type", /json/)
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request body.",
      },
    });

    expect(registration.hashPassword).not.toHaveBeenCalled();
    expect(registration.createUser).not.toHaveBeenCalled();
  });

  it("returns 409 when the email is already registered", async () => {
    const { app, registration } = setup();

    registration.createUser.mockRejectedValue(
      Object.assign(new Error("Duplicate email"), {
        code: "23505",
        constraint: "users_email_unique",
      }),
    );

    const response = await request(app)
      .post("/api/auth/register")
      .send(validInput)
      .expect("Content-Type", /json/)
      .expect(409);

    expect(response.body).toEqual({
      error: {
        code: "EMAIL_ALREADY_REGISTERED",
        message: "An account with this email already exists.",
      },
    });
  });

  it("returns a generic 500 response without exposing internal errors", async () => {
    const { app, registration } = setup();

    registration.createUser.mockRejectedValue(new Error("Internal database connection details"));

    const response = await request(app)
      .post("/api/auth/register")
      .send(validInput)
      .expect("Content-Type", /json/)
      .expect(500);

    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  });
});
