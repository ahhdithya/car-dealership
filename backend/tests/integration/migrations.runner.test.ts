import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../../src/db/migrate.js";
import { buildTestDatabaseConfig } from "../helpers/database.js";

const usersMigration = {
  name: "001_create_users.sql",
  sql: readFileSync(new URL("../../migrations/001_create_users.sql", import.meta.url), "utf8"),
};

async function verifyTestDatabaseIdentity(client: pg.Client): Promise<void> {
  const result = await client.query(`
    SELECT
      current_database() AS database,
      current_user AS username,
      rolsuper AS is_superuser
    FROM pg_roles
    WHERE rolname = current_user
  `);

  expect(result.rows).toEqual([
    {
      database: "dealership_test",
      username: "dealership_test_user",
      is_superuser: false,
    },
  ]);
}

async function withMigrationSchema(runTest: (client: pg.Client) => Promise<void>): Promise<void> {
  expect(process.env.NODE_ENV).toBe("test");

  const settings = parse(readFileSync(new URL("../../.env.test", import.meta.url)));
  const client = new pg.Client(buildTestDatabaseConfig(settings));
  const schemaName = `test_migrations_${randomUUID().replaceAll("-", "")}`;
  if (!/^test_migrations_[0-9a-f]{32}$/.test(schemaName)) {
    throw new Error("Refusing to use an unexpected test schema.");
  }

  let schemaCreated = false;

  try {
    await client.connect();
    await verifyTestDatabaseIdentity(client);

    // The identifier uses only a fixed prefix and generated hex digits.
    await client.query(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;

    await client.query(`SET search_path TO "${schemaName}"`);

    await runTest(client);
  } finally {
    try {
      if (schemaCreated) {
        // Recover the connection if a broken runner left a transaction open.
        await client.query("ROLLBACK");
        await verifyTestDatabaseIdentity(client);

        await client.query(`DROP SCHEMA "${schemaName}" CASCADE`);
      }
    } finally {
      await client.end();
    }
  }
}

describe("migration runner", () => {
  it("applies a pending migration and records its name", async () => {
    await withMigrationSchema(async (client) => {
      const applied = await runMigrations(client, [usersMigration]);

      expect(applied).toEqual(["001_create_users.sql"]);

      const table = await client.query("SELECT to_regclass('users')::text AS table_name");

      expect(table.rows).toEqual([{ table_name: "users" }]);

      const history = await client.query("SELECT name FROM schema_migrations ORDER BY name");

      expect(history.rows).toEqual([{ name: "001_create_users.sql" }]);
    });
  }, 15000);

  it("skips migrations that have already been applied", async () => {
    await withMigrationSchema(async (client) => {
      await runMigrations(client, [usersMigration]);

      const appliedAgain = await runMigrations(client, [usersMigration]);

      expect(appliedAgain).toEqual([]);

      const history = await client.query("SELECT name FROM schema_migrations ORDER BY name");

      expect(history.rows).toEqual([{ name: "001_create_users.sql" }]);
    });
  }, 15000);

  it("rolls back the entire pending batch when a migration fails", async () => {
    await withMigrationSchema(async (client) => {
      const brokenMigration = {
        name: "002_broken.sql",
        sql: "CREATE TABLE broken (",
      };

      await expect(runMigrations(client, [usersMigration, brokenMigration])).rejects.toMatchObject({
        code: "42601",
      });

      // These queries also verify that the runner ended its failed transaction.
      const result = await client.query(`
          SELECT
            to_regclass('users')::text AS users_table,
            to_regclass('schema_migrations')::text AS history_table
        `);

      expect(result.rows).toEqual([
        {
          users_table: null,
          history_table: null,
        },
      ]);
    });
  }, 15000);
});
