import type { Client } from "pg";

export interface Migration {
  name: string;
  sql: string;
}

export async function runMigrations(
  client: Client,
  migrations: readonly Migration[],
): Promise<string[]> {
  // Temporary Red-phase scaffold.
  void client;
  void migrations;
  throw new Error("Migration runner is not implemented.");
}
