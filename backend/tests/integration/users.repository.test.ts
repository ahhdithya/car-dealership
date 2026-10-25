import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { Client } from "pg";
import { describe, expect, it } from "vitest";

import { createUser } from "../../src/auth/users.repository.js";
import { buildTestDatabaseConfig } from "../helpers/database.js";

const migrationSql = readFileSync(
  new URL("../../migrations/001_create_users.sql", import.meta.url),
  "utf8",
);

async function withUsersTable(operation: (client: Client) => Promise<void>): Promise<void> {
  const settings = parse(readFileSync(new URL("../../.env.test", import.meta.url)));

  const client = new Client(
    buildTestDatabaseConfig({
      ...settings,
      NODE_ENV: process.env.NODE_ENV,
    }),
  );

  const schema = `test_users_repo_${randomUUID().replaceAll("-", "")}`;

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

describe("users repository", () => {
  // Repository tests store an opaque fixture.
  // Real hashing is covered by the password tests.
  const passwordHash = "repository-test-hash";

  it("creates an ordinary user and returns only public account fields", async () => {
    await withUsersTable(async (client) => {
      const user = await createUser(client, {
        email: "customer@example.com",
        passwordHash,
      });

      expect(user).toEqual({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        ),
        email: "customer@example.com",
        role: "USER",
        createdAt: expect.any(Date),
      });
    });
  });

  it("persists the supplied password hash with the account", async () => {
    await withUsersTable(async (client) => {
      const user = await createUser(client, {
        email: "stored@example.com",
        passwordHash,
      });

      const stored = await client.query(
        `
          SELECT id, email, password_hash, role
          FROM users
          WHERE id = $1
        `,
        [user.id],
      );

      expect(stored.rows).toEqual([
        {
          id: user.id,
          email: "stored@example.com",
          password_hash: passwordHash,
          role: "USER",
        },
      ]);
    });
  });

  it("rejects an email that already belongs to an account", async () => {
    await withUsersTable(async (client) => {
      await client.query("INSERT INTO users (email, password_hash) VALUES ($1, $2)", [
        "existing@example.com",
        passwordHash,
      ]);

      await expect(
        createUser(client, {
          email: "existing@example.com",
          passwordHash,
        }),
      ).rejects.toMatchObject({
        code: "23505",
        constraint: "users_email_unique",
      });
    });
  });
});
