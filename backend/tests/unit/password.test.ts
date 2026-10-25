import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../../src/auth/password.js";

describe("password hashing and verification", () => {
  const password = "Example password 123!";

  it("creates an encoded Argon2id hash", async () => {
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain(password);
  });

  it("verifies the correct password", async () => {
    const hash = await hashPassword(password);

    await expect(verifyPassword(hash, password)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword(password);

    await expect(verifyPassword(hash, "Incorrect password 123!")).resolves.toBe(false);
  });

  it("uses different salts when hashing the same password", async () => {
    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    expect(firstHash).not.toBe(secondHash);

    await expect(verifyPassword(firstHash, password)).resolves.toBe(true);
    await expect(verifyPassword(secondHash, password)).resolves.toBe(true);
  });

  it("preserves password case and surrounding spaces", async () => {
    const exactPassword = "  Mixed CASE password!  ";
    const hash = await hashPassword(exactPassword);

    await expect(verifyPassword(hash, exactPassword)).resolves.toBe(true);

    await expect(verifyPassword(hash, exactPassword.trim())).resolves.toBe(false);

    await expect(verifyPassword(hash, exactPassword.toLowerCase())).resolves.toBe(false);
  });
});
