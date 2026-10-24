import type { ClientConfig } from "pg";

export function buildTestDatabaseConfig(
  settings: Readonly<Record<string, string | undefined>>,
): ClientConfig {
  if (settings.NODE_ENV !== "test") {
    throw new Error("Database tests require NODE_ENV=test.");
  }

  if (settings.PGHOST !== "localhost") {
    throw new Error("Database tests require PGHOST=localhost.");
  }

  if (settings.PGPORT !== "5432") {
    throw new Error("Database tests require PGPORT=5432.");
  }

  if (settings.PGDATABASE !== "dealership_test") {
    throw new Error("Database tests require PGDATABASE=dealership_test.");
  }

  if (settings.PGUSER !== "dealership_test_user") {
    throw new Error("Database tests require PGUSER=dealership_test_user.");
  }

  const password = settings.PGPASSWORD;

  if (!password) {
    throw new Error("Database tests require a non-empty PGPASSWORD.");
  }

  return {
    host: "localhost",
    port: 5432,
    database: "dealership_test",
    user: "dealership_test_user",
    password,
    ssl: false,
    connectionTimeoutMillis: 3000,
    query_timeout: 3000,
    application_name: "dealership-tests",
  };
}
