import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { Client } from "pg";
import { describe, expect, it } from "vitest";

import { createVehicle, listVehicles } from "../../src/vehicles/vehicles.repository.js";
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

  const schema = `test_vehicle_repo_${randomUUID().replaceAll("-", "")}`;

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

describe("vehicles repository", () => {
  it("persists vehicle details and returns the generated ID", async () => {
    await withVehiclesTable(async (client) => {
      const input = {
        make: "O'Brian Motors",
        model: "Tourer",
        category: "SUV",
        price: "45000.25",
        stock: 4,
      };

      const vehicle = await createVehicle(client, input);

      expect(vehicle).toEqual({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        ),
        ...input,
      });

      const stored = await client.query(
        `
          SELECT id, make, model, category, price, stock
          FROM vehicles
          WHERE id = $1
        `,
        [vehicle.id],
      );

      expect(stored.rows).toEqual([vehicle]);
    });
  });

  it("returns an empty list when inventory is empty", async () => {
    await withVehiclesTable(async (client) => {
      await expect(listVehicles(client)).resolves.toEqual([]);
    });
  });

  it("lists all vehicles including zero stock in make, model, and ID order", async () => {
    await withVehiclesTable(async (client) => {
      const firstId = "00000000-0000-4000-8000-000000000001";
      const secondId = "00000000-0000-4000-8000-000000000002";
      const thirdId = "00000000-0000-4000-8000-000000000003";
      const fourthId = "00000000-0000-4000-8000-000000000004";

      const vehicles = [
        {
          id: fourthId,
          make: "Toyota",
          model: "Corolla",
          category: "Sedan",
          price: "25000.50",
          stock: 3,
        },
        {
          id: thirdId,
          make: "Honda",
          model: "Civic",
          category: "Sedan",
          price: "24000.00",
          stock: 0,
        },
        {
          id: secondId,
          make: "Honda",
          model: "Accord",
          category: "Sedan",
          price: "30000.00",
          stock: 2,
        },
        {
          id: firstId,
          make: "Honda",
          model: "Accord",
          category: "Sedan",
          price: "31000.00",
          stock: 1,
        },
      ];

      for (const vehicle of vehicles) {
        await client.query(
          `
            INSERT INTO vehicles (id, make, model, category, price, stock)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [vehicle.id, vehicle.make, vehicle.model, vehicle.category, vehicle.price, vehicle.stock],
        );
      }

      const listed = await listVehicles(client);

      expect(listed).toEqual([vehicles[3], vehicles[2], vehicles[1], vehicles[0]]);
    });
  });
});
