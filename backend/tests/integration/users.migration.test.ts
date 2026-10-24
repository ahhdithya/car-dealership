import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { buildTestDatabaseConfig } from "../helpers/database.js";

describe("users migration", () => {
  it("stores an account with a generated ID, USER role, and creation time", async () => {
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

      // The identifier contains only our fixed prefix and generated hex digits.
      await client.query(`CREATE SCHEMA "${schemaName}"`);
      await client.query(`SET LOCAL search_path TO "${schemaName}"`);
      await client.query(migrationSql);

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
    } finally {
      try {
        if (transactionStarted) {
          await client.query("ROLLBACK");
        }
      } finally {
        await client.end();
      }
    }
  }, 15000);
});
