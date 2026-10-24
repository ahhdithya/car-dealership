import type { ClientConfig } from "pg";

export function buildTestDatabaseConfig(
  settings: Readonly<Record<string, string | undefined>>,
): ClientConfig {
  // Temporary Red-phase scaffold; replaced after verifying test failures.
  void settings;
  throw new Error("Test database configuration validation is not implemented.");
}
