import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { parse } from "dotenv";
import { Pool } from "pg";
import { z } from "zod";

import { createApp } from "./app.js";
import { hashPassword, verifyPassword } from "./auth/password.js";
import { createUser, findUserByEmail } from "./auth/users.repository.js";
import { randomBytes } from "node:crypto";
import { signAccessToken } from "./auth/tokens.js";
import { createVehicle, listVehicles } from "./vehicles/vehicles.repository.js";

const developmentSettingsSchema = z.object({
  JWT_SECRET: z.string().regex(/^[0-9a-f]{64}$/i),
  NODE_ENV: z.literal("development"),
  PGHOST: z.literal("localhost"),
  PGPORT: z.literal("5432"),
  PGDATABASE: z.literal("dealership_dev"),
  PGUSER: z.literal("dealership_dev_user"),
  PGPASSWORD: z.string().min(1),
});

async function main(): Promise<void> {
  const parsed = developmentSettingsSchema.safeParse(
    parse(readFileSync(new URL("../.env", import.meta.url))),
  );

  if (!parsed.success) {
    throw new Error(
      "Check backend/.env: development database settings or JWT_SECRET are missing or invalid.",
    );
  }

  const settings = parsed.data;
  process.env.NODE_ENV = settings.NODE_ENV;

  const pool = new Pool({
    host: settings.PGHOST,
    port: 5432,
    database: settings.PGDATABASE,
    user: settings.PGUSER,
    password: settings.PGPASSWORD,
    ssl: false,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    query_timeout: 10000,
    application_name: "dealership-development-api",
    options: "-c search_path=public",
  });

  pool.on("error", () => {
    console.error("An idle database connection failed.");
  });

  try {
    const identity = await pool.query<{
      database: string;
      username: string;
      is_superuser: boolean;
    }>(
      `
        SELECT
          current_database() AS database,
          current_user AS username,
          rolsuper AS is_superuser
        FROM pg_roles
        WHERE rolname = current_user
      `,
    );

    const account = identity.rows[0];

    if (
      !account ||
      account.database !== "dealership_dev" ||
      account.username !== "dealership_dev_user" ||
      account.is_superuser
    ) {
      throw new Error("Unexpected development database identity.");
    }

    // Fail before listening if the users migration has not been applied.
    await pool.query("SELECT id FROM public.users LIMIT 0");

    // Fail before listening if the vehicles migration has not been applied.
    await pool.query("SELECT id FROM public.vehicles LIMIT 0");

    const dummyPasswordHash = await hashPassword(randomBytes(32).toString("hex"));

    const app = createApp({
      registration: {
        hashPassword,
        createUser: (input) => createUser(pool, input),
      },
      login: {
        findUserByEmail: (email) => findUserByEmail(pool, email),
        verifyPassword,
        signAccessToken: (user) => signAccessToken(user, settings.JWT_SECRET),
        dummyPasswordHash,
      },
      vehicles: {
        tokenSecret: settings.JWT_SECRET,
        repository: {
          createVehicle: (input) => createVehicle(pool, input),
          listVehicles: (filters) => listVehicles(pool, filters),
        },
      },
    });

    const server = createServer(app);

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);

      server.listen(3000, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });

    console.log("API listening at http://127.0.0.1:3000");

    let stopping = false;

    const shutdown = (): void => {
      if (stopping) {
        return;
      }

      stopping = true;
      console.log("Stopping API...");

      server.close((error) => {
        if (error) {
          console.error("HTTP server shutdown failed.");
          process.exitCode = 1;
        }

        void pool.end().catch(() => {
          console.error("Database pool shutdown failed.");
          process.exitCode = 1;
        });
      });
    };

    server.on("error", () => {
      console.error("HTTP server error.");
      process.exitCode = 1;
      shutdown();
    });

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    await pool.end();
    throw error;
  }
}

void main().catch((error: unknown) => {
  console.error("API startup failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
