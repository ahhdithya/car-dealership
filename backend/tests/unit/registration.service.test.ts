import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { EmailAlreadyRegisteredError, registerUser } from "../../src/auth/registration.service.js";
import type { RegistrationDependencies } from "../../src/auth/registration.service.js";
import type { PublicUser } from "../../src/auth/users.repository.js";

function setup() {
  const user: PublicUser = {
    id: "82df1573-4d97-4d4a-a7bb-caf495170d71",
    email: "customer@example.com",
    role: "USER",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };

  const dependencies = {
    hashPassword: vi
      .fn<RegistrationDependencies["hashPassword"]>()
      .mockResolvedValue("hashed-password-fixture"),
    createUser: vi.fn<RegistrationDependencies["createUser"]>().mockResolvedValue(user),
  };

  return { user, dependencies };
}

describe("registration service", () => {
  const password = "  Mixed CASE password!  ";

  const validInput = {
    email: "  Customer@Example.COM  ",
    password,
  };

  it("normalizes the email, hashes the exact password, and returns public account details", async () => {
    const { user, dependencies } = setup();

    const result = await registerUser(validInput, dependencies);

    expect(dependencies.hashPassword).toHaveBeenCalledExactlyOnceWith(password);

    expect(dependencies.createUser).toHaveBeenCalledExactlyOnceWith({
      email: "customer@example.com",
      passwordHash: "hashed-password-fixture",
    });

    expect(result).toEqual(user);
    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("password_hash");
  });

  it("rejects invalid input before hashing or saving", async () => {
    const { dependencies } = setup();

    await expect(
      registerUser({ ...validInput, role: "ADMIN" }, dependencies),
    ).rejects.toBeInstanceOf(ZodError);

    expect(dependencies.hashPassword).not.toHaveBeenCalled();
    expect(dependencies.createUser).not.toHaveBeenCalled();
  });

  it("translates the email uniqueness violation and preserves its cause", async () => {
    const { dependencies } = setup();

    const databaseError = Object.assign(new Error("Duplicate email"), {
      code: "23505",
      constraint: "users_email_unique",
    });

    dependencies.createUser.mockRejectedValue(databaseError);

    const operation = registerUser(validInput, dependencies);

    await expect(operation).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);

    await expect(operation).rejects.toMatchObject({
      message: "An account with this email already exists.",
      cause: databaseError,
    });
  });

  it("preserves uniqueness errors for other constraints", async () => {
    const { dependencies } = setup();

    const databaseError = Object.assign(new Error("Duplicate ID"), {
      code: "23505",
      constraint: "users_pkey",
    });

    dependencies.createUser.mockRejectedValue(databaseError);

    await expect(registerUser(validInput, dependencies)).rejects.toBe(databaseError);
  });

  it("preserves other database failures", async () => {
    const { dependencies } = setup();
    const databaseError = new Error("Database unavailable");

    dependencies.createUser.mockRejectedValue(databaseError);

    await expect(registerUser(validInput, dependencies)).rejects.toBe(databaseError);
  });

  it("does not save an account when hashing fails", async () => {
    const { dependencies } = setup();
    const hashingError = new Error("Hashing failed");

    dependencies.hashPassword.mockRejectedValue(hashingError);

    await expect(registerUser(validInput, dependencies)).rejects.toBe(hashingError);

    expect(dependencies.createUser).not.toHaveBeenCalled();
  });
});
