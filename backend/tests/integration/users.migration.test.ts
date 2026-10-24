import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { buildTestDatabaseConfig } from "../helpers/database.js";

async function withUsersTable(runTest: (client: pg.Client) => Promise<void>): Promise<void> {
  expect(process.env.NODE_ENV).toBe("test");

  const settings = parse(readFileSync(new URL("../../.env.test", import.meta.url)));
  const client = new pg.Client(buildTestDatabaseConfig(settings));
  const migrationSql = readFileSync(
    new URL("../../migrations/001_create_users.sql", import.meta.url),
    "utf8",
  );

  const schemaName = `test_users_${randomUUID().replaceAll("-", "")}`;
  let transactionStarted = false;

  try {
    await client.connect();

    const identity = await client.query(`
      SELECT
        current_database() AS database,
        current_user AS username,
        rolsuper AS is_superuser
      FROM pg_roles
      WHERE rolname = current_user
    `);

    expect(identity.rows).toEqual([
      {
        database: "dealership_test",
        username: "dealership_test_user",
        is_superuser: false,
      },
    ]);

    await client.query("BEGIN");
    transactionStarted = true;

    // Identifier contains only our fixed prefix and generated hex digits.
    await client.query(`CREATE SCHEMA "${schemaName}"`);
    await client.query(`SET LOCAL search_path TO "${schemaName}"`);
    await client.query(migrationSql);

    await runTest(client);
  } finally {
    try {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }
    } finally {
      await client.end();
    }
  }
}

describe("users migration", () => {
  it("stores an account with a generated ID, USER role, and creation time", async () => {
    await withUsersTable(async (client) => {
      const result = await client.query(
        `
          INSERT INTO users (email, password_hash)
          VALUES ($1, $2)
          RETURNING id, email, password_hash, role, created_at
        `,
        ["customer@example.com", "test-hash-not-a-real-password"],
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        ),
        email: "customer@example.com",
        password_hash: "test-hash-not-a-real-password",
        role: "USER",
        created_at: expect.any(Date),
      });
    });
  });

  it("allows an explicitly provisioned ADMIN account", async () => {
    await withUsersTable(async (client) => {
      const result = await client.query(
        `
          INSERT INTO users (email, password_hash, role)
          VALUES ($1, $2, $3)
          RETURNING role
        `,
        ["admin@example.com", "test-hash", "ADMIN"],
      );

      expect(result.rows).toEqual([{ role: "ADMIN" }]);
    });
  });

  it("rejects duplicate IDs", async () => {
    await withUsersTable(async (client) => {
      const id = randomUUID();

      await client.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)", [
        id,
        "first@example.com",
        "test-hash",
      ]);

      await expect(
        client.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)", [
          id,
          "second@example.com",
          "test-hash",
        ]),
      ).rejects.toMatchObject({ code: "23505" });
    });
  });

  it("rejects duplicate emails", async () => {
    await withUsersTable(async (client) => {
      const insert = "INSERT INTO users (email, password_hash) VALUES ($1, $2)";
      const values = ["customer@example.com", "test-hash"];

      await client.query(insert, values);

      await expect(client.query(insert, values)).rejects.toMatchObject({
        code: "23505",
      });
    });
  });

  it.each(["id", "email", "password_hash", "role", "created_at"])(
    "rejects NULL in %s",
    async (column) => {
      await withUsersTable(async (client) => {
        const account = {
          id: randomUUID(),
          email: "customer@example.com",
          password_hash: "test-hash",
          role: "USER",
          created_at: new Date(),
          [column]: null,
        };

        await expect(
          client.query(
            `
              INSERT INTO users (id, email, password_hash, role, created_at)
              VALUES ($1, $2, $3, $4, $5)
            `,
            [account.id, account.email, account.password_hash, account.role, account.created_at],
          ),
        ).rejects.toMatchObject({ code: "23502" });
      });
    },
  );

  it("rejects unsupported roles", async () => {
    await withUsersTable(async (client) => {
      await expect(
        client.query(
          `
            INSERT INTO users (email, password_hash, role)
            VALUES ($1, $2, $3)
          `,
          ["customer@example.com", "test-hash", "OWNER"],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    });
  });

  it.each([
    { description: "uppercase", email: "Customer@example.com" },
    { description: "surrounding spaces", email: " customer@example.com " },
    { description: "empty", email: "" },
  ])("rejects $description email values", async ({ email }) => {
    await withUsersTable(async (client) => {
      await expect(
        client.query("INSERT INTO users (email, password_hash) VALUES ($1, $2)", [
          email,
          "test-hash",
        ]),
      ).rejects.toMatchObject({ code: "23514" });
    });
  });

  it("rejects an empty password hash", async () => {
    await withUsersTable(async (client) => {
      await expect(
        client.query("INSERT INTO users (email, password_hash) VALUES ($1, $2)", [
          "customer@example.com",
          "",
        ]),
      ).rejects.toMatchObject({ code: "23514" });
    });
  });
});
