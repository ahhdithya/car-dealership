import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import type { LoginDependencies } from "../../src/auth/login.service.js";
import type { RegistrationDependencies } from "../../src/auth/registration.service.js";
import type { AuthenticationUser } from "../../src/auth/users.repository.js";

function setup() {
  const account: AuthenticationUser = {
    id: "82df1573-4d97-4d4a-a7bb-caf495170d71",
    email: "customer@example.com",
    role: "USER",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    passwordHash: "stored-hash-fixture",
  };

  const login = {
    findUserByEmail: vi.fn<LoginDependencies["findUserByEmail"]>().mockResolvedValue(account),
    verifyPassword: vi.fn<LoginDependencies["verifyPassword"]>().mockResolvedValue(true),
    signAccessToken: vi
      .fn<LoginDependencies["signAccessToken"]>()
      .mockReturnValue("access-token-fixture"),
    dummyPasswordHash: "dummy-hash-fixture",
  };

  const registration = {
    hashPassword: vi.fn<RegistrationDependencies["hashPassword"]>(),
    createUser: vi.fn<RegistrationDependencies["createUser"]>(),
  };

  const app = createApp({ registration, login });

  return { app, login, account };
}

describe("POST /api/auth/login", () => {
  const input = {
    email: "  Customer@Example.COM  ",
    password: "  Mixed CASE password!  ",
  };

  it("returns 200 with an access token and public account details", async () => {
    const { app, login, account } = setup();

    const response = await request(app)
      .post("/api/auth/login")
      .send(input)
      .expect("Content-Type", /json/)
      .expect(200);

    expect(response.body).toEqual({
      accessToken: "access-token-fixture",
      user: {
        id: account.id,
        email: account.email,
        role: account.role,
        createdAt: account.createdAt.toISOString(),
      },
    });

    expect(login.findUserByEmail).toHaveBeenCalledExactlyOnceWith("customer@example.com");

    expect(login.verifyPassword).toHaveBeenCalledExactlyOnceWith(
      account.passwordHash,
      input.password,
    );

    expect(login.signAccessToken).toHaveBeenCalledExactlyOnceWith({
      id: account.id,
      role: account.role,
    });
  });

  it("returns 400 for invalid input without looking up an account", async () => {
    const { app, login } = setup();

    const response = await request(app)
      .post("/api/auth/login")
      .send({ ...input, password: "" })
      .expect("Content-Type", /json/)
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request body.",
      },
    });

    expect(login.findUserByEmail).not.toHaveBeenCalled();
    expect(login.verifyPassword).not.toHaveBeenCalled();
    expect(login.signAccessToken).not.toHaveBeenCalled();
  });

  it("returns 401 for an unknown email", async () => {
    const { app, login } = setup();

    login.findUserByEmail.mockResolvedValue(null);
    login.verifyPassword.mockResolvedValue(false);

    const response = await request(app)
      .post("/api/auth/login")
      .send(input)
      .expect("Content-Type", /json/)
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      },
    });

    expect(login.verifyPassword).toHaveBeenCalledExactlyOnceWith(
      login.dummyPasswordHash,
      input.password,
    );

    expect(login.signAccessToken).not.toHaveBeenCalled();
  });

  it("returns the same 401 response for an incorrect password", async () => {
    const { app, login } = setup();

    login.verifyPassword.mockResolvedValue(false);

    const response = await request(app)
      .post("/api/auth/login")
      .send(input)
      .expect("Content-Type", /json/)
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      },
    });

    expect(login.signAccessToken).not.toHaveBeenCalled();
  });

  it("returns a generic 500 response for unexpected failures", async () => {
    const { app, login } = setup();

    login.findUserByEmail.mockRejectedValue(new Error("Internal database connection details"));

    const response = await request(app)
      .post("/api/auth/login")
      .send(input)
      .expect("Content-Type", /json/)
      .expect(500);

    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });

    expect(login.signAccessToken).not.toHaveBeenCalled();
  });
});
