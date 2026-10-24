import { readFileSync, readdirSync } from "node:fs";
import { parse } from "dotenv";
import pg from "pg";
import { runMigrations } from "../src/db/migrate.js";

async function main(): Promise<void> {
  const settings = parse(readFileSync(new URL("../.env", import.meta.url)));

  const requiredSettings = {
    NODE_ENV: "development",
    PGHOST: "localhost",
    PGPORT: "5432",
    PGDATABASE: "dealership_dev",
    PGUSER: "dealership_dev_user",
  };

  for (const [key, expected] of Object.entries(requiredSettings)) {
    if (settings[key] !== expected) {
      throw new Error(`Local migrations require ${key}=${expected}.`);
    }
  }

  const password = settings.PGPASSWORD;

  if (!password) {
    throw new Error("Set PGPASSWORD in backend/.env before running migrations.");
  }

  const migrationDirectory = new URL("../migrations/", import.meta.url);
  const filenames = readdirSync(migrationDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();

  if (filenames.length === 0) {
    throw new Error("No SQL migrations were found.");
  }

  const migrations = filenames.map((name) => {
    if (!/^\d{3}_[a-z0-9_]+\.sql$/.test(name)) {
      throw new Error(`Invalid migration filename: ${name}`);
    }

    return {
      name,
      sql: readFileSync(new URL(name, migrationDirectory), "utf8"),
    };
  });

  const client = new pg.Client({
    host: "localhost",
    port: 5432,
    database: "dealership_dev",
    user: "dealership_dev_user",
    password,
    ssl: false,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    application_name: "dealership-local-migrations",
  });

  try {
    await client.connect();

    const result = await client.query<{
      database: string;
      username: string;
      is_superuser: boolean;
    }>(`
      SELECT
        current_database() AS database,
        current_user AS username,
        rolsuper AS is_superuser
      FROM pg_roles
      WHERE rolname = current_user
    `);

    const identity = result.rows[0];

    if (
      !identity ||
      identity.database !== "dealership_dev" ||
      identity.username !== "dealership_dev_user" ||
      identity.is_superuser !== false
    ) {
      throw new Error("Refusing to migrate an unexpected database or account.");
    }

    await client.query("SET search_path TO public");

    const applied = await runMigrations(client, migrations);

    if (applied.length === 0) {
      console.log("Database is up to date. No migrations applied.");
    } else {
      for (const name of applied) {
        console.log(`Applied: ${name}`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Migration failed: ${message}`);
  process.exitCode = 1;
});
