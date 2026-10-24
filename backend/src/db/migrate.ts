import type { Client } from "pg";

export interface Migration {
  name: string;
  sql: string;
}

export async function runMigrations(
  client: Client,
  migrations: readonly Migration[],
): Promise<string[]> {
  await client.query("BEGIN");

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const history = await client.query<{ name: string }>("SELECT name FROM schema_migrations");

    const appliedNames = new Set(history.rows.map((row) => row.name));
    const newlyApplied: string[] = [];

    for (const migration of migrations) {
      if (appliedNames.has(migration.name)) {
        continue;
      }

      await client.query(migration.sql);

      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [migration.name]);

      appliedNames.add(migration.name);
      newlyApplied.push(migration.name);
    }

    await client.query("COMMIT");

    return newlyApplied;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Migration execution failed and rollback also failed.",
        { cause: rollbackError },
      );
    }

    throw error;
  }
}
