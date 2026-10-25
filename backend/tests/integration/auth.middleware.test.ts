import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { authenticate, requireAdmin } from "../../src/auth/auth.middleware.js";
import { signAccessToken } from "../../src/auth/tokens.js";

const secret = "middleware-test-only-signing-key-not-for-development";
const otherSecret = "different-middleware-test-only-signing-key";
const userId = "82df1573-4d97-4d4a-a7bb-caf495170d71";

const authenticationError = {
  error: {
    code: "AUTHENTICATION_REQUIRED",
    message: "A valid Bearer token is required.",
  },
};

function setup() {
  const app = express();

  app.get("/protected", authenticate(secret), (_request, response) => {
    response.json({ user: response.locals.user });
  });

  app.get("/admin", authenticate(secret), requireAdmin, (_request, response) => {
    response.json({ allowed: true });
  });

  // Ensures the admin guard also fails closed if authentication is omitted.
  app.get("/admin-without-auth", requireAdmin, (_request, response) => {
    response.json({ allowed: true });
  });

  return app;
}

describe("authentication middleware", () => {
  it.each(["USER", "ADMIN"] as const)(
    "allows a valid %s token and exposes its verified claims",
    async (role) => {
      const token = signAccessToken({ id: userId, role }, secret);

      const response = await request(setup())
        .get("/protected")
        .set("Authorization", `Bearer ${token}`)
        .expect("Content-Type", /json/)
        .expect(200);

      expect(response.body).toEqual({
        user: { id: userId, role },
      });
    },
  );

  it("returns 401 when the Authorization header is missing", async () => {
    const response = await request(setup())
      .get("/protected")
      .expect("Content-Type", /json/)
      .expect(401);

    expect(response.body).toEqual(authenticationError);
  });

  it.each(["Basic abc", "Bearer", "Bearer first second"])(
    "rejects an invalid Authorization header: %s",
    async (header) => {
      const response = await request(setup())
        .get("/protected")
        .set("Authorization", header)
        .expect("Content-Type", /json/)
        .expect(401);

      expect(response.body).toEqual(authenticationError);
    },
  );

  it.each([
    {
      description: "a malformed token",
      token: () => "not-a-jwt",
    },
    {
      description: "a token signed with another key",
      token: () => signAccessToken({ id: userId, role: "USER" }, otherSecret),
    },
    {
      description: "an expired token",
      token: () =>
        jwt.sign({ role: "USER", exp: 1 }, secret, {
          algorithm: "HS256",
          subject: userId,
          issuer: "car-dealership-api",
          audience: "car-dealership-web",
        }),
    },
  ])("returns 401 for $description", async ({ token }) => {
    const response = await request(setup())
      .get("/protected")
      .set("Authorization", `Bearer ${token()}`)
      .expect("Content-Type", /json/)
      .expect(401);

    expect(response.body).toEqual(authenticationError);
  });
});

describe("administrator authorization", () => {
  it("allows an authenticated administrator", async () => {
    const token = signAccessToken({ id: userId, role: "ADMIN" }, secret);

    const response = await request(setup())
      .get("/admin")
      .set("Authorization", `Bearer ${token}`)
      .expect("Content-Type", /json/)
      .expect(200);

    expect(response.body).toEqual({ allowed: true });
  });

  it("returns 403 for an authenticated ordinary user", async () => {
    const token = signAccessToken({ id: userId, role: "USER" }, secret);

    const response = await request(setup())
      .get("/admin")
      .set("Authorization", `Bearer ${token}`)
      .expect("Content-Type", /json/)
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Administrator access is required.",
      },
    });
  });

  it("returns 401 when no verified account is available", async () => {
    const response = await request(setup())
      .get("/admin-without-auth")
      .expect("Content-Type", /json/)
      .expect(401);

    expect(response.body).toEqual(authenticationError);
  });
});
