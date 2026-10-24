import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { buildTestDatabaseConfig } from "../helpers/database.js";

describe("test database connection", () => {
  it("connects to the dedicated test database using a non-superuser account", async () => {
    expect(process.env.NODE_ENV).toBe("test");

    const environmentFile = new URL("../../.env.test", import.meta.url);
    const settings = parse(readFileSync(environmentFile));
    const config = buildTestDatabaseConfig(settings);
    const client = new pg.Client(config);

    try {
      await client.connect();

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
    } finally {
      await client.end();
    }
  }, 10000);
});
