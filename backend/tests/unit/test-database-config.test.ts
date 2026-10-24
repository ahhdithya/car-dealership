import { describe, expect, it } from "vitest";
import { buildTestDatabaseConfig } from "../helpers/database.js";

function validSettings(): Record<string, string | undefined> {
  return {
    NODE_ENV: "test",
    PGHOST: "localhost",
    PGPORT: "5432",
    PGDATABASE: "dealership_test",
    PGUSER: "dealership_test_user",
    PGPASSWORD: "unit-test-only",
  };
}

describe("test database configuration", () => {
  it("returns explicit connection settings for the dedicated test database", () => {
    const config = buildTestDatabaseConfig(validSettings());

    expect(config).toEqual({
      host: "localhost",
      port: 5432,
      database: "dealership_test",
      user: "dealership_test_user",
      password: "unit-test-only",
      ssl: false,
      connectionTimeoutMillis: 3000,
      query_timeout: 3000,
      application_name: "dealership-tests",
    });
  });

  it.each([
    {
      description: "a non-test environment",
      key: "NODE_ENV",
      value: "development",
      message: "Database tests require NODE_ENV=test.",
    },
    {
      description: "a remote host",
      key: "PGHOST",
      value: "production.example.com",
      message: "Database tests require PGHOST=localhost.",
    },
    {
      description: "an unexpected port",
      key: "PGPORT",
      value: "5433",
      message: "Database tests require PGPORT=5432.",
    },
    {
      description: "the development database",
      key: "PGDATABASE",
      value: "dealership_dev",
      message: "Database tests require PGDATABASE=dealership_test.",
    },
    {
      description: "the development account",
      key: "PGUSER",
      value: "dealership_dev_user",
      message: "Database tests require PGUSER=dealership_test_user.",
    },
    {
      description: "the PostgreSQL administrator account",
      key: "PGUSER",
      value: "postgres",
      message: "Database tests require PGUSER=dealership_test_user.",
    },
    {
      description: "an empty password",
      key: "PGPASSWORD",
      value: "",
      message: "Database tests require a non-empty PGPASSWORD.",
    },
    {
      description: "a missing password",
      key: "PGPASSWORD",
      value: undefined,
      message: "Database tests require a non-empty PGPASSWORD.",
    },
  ])("rejects $description", ({ key, value, message }) => {
    const settings = validSettings();
    settings[key] = value;

    expect(() => buildTestDatabaseConfig(settings)).toThrow(message);
  });
});
