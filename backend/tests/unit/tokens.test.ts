import jwt from "jsonwebtoken";
import type { Algorithm } from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import { InvalidTokenError, signAccessToken, verifyAccessToken } from "../../src/auth/tokens.js";

const secret = "test-only-signing-key-do-not-use-outside-tests";
const otherSecret = "different-test-only-key-do-not-use-outside-tests";

const userId = "82df1573-4d97-4d4a-a7bb-caf495170d71";

function fixtureToken(
  overrides: Record<string, unknown> = {},
  algorithm: Algorithm = "HS256",
  omittedClaim?: string,
): string {
  const now = Math.floor(Date.now() / 1000);

  const payload: Record<string, unknown> = {
    sub: userId,
    role: "USER",
    iss: "car-dealership-api",
    aud: "car-dealership-web",
    iat: now,
    exp: now + 3600,
    ...overrides,
  };

  if (omittedClaim !== undefined) {
    delete payload[omittedClaim];
  }

  return jwt.sign(payload, secret, { algorithm });
}

describe("access tokens", () => {
  it("signs an HS256 token containing only account claims and a one-hour lifetime", () => {
    const token = signAccessToken({ id: userId, role: "USER" }, secret);

    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "car-dealership-api",
      audience: "car-dealership-web",
    });

    if (typeof payload === "string") {
      throw new Error("Expected an object token payload.");
    }

    expect(payload).toEqual({
      sub: userId,
      role: "USER",
      iss: "car-dealership-api",
      aud: "car-dealership-web",
      iat: expect.any(Number),
      exp: expect.any(Number),
    });

    if (typeof payload.iat !== "number" || typeof payload.exp !== "number") {
      throw new Error("Expected numeric token timestamps.");
    }

    expect(payload.exp - payload.iat).toBe(3600);
  });

  it.each(["USER", "ADMIN"] as const)("verifies a valid token for the %s role", (role) => {
    const token = fixtureToken({ role });

    expect(verifyAccessToken(token, secret)).toEqual({
      id: userId,
      role,
    });
  });

  it.each([
    {
      description: "an expired token",
      token: () => fixtureToken({ exp: 1 }),
    },
    {
      description: "an incorrect issuer",
      token: () => fixtureToken({ iss: "another-api" }),
    },
    {
      description: "an incorrect audience",
      token: () => fixtureToken({ aud: "another-app" }),
    },
    {
      description: "an unexpected signing algorithm",
      token: () => fixtureToken({}, "HS384"),
    },
    {
      description: "an unsupported role",
      token: () => fixtureToken({ role: "SUPERADMIN" }),
    },
    {
      description: "a missing account ID",
      token: () => fixtureToken({}, "HS256", "sub"),
    },
    {
      description: "a missing expiration",
      token: () => fixtureToken({}, "HS256", "exp"),
    },
  ])("rejects $description", ({ token }) => {
    expect(() => verifyAccessToken(token(), secret)).toThrow(InvalidTokenError);
  });

  it("rejects a token verified with the wrong key", () => {
    const token = fixtureToken();

    expect(() => verifyAccessToken(token, otherSecret)).toThrow(InvalidTokenError);
  });

  it("rejects a tampered payload", () => {
    const parts = fixtureToken().split(".");

    parts[1] = Buffer.from(
      JSON.stringify({
        sub: userId,
        role: "ADMIN",
        iss: "car-dealership-api",
        aud: "car-dealership-web",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");

    expect(() => verifyAccessToken(parts.join("."), secret)).toThrow(InvalidTokenError);
  });

  it("rejects malformed tokens", () => {
    expect(() => verifyAccessToken("not-a-jwt", secret)).toThrow(InvalidTokenError);
  });
});
