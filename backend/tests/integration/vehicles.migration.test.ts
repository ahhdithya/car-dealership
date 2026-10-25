import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { Client } from "pg";
import { describe, expect, it } from "vitest";

import { buildTestDatabaseConfig } from "../helpers/database.js";

const migrationSql = readFileSync(
  new URL("../../migrations/002_create_vehicles.sql", import.meta.url),
  "utf8",
);

async function withVehiclesTable(operation: (client: Client) => Promise<void>): Promise<void> {
  const settings = parse(readFileSync(new URL("../../.env.test", import.meta.url)));

  const client = new Client(
    buildTestDatabaseConfig({
      ...settings,
      NODE_ENV: process.env.NODE_ENV,
    }),
  );

  const schema = `test_vehicles_${randomUUID().replaceAll("-", "")}`;

  try {
    await client.connect();

    const identity = await client.query(
      `
        SELECT
          current_database() AS database,
          current_user AS username,
          rolsuper AS is_superuser
        FROM pg_roles
        WHERE rolname = current_user
      `,
    );

    expect(identity.rows[0]).toEqual({
      database: "dealership_test",
      username: "dealership_test_user",
      is_superuser: false,
    });

    await client.query("BEGIN");

    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET LOCAL search_path TO "${schema}"`);
      await client.query(migrationSql);

      await operation(client);
    } finally {
      await client.query("ROLLBACK");
    }
  } finally {
    await client.end();
  }
}

describe("vehicles migration", () => {
  it("stores a vehicle with an exact decimal price, generated ID, and zero default stock", async () => {
    await withVehiclesTable(async (client) => {
      const result = await client.query(
        `
          INSERT INTO vehicles (make, model, category, price)
          VALUES ($1, $2, $3, $4)
          RETURNING id, make, model, category, price, stock
        `,
        ["Toyota", "Corolla", "Sedan", "25000.50"],
      );

      expect(result.rows).toEqual([
        {
          id: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          ),
          make: "Toyota",
          model: "Corolla",
          category: "Sedan",
          price: "25000.50",
          stock: 0,
        },
      ]);
    });
  });

  it.each([
    {
      description: "a negative price",
      field: "price",
      value: "-1.00",
      code: "23514",
    },
    {
      description: "a zero price",
      field: "price",
      value: "0.00",
      code: "23514",
    },
    {
      description: "a NaN price",
      field: "price",
      value: "NaN",
      code: "23514",
    },
    {
      description: "negative stock",
      field: "stock",
      value: -1,
      code: "23514",
    },
    {
      description: "a blank make",
      field: "make",
      value: "   ",
      code: "23514",
    },
    {
      description: "a blank model",
      field: "model",
      value: "",
      code: "23514",
    },
    {
      description: "a blank category",
      field: "category",
      value: "   ",
      code: "23514",
    },
    {
      description: "a null make",
      field: "make",
      value: null,
      code: "23502",
    },
    {
      description: "a null model",
      field: "model",
      value: null,
      code: "23502",
    },
    {
      description: "a null category",
      field: "category",
      value: null,
      code: "23502",
    },
    {
      description: "a null price",
      field: "price",
      value: null,
      code: "23502",
    },
  ])("rejects $description", async ({ field, value, code }) => {
    await withVehiclesTable(async (client) => {
      const vehicle: Record<string, string | number | null> = {
        make: "Toyota",
        model: "Corolla",
        category: "Sedan",
        price: "25000.50",
        stock: 3,
      };

      vehicle[field] = value;

      await expect(
        client.query(
          `
            INSERT INTO vehicles (make, model, category, price, stock)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [vehicle.make, vehicle.model, vehicle.category, vehicle.price, vehicle.stock],
        ),
      ).rejects.toMatchObject({ code });
    });
  });
});
