import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import pg from "pg";
import { describe, expect, it } from "vitest";

describe("test database connection", () => {
  it("connects to the dedicated test database using a non-superuser account", async () => {
    expect(process.env.NODE_ENV).toBe("test");

    const environmentFile = new URL("../../.env.test", import.meta.url);
    const settings = parse(readFileSync(environmentFile));

    expect(settings.NODE_ENV).toBe("test");
    expect(settings.PGHOST).toBe("localhost");
    expect(settings.PGPORT).toBe("5432");
    expect(settings.PGDATABASE).toBe("dealership_test");
    expect(settings.PGUSER).toBe("dealership_test_user");

    const password = settings.PGPASSWORD;

    if (!password) {
      throw new Error("Set PGPASSWORD in backend/.env.test before running this test.");
    }

    const client = new pg.Client({
      host: "localhost",
      port: 5432,
      database: "dealership_test",
      user: "dealership_test_user",
      password,
      ssl: false,
      connectionTimeoutMillis: 3000,
      query_timeout: 3000,
      application_name: "dealership-connection-test",
    });

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
