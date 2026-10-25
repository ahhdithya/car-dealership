import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { Client } from "pg";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { hashPassword, verifyPassword } from "../../src/auth/password.js";
import { createUser, findUserByEmail } from "../../src/auth/users.repository.js";
import { signAccessToken, verifyAccessToken } from "../../src/auth/tokens.js";
import { buildTestDatabaseConfig } from "../helpers/database.js";

const migrationSql = readFileSync(
  new URL("../../migrations/001_create_users.sql", import.meta.url),
  "utf8",
);

async function withRegistrationDatabase(
  operation: (client: Client) => Promise<void>,
): Promise<void> {
  const settings = parse(readFileSync(new URL("../../.env.test", import.meta.url)));

  const client = new Client(
    buildTestDatabaseConfig({
      ...settings,
      NODE_ENV: process.env.NODE_ENV,
    }),
  );

  const schema = `test_registration_${randomUUID().replaceAll("-", "")}`;

  try {
    await client.connect();

    const identity = await client.query(
      `
        SELECT
          current_database() AS database,
          current_user AS username,
          rolsuper AS is_superuser
        FROM pg_roles
        WHERE rolname = current_user
      `,
    );

    expect(identity.rows[0]).toEqual({
      database: "dealership_test",
      username: "dealership_test_user",
      is_superuser: false,
    });

    await client.query("BEGIN");

    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET LOCAL search_path TO "${schema}"`);
      await client.query(migrationSql);

      await operation(client);
    } finally {
      await client.query("ROLLBACK");
    }
  } finally {
    await client.end();
  }
}

function appFor(client: Client) {
  return createApp({
    registration: {
      hashPassword,
      createUser: (input) => createUser(client, input),
    },
  });
}

interface StoredUser {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: Date;
}

describe("registration with PostgreSQL and Argon2", () => {
  const password = "  Mixed CASE password!  ";

  it("stores a normalized account with a verifiable hash and returns only public fields", async () => {
    await withRegistrationDatabase(async (client) => {
      const response = await request(appFor(client))
        .post("/api/auth/register")
        .send({
          email: "  Customer@Example.COM  ",
          password,
        })
        .expect("Content-Type", /json/)
        .expect(201);

      const result = await client.query<StoredUser>(
        `
          SELECT id, email, password_hash, role, created_at
          FROM users
        `,
      );

      expect(result.rows).toHaveLength(1);

      const stored = result.rows[0];

      if (!stored) {
        throw new Error("Expected the registered account to be stored.");
      }

      expect(stored.email).toBe("customer@example.com");
      expect(stored.role).toBe("USER");
      expect(stored.password_hash).toMatch(/^\$argon2id\$/);

      await expect(verifyPassword(stored.password_hash, password)).resolves.toBe(true);

      await expect(verifyPassword(stored.password_hash, "Incorrect password!")).resolves.toBe(
        false,
      );

      expect(response.body).toEqual({
        user: {
          id: stored.id,
          email: stored.email,
          role: stored.role,
          createdAt: stored.created_at.toISOString(),
        },
      });
    });
  });

  it("returns 409 when a differently formatted email identifies the same account", async () => {
    await withRegistrationDatabase(async (client) => {
      const app = appFor(client);

      await request(app)
        .post("/api/auth/register")
        .send({
          email: "customer@example.com",
          password,
        })
        .expect(201);

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "  CUSTOMER@EXAMPLE.COM  ",
          password: "Another valid password!",
        })
        .expect("Content-Type", /json/)
        .expect(409);

      expect(response.body).toEqual({
        error: {
          code: "EMAIL_ALREADY_REGISTERED",
          message: "An account with this email already exists.",
        },
      });
    });
  });

  it("rejects a submitted admin role without creating an account", async () => {
    await withRegistrationDatabase(async (client) => {
      const response = await request(appFor(client))
        .post("/api/auth/register")
        .send({
          email: "admin@example.com",
          password,
          role: "ADMIN",
        })
        .expect("Content-Type", /json/)
        .expect(400);

      expect(response.body).toEqual({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body.",
        },
      });

      const result = await client.query<{ count: number }>(
        "SELECT count(*)::integer AS count FROM users",
      );

      expect(result.rows).toEqual([{ count: 0 }]);
    });
  });
});
const loginTestSecret = "integration-test-only-signing-key-not-for-development";

async function loginAppFor(client: Client) {
  const dummyPasswordHash = await hashPassword("Dummy integration-test password!");

  return createApp({
    registration: {
      hashPassword,
      createUser: (input) => createUser(client, input),
    },
    login: {
      findUserByEmail: (email) => findUserByEmail(client, email),
      verifyPassword,
      signAccessToken: (user) => signAccessToken(user, loginTestSecret),
      dummyPasswordHash,
    },
  });
}

describe("login with PostgreSQL, Argon2, and JWT", () => {
  const password = "  Mixed CASE password!  ";

  it("logs in a registered account and returns a verifiable token", async () => {
    await withRegistrationDatabase(async (client) => {
      const app = await loginAppFor(client);

      const registration = await request(app)
        .post("/api/auth/register")
        .send({
          email: "customer@example.com",
          password,
        })
        .expect(201);

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "  CUSTOMER@EXAMPLE.COM  ",
          password,
        })
        .expect("Content-Type", /json/)
        .expect(200);

      expect(response.body).toEqual({
        accessToken: expect.any(String),
        user: registration.body.user,
      });

      const accessToken: unknown = response.body.accessToken;

      if (typeof accessToken !== "string") {
        throw new Error("Expected an access token.");
      }

      expect(verifyAccessToken(accessToken, loginTestSecret)).toEqual({
        id: registration.body.user.id,
        role: "USER",
      });

      expect(response.body.user).not.toHaveProperty("password");
      expect(response.body.user).not.toHaveProperty("passwordHash");
      expect(response.body.user).not.toHaveProperty("password_hash");
    });
  });

  it("rejects an incorrect password for an existing account", async () => {
    await withRegistrationDatabase(async (client) => {
      const app = await loginAppFor(client);

      await createUser(client, {
        email: "existing@example.com",
        passwordHash: await hashPassword(password),
      });

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "existing@example.com",
          password: "Incorrect password!",
        })
        .expect("Content-Type", /json/)
        .expect(401);

      expect(response.body).toEqual({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        },
      });
    });
  });

  it("rejects an unknown email with the same authentication response", async () => {
    await withRegistrationDatabase(async (client) => {
      const app = await loginAppFor(client);

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "missing@example.com",
          password,
        })
        .expect("Content-Type", /json/)
        .expect(401);

      expect(response.body).toEqual({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        },
      });

      const result = await client.query<{ count: number }>(
        "SELECT count(*)::integer AS count FROM users",
      );

      expect(result.rows).toEqual([{ count: 0 }]);
    });
  });
});
