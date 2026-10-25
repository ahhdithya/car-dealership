import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { InvalidCredentialsError, loginUser } from "../../src/auth/login.service.js";
import type { LoginDependencies } from "../../src/auth/login.service.js";
import type { AuthenticationUser } from "../../src/auth/users.repository.js";

function setup(role: "USER" | "ADMIN" = "USER") {
  const account: AuthenticationUser = {
    id: "82df1573-4d97-4d4a-a7bb-caf495170d71",
    email: "customer@example.com",
    role,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    passwordHash: "stored-hash-fixture",
  };

  const dependencies = {
    findUserByEmail: vi.fn<LoginDependencies["findUserByEmail"]>().mockResolvedValue(account),
    verifyPassword: vi.fn<LoginDependencies["verifyPassword"]>().mockResolvedValue(true),
    signAccessToken: vi
      .fn<LoginDependencies["signAccessToken"]>()
      .mockReturnValue("access-token-fixture"),
    dummyPasswordHash: "dummy-hash-fixture",
  };

  return { account, dependencies };
}

describe("login service", () => {
  const input = {
    email: "  Customer@Example.COM  ",
    password: "  Mixed CASE password!  ",
  };

  it.each(["USER", "ADMIN"] as const)(
    "authenticates a %s and returns a token with public account details",
    async (role) => {
      const { account, dependencies } = setup(role);

      const result = await loginUser(input, dependencies);

      expect(dependencies.findUserByEmail).toHaveBeenCalledExactlyOnceWith("customer@example.com");

      expect(dependencies.verifyPassword).toHaveBeenCalledExactlyOnceWith(
        account.passwordHash,
        input.password,
      );

      expect(dependencies.signAccessToken).toHaveBeenCalledExactlyOnceWith({
        id: account.id,
        role: account.role,
      });

      expect(result).toEqual({
        accessToken: "access-token-fixture",
        user: {
          id: account.id,
          email: account.email,
          role: account.role,
          createdAt: account.createdAt,
        },
      });
    },
  );

  it("rejects invalid input before looking up an account", async () => {
    const { dependencies } = setup();

    await expect(loginUser({ ...input, role: "ADMIN" }, dependencies)).rejects.toBeInstanceOf(
      ZodError,
    );

    expect(dependencies.findUserByEmail).not.toHaveBeenCalled();
    expect(dependencies.verifyPassword).not.toHaveBeenCalled();
    expect(dependencies.signAccessToken).not.toHaveBeenCalled();
  });

  it("checks the dummy hash and rejects an unknown email", async () => {
    const { dependencies } = setup();

    dependencies.findUserByEmail.mockResolvedValue(null);

    // Even a successful dummy comparison must never authenticate anyone.
    dependencies.verifyPassword.mockResolvedValue(true);

    const operation = loginUser(input, dependencies);

    await expect(operation).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(operation).rejects.toThrow("Invalid email or password.");

    expect(dependencies.verifyPassword).toHaveBeenCalledExactlyOnceWith(
      dependencies.dummyPasswordHash,
      input.password,
    );

    expect(dependencies.signAccessToken).not.toHaveBeenCalled();
  });

  it("rejects an incorrect password without issuing a token", async () => {
    const { dependencies } = setup();

    dependencies.verifyPassword.mockResolvedValue(false);

    const operation = loginUser(input, dependencies);

    await expect(operation).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(operation).rejects.toThrow("Invalid email or password.");

    expect(dependencies.signAccessToken).not.toHaveBeenCalled();
  });

  it("preserves database failures without verifying or signing", async () => {
    const { dependencies } = setup();
    const failure = new Error("Database unavailable");

    dependencies.findUserByEmail.mockRejectedValue(failure);

    await expect(loginUser(input, dependencies)).rejects.toBe(failure);

    expect(dependencies.verifyPassword).not.toHaveBeenCalled();
    expect(dependencies.signAccessToken).not.toHaveBeenCalled();
  });

  it("preserves password-verification failures without signing", async () => {
    const { dependencies } = setup();
    const failure = new Error("Password verification failed");

    dependencies.verifyPassword.mockRejectedValue(failure);

    await expect(loginUser(input, dependencies)).rejects.toBe(failure);

    expect(dependencies.signAccessToken).not.toHaveBeenCalled();
  });

  it("preserves token-signing failures", async () => {
    const { dependencies } = setup();
    const failure = new Error("Token signing failed");

    dependencies.signAccessToken.mockImplementation(() => {
      throw failure;
    });

    await expect(loginUser(input, dependencies)).rejects.toBe(failure);
  });
});
